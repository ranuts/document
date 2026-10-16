import 'ranui/popover';
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
  const stopIcon =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
  mic.innerHTML = microphoneIcon + stopIcon;
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
  hint.className = 'agent-speech-hint';
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
  cancel.innerHTML =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg>';
  const privacy = document.createElement('r-popover') as HTMLElement & { popoverContent?: HTMLElement };
  privacy.className = 'agent-speech-privacy';
  privacy.setAttribute('trigger', 'click');
  privacy.setAttribute('placement', 'top-end');
  privacy.tabIndex = -1;
  const privacyToggle = document.createElement('button');
  privacyToggle.type = 'button';
  const privacyContent = document.createElement('r-content');
  privacyContent.append(hint);
  privacyToggle.innerHTML =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v1"/></svg>';
  privacy.append(privacyToggle, privacyContent);
  feedback.append(status);
  // Every state shares one toolbar; disclosures must not resize the draft.
  root.append(mic, language, feedback, cancel, privacy);
  chat.actionsEl.append(root);
  let disclosed = false;
  let notice = '';
  let popupHovered = false;
  let triggerHovered = false;
  let disclosureTimer: ReturnType<typeof setTimeout> | undefined;
  let boundPopup: HTMLElement | undefined;
  const isDisclosureFocused = () =>
    privacy.contains(document.activeElement) || Boolean(boundPopup?.contains(document.activeElement));
  const pauseDisclosure = () => clearTimeout(disclosureTimer);
  const scheduleDisclosure = () => {
    pauseDisclosure();
    if (!privacy.hasAttribute('open') || triggerHovered || popupHovered || isDisclosureFocused()) return;
    disclosureTimer = setTimeout(() => privacy.removeAttribute('open'), 3000);
  };
  const bindPopup = () => {
    const popup = privacy.popoverContent;
    if (!popup) return;
    // Keep the disclosure above the whole draft rather than over editable text.
    const composer = root.closest('.cui-composer');
    if (composer) {
      const clearance = privacy.getBoundingClientRect().top - composer.getBoundingClientRect().top;
      popup.style.translate = `0 ${-Math.max(0, clearance)}px`;
    }
    if (popup === boundPopup) return;
    boundPopup = popup;
    popup.classList.add('agent-speech-popover');
    popup.addEventListener('pointerenter', () => {
      popupHovered = true;
      pauseDisclosure();
    });
    popup.addEventListener('pointerleave', () => {
      popupHovered = false;
      scheduleDisclosure();
    });
    popup.addEventListener('focusin', pauseDisclosure);
    popup.addEventListener('focusout', () => queueMicrotask(scheduleDisclosure));
    popup.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      privacy.removeAttribute('open');
      privacyToggle.focus({ preventScroll: true });
    });
  };
  const showDisclosure = () => {
    privacy.setAttribute('open', '');
    bindPopup();
    scheduleDisclosure();
  };
  privacy.addEventListener('show', () => {
    privacyToggle.setAttribute('aria-expanded', 'true');
    bindPopup();
    scheduleDisclosure();
  });
  privacy.addEventListener('hide', () => {
    privacyToggle.setAttribute('aria-expanded', 'false');
    pauseDisclosure();
    popupHovered = false;
  });
  privacy.addEventListener('pointerenter', () => {
    triggerHovered = true;
    pauseDisclosure();
  });
  privacy.addEventListener('pointerleave', () => {
    triggerHovered = false;
    scheduleDisclosure();
  });
  privacy.addEventListener('focusin', pauseDisclosure);
  privacy.addEventListener('focusout', () => queueMicrotask(scheduleDisclosure));
  privacyToggle.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    event.stopPropagation();
    if (privacy.hasAttribute('open')) privacy.removeAttribute('open');
    else showDisclosure();
  });
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
    root.dataset.feedback = String(Boolean(status.textContent));
    mic.classList.toggle('agent-speech-processing', busy && (!listening || stopping));
    mic.setAttribute('aria-label', t(busy ? 'agentSpeechStop' : 'agentSpeechInput'));
    mic.title = mic.getAttribute('aria-label') ?? '';
    mic.setAttribute('aria-pressed', String(busy));
    chat.refreshSendAvailability();
    cancel.hidden = !busy;
    feedback.hidden = !busy && !status.textContent;
    cancel.tabIndex = busy ? 0 : -1;
    mic.disabled = stopping;
    language.setAttribute('aria-label', t('agentSpeechLanguage'));
    language.disabled = busy;
    hint.textContent = notice || t('agentSpeechPrivacy');
    privacyToggle.setAttribute('aria-label', hint.textContent);
    privacyToggle.setAttribute('aria-expanded', String(privacy.hasAttribute('open')));
    cancel.setAttribute('aria-label', t('agentSpeechCancel'));
    cancel.title = t('agentSpeechCancel');
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
    pauseDisclosure();
    privacy.removeAttribute('open');
    notice = '';
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
    notice = '';
    stopping = false;
    listening = false;
    pauseDisclosure();
    privacy.removeAttribute('open');
    const token = ++revision;
    const instance = new Constructor();
    recognition = instance;
    instance.lang = language.value;
    instance.continuous = true;
    instance.interimResults = true;
    busy = true;
    status.textContent = t('agentSpeechStarting');
    render();
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
      notice = status.textContent ?? '';
      render();
      showDisclosure();
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
      stopping = false;
      busy = false;
      recognition = undefined;
      settleFinish(true);
      if (status.textContent) notice = status.textContent;
      render();
      if (notice) showDisclosure();
      chat.focus();
    };
    try {
      instance.start();
      if (!disclosed) {
        disclosed = true;
        showDisclosure();
      }
      deadline = setTimeout(() => {
        if (token === revision && busy) {
          close();
          status.textContent = t('agentSpeechFailed');
          notice = status.textContent;
          render();
          showDisclosure();
        }
      }, 60000);
    } catch {
      close();
      status.textContent = t('agentSpeechFailed');
      notice = status.textContent;
      render();
      showDisclosure();
    }
  };
  mic.addEventListener('click', (event) => {
    // An initial disclosure must survive the same click's document dismissal.
    event.stopPropagation();
    if (busy) {
      void finish();
      return;
    }
    if (!Constructor) {
      status.textContent = t('agentSpeechUnsupported');
      notice = status.textContent;
      render();
      showDisclosure();
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
  privacy.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape' && privacy.hasAttribute('open')) {
        event.preventDefault();
        event.stopPropagation();
        pauseDisclosure();
        privacy.removeAttribute('open');
        privacyToggle.focus({ preventScroll: true });
      }
    },
    { capture: true },
  );
  feedback.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !event.defaultPrevented && !event.isComposing && busy) {
      close(true);
      mic.focus();
    }
  });
  const input = chat.el.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.addEventListener('beforeinput', () => {
    if (busy) close(false, true);
    else if (status.textContent) {
      status.textContent = '';
      render();
    }
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
