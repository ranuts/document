import { getLanguage, t } from '@ranuts/shared/i18n';
import type { ChatView } from '@ranuts/chat-ui';
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult:
    ((event: { results: ArrayLike<{ isFinal: boolean; [index: number]: { transcript: string } }> }) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type Constructor = new () => Recognition;
export function mountSpeechInput(chat: ChatView, allowed: () => boolean) {
  const host = window as unknown as { SpeechRecognition?: Constructor; webkitSpeechRecognition?: Constructor };
  const Constructor = host.SpeechRecognition ?? host.webkitSpeechRecognition;
  const root = document.createElement('div');
  root.className = 'agent-speech';
  const mic = document.createElement('button');
  mic.type = 'button';
  mic.className = 'agent-speech-mic';
  mic.innerHTML =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M6 10v2a6 6 0 0 0 12 0v-2M12 18v3M8 21h8"/></svg>';
  const details = document.createElement('div');
  details.className = 'agent-speech-language-picker';
  details.hidden = true;
  const language = document.createElement('r-select') as HTMLElement & { value: string; disabled: boolean };
  language.setAttribute('placement', 'top');
  const languages = [
    ['zh-CN', '中文'],
    ['en-US', 'English'],
    ['ja-JP', '日本語'],
    ['ko-KR', '한국어'],
    ['de-DE', 'Deutsch'],
    ['es-ES', 'Español'],
    ['pt-BR', 'Português'],
  ];
  for (const [value, label] of languages) {
    const option = document.createElement('r-option');
    option.setAttribute('value', value);
    option.textContent = label;
    language.append(option);
  }
  const locale = () => languages.find(([code]) => code.startsWith(getLanguage().split('-')[0]))?.[0] ?? 'en-US';
  language.value = locale();
  const languageButton = document.createElement('button');
  languageButton.type = 'button';
  languageButton.className = 'agent-speech-language';
  const hint = document.createElement('p');
  hint.hidden = true;
  const status = document.createElement('span');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const feedback = document.createElement('div');
  feedback.className = 'agent-speech-feedback';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'agent-speech-cancel';
  feedback.append(status, hint, cancel);
  details.append(language);
  root.append(mic, languageButton, details, feedback);
  chat.actionsEl.append(root);
  let disclosed = false;
  let stopping = false;
  let recognition: Recognition | undefined;
  let busy = false;
  let original = '';
  let base = '';
  let transcript = '';
  let revision = 0;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const render = () => {
    mic.setAttribute('aria-label', t(busy ? 'agentSpeechStop' : 'agentSpeechInput'));
    mic.title = mic.getAttribute('aria-label') ?? '';
    mic.setAttribute('aria-pressed', String(busy));
    chat.refreshSendAvailability();
    languageButton.setAttribute('aria-expanded', String(!details.hidden));
    languageButton.setAttribute('aria-label', t('agentSpeechLanguage'));
    languageButton.title = t('agentSpeechLanguage');
    languageButton.textContent = languages.find(([code]) => code === language.value)?.[1] ?? 'English';
    languageButton.disabled = busy;
    cancel.hidden = !busy;
    feedback.hidden = !busy && !status.textContent;
    mic.disabled = stopping;
    language.setAttribute('aria-label', t('agentSpeechLanguage'));
    language.disabled = busy;
    hint.textContent = t('agentSpeechPrivacy');
    cancel.textContent = t('agentSpeechCancel');
  };
  const close = (discard = false, preserveDraft = false) => {
    clearTimeout(deadline);
    ++revision;
    try {
      recognition?.abort();
    } catch {
      /* Already disconnected. */
    }
    recognition = undefined;
    if (busy && !preserveDraft) chat.setInput(discard ? original : transcript ? base + transcript : original);
    busy = false;
    stopping = false;
    details.hidden = true;
    hint.hidden = true;
    status.textContent = '';
    render();
  };
  const begin = () => {
    if (!Constructor || busy || !allowed()) return;
    original = chat.getInput();
    base = original;
    if (base && !/\s$/.test(base)) base += ' ';
    transcript = '';
    stopping = false;
    details.hidden = true;
    hint.hidden = disclosed;
    disclosed = true;
    const token = ++revision;
    const instance = new Constructor();
    recognition = instance;
    instance.lang = language.value;
    instance.continuous = true;
    instance.interimResults = true;
    busy = true;
    render();
    status.textContent = t('agentSpeechStarting');
    instance.onstart = () => {
      if (token === revision) status.textContent = t('agentSpeechListening');
    };
    instance.onresult = (event) => {
      if (token !== revision) return;
      let confirmed = '',
        interim = '';
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) confirmed += result[0].transcript;
        else interim += result[0].transcript;
      }
      transcript = confirmed + interim;
      chat.setInput(base + transcript);
    };
    instance.onerror = (event) => {
      if (token !== revision) return;
      status.textContent = t(
        event.error === 'not-allowed' || event.error === 'service-not-allowed'
          ? 'agentSpeechDenied'
          : 'agentSpeechFailed',
      );
    };
    instance.onend = () => {
      if (token !== revision) return;
      clearTimeout(deadline);
      ++revision;
      chat.setInput(transcript ? base + transcript : original);
      if (
        status.textContent === t('agentSpeechStarting') ||
        status.textContent === t('agentSpeechListening') ||
        status.textContent === t('agentSpeechFinishing')
      ) {
        status.textContent = transcript ? '' : t('agentSpeechNoResult');
      }
      hint.hidden = true;
      stopping = false;
      busy = false;
      recognition = undefined;
      render();
      chat.focus();
    };
    try {
      instance.start();
      deadline = setTimeout(() => {
        if (token === revision && busy) {
          close();
          status.textContent = t('agentSpeechFailed');
          render();
        }
      }, 60000);
    } catch {
      busy = false;
      recognition = undefined;
      status.textContent = t('agentSpeechFailed');
      render();
    }
  };
  mic.addEventListener('click', () => {
    if (busy) {
      stopping = true;
      status.textContent = t('agentSpeechFinishing');
      render();
      try {
        recognition?.stop();
      } catch {
        close();
      }
      return;
    }
    if (!Constructor) {
      status.textContent = t('agentSpeechUnsupported');
      render();
      return;
    }
    begin();
  });
  languageButton.addEventListener('click', () => {
    details.hidden = !details.hidden;
    if (!details.hidden) language.focus();
    render();
  });
  language.addEventListener('change', () => {
    details.hidden = true;
    render();
    languageButton.focus();
  });
  cancel.addEventListener('click', () => {
    close(true);
    mic.focus();
  });
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !event.defaultPrevented && !event.isComposing) {
      event.stopPropagation();
      close(true);
      mic.focus();
    }
  });
  const input = chat.el.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.addEventListener('beforeinput', () => {
    if (busy) close(false, true);
  });
  const changed = () => {
    close();
    language.value = locale();
    render();
  };
  window.addEventListener('languagechange', changed);
  window.addEventListener('pagehide', () => close());
  render();
  return { close, isBusy: () => busy };
}
