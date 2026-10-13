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
type SpeechComposer = Pick<
  ChatView,
  'el' | 'actionsEl' | 'getInput' | 'setInput' | 'focus' | 'refreshSendAvailability'
>;
export function mountSpeechInput(chat: SpeechComposer, allowed: () => boolean) {
  const host = window as unknown as { SpeechRecognition?: Constructor; webkitSpeechRecognition?: Constructor };
  const Constructor = host.SpeechRecognition ?? host.webkitSpeechRecognition;
  const root = document.createElement('div');
  root.className = 'agent-speech';
  const mic = document.createElement('button');
  mic.type = 'button';
  mic.className = 'agent-speech-mic';
  const microphoneIcon =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M6 10v2a6 6 0 0 0 12 0v-2M12 18v3M8 21h8"/></svg>';
  mic.innerHTML = microphoneIcon;
  const stopIcon =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
  const language = document.createElement('r-select') as HTMLElement & { value: string; disabled: boolean };
  language.className = 'agent-speech-language';
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
  const hint = document.createElement('p');
  hint.hidden = true;
  const status = document.createElement('span');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const feedback = document.createElement('div');
  feedback.className = 'agent-speech-feedback';
  feedback.id = 'agent-speech-feedback';
  mic.setAttribute('aria-describedby', feedback.id);
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'agent-speech-cancel';
  feedback.append(status, hint);
  root.append(mic, language, cancel);
  chat.actionsEl.append(root);
  // Keep feedback in normal composer flow; it must never cover the draft or editor.
  const composer = chat.el.querySelector('.cui-composer');
  if (composer) composer.insertBefore(feedback, composer.querySelector('.cui-composer-bar'));
  else root.append(feedback);
  let disclosed = false;
  let stopping = false;
  let listening = false;
  let recognition: Recognition | undefined;
  let busy = false;
  let original = '';
  let base = '';
  let transcript = '';
  let revision = 0;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let finishPromise: Promise<boolean> | undefined;
  let finishResolve: ((ready: boolean) => void) | undefined;
  const settleFinish = (ready: boolean) => {
    finishResolve?.(ready);
    finishResolve = undefined;
    finishPromise = undefined;
  };
  const render = () => {
    root.dataset.state = !busy ? 'idle' : stopping ? 'finishing' : listening ? 'listening' : 'starting';
    feedback.dataset.state = root.dataset.state;
    mic.innerHTML = busy ? stopIcon : microphoneIcon;
    mic.classList.toggle('agent-speech-processing', busy && (!listening || stopping));
    mic.setAttribute('aria-label', t(busy ? 'agentSpeechStop' : 'agentSpeechInput'));
    mic.title = mic.getAttribute('aria-label') ?? '';
    mic.setAttribute('aria-pressed', String(busy));
    chat.refreshSendAvailability();
    cancel.hidden = !busy;
    feedback.hidden = !busy && !status.textContent;
    mic.disabled = stopping;
    language.setAttribute('aria-label', t('agentSpeechLanguage'));
    language.disabled = busy;
    hint.textContent = t('agentSpeechPrivacy');
    cancel.setAttribute('aria-label', t('agentSpeechCancel'));
    cancel.title = t('agentSpeechCancel');
    cancel.innerHTML =
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg>';
  };
  const close = (discard = false, preserveDraft = false, ready = false) => {
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
    listening = false;
    hint.hidden = true;
    status.textContent = '';
    settleFinish(ready);
    render();
  };
  const finish = (): boolean | Promise<boolean> => {
    if (!busy) return true;
    if (finishPromise) return finishPromise;
    const pending = new Promise<boolean>((resolve) => {
      finishResolve = resolve;
    });
    finishPromise = pending;
    stopping = true;
    status.textContent = t('agentSpeechFinishing');
    render();
    clearTimeout(deadline);
    // Some services never emit end after stop. Keep the visible transcript and
    // release the microphone rather than stranding an explicit send indefinitely.
    deadline = setTimeout(() => close(false, false, true), 2000);
    try {
      recognition?.stop();
    } catch {
      close(false, false, true);
    }
    return pending;
  };
  const begin = () => {
    if (!Constructor || busy || !allowed()) return;
    original = chat.getInput();
    base = original;
    if (base && !/\s$/.test(base)) base += ' ';
    transcript = '';
    stopping = false;
    listening = false;
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
      if (token !== revision || stopping) return;
      listening = true;
      status.textContent = t('agentSpeechListening');
      render();
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
      close(false, false, true);
      status.textContent = t(
        event.error === 'not-allowed' || event.error === 'service-not-allowed'
          ? 'agentSpeechDenied'
          : 'agentSpeechFailed',
      );
      render();
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
      settleFinish(true);
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
      close();
      status.textContent = t('agentSpeechFailed');
      render();
    }
  };
  mic.addEventListener('click', () => {
    if (busy) {
      void finish();
      return;
    }
    if (!Constructor) {
      status.textContent = t('agentSpeechUnsupported');
      render();
      return;
    }
    begin();
  });
  language.addEventListener('change', () => {
    render();
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
  feedback.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !event.defaultPrevented && !event.isComposing && busy) {
      close(true);
      mic.focus();
    }
  });
  const input = chat.el.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.addEventListener('beforeinput', () => {
    if (busy) close(false, true);
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !event.defaultPrevented && !event.isComposing && busy) {
      event.preventDefault();
      close(true);
      mic.focus();
    }
  });
  const changed = () => {
    close();
    language.value = locale();
    render();
  };
  window.addEventListener('languagechange', changed);
  window.addEventListener('pagehide', () => close());
  render();
  return { close, finish, isBusy: () => busy };
}
