import { afterEach, expect, it, vi } from 'vitest';
import { mountSpeechInput } from '../../lib/agent-plugin/ui/speech-input';
import type { ChatView } from '@ranuts/chat-ui';
import { ChatView as ComposerView } from '../../packages/chat-ui/src/chat-view';
vi.mock('@ranuts/shared/i18n', () => ({ getLanguage: () => 'zh-CN', t: (key: string) => key }));
class FakeRecognition {
  static current: FakeRecognition;
  constructor() {
    FakeRecognition.current = this;
  }
  lang = '';
  continuous = false;
  interimResults = false;
  onstart?: () => void;
  onend?: () => void;
  onerror?: (event: { error: string }) => void;
  onresult?: (event: unknown) => void;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();
}
function setup() {
  Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: FakeRecognition });
  const el = document.createElement('div');
  el.innerHTML = '<textarea class="cui-input"></textarea><div class="actions"></div>';
  document.body.append(el);
  let draft = 'Original';
  const chat = {
    el,
    actionsEl: el.querySelector('.actions'),
    getInput: () => draft,
    setInput: (text: string) => {
      draft = text;
    },
    focus: vi.fn(),
    refreshSendAvailability: vi.fn(),
  };
  const speech = mountSpeechInput(chat as unknown as ChatView, () => true);
  (el.querySelector('.agent-speech-mic') as HTMLButtonElement).click();
  return { el, speech, draft: () => draft, recognition: FakeRecognition.current };
}
afterEach(() => {
  window.dispatchEvent(new Event('pagehide'));
  document.body.replaceChildren();
});
it('selects the UI language and accumulates results without submitting', () => {
  const { recognition, draft, speech } = setup();
  expect(recognition.lang).toBe('zh-CN');
  recognition.onresult?.({
    results: [
      { isFinal: true, 0: { transcript: '你好' } },
      { isFinal: false, 0: { transcript: '世界' } },
    ],
  });
  expect(draft()).toBe('Original 你好世界');
  recognition.onend?.();
  expect(draft()).toBe('Original 你好世界');
  expect(speech.isBusy()).toBe(false);
});
it('cancel preserves the exact draft and ignores late results', () => {
  const { el, recognition, draft, speech } = setup();
  el.querySelector<HTMLButtonElement>('.agent-speech-cancel')!.click();
  recognition.onresult?.({ results: [{ isFinal: true, 0: { transcript: 'Late' } }] });
  expect(draft()).toBe('Original');
  expect(recognition.abort).toHaveBeenCalled();
  expect(speech.isBusy()).toBe(false);
});
it('reports permission denial while retaining a draft', () => {
  const { el, recognition, draft } = setup();
  recognition.onerror?.({ error: 'not-allowed' });
  recognition.onend?.();
  expect(el.querySelector('[role="status"]')?.textContent).toBe('agentSpeechDenied');
  expect(draft()).toBe('Original');
});
it('closing a session keeps confirmed text and prevents callbacks from leaking into another draft', () => {
  const { recognition, draft, speech } = setup();
  recognition.onresult?.({ results: [{ isFinal: true, 0: { transcript: 'Done' } }] });
  speech.close();
  recognition.onresult?.({ results: [{ isFinal: true, 0: { transcript: 'Wrong session' } }] });
  expect(draft()).toBe('Original Done');
  expect(speech.isBusy()).toBe(false);
});
it('stop waits for the final recognition result before ending', () => {
  const { el, recognition, speech } = setup();
  (el.querySelector('.agent-speech-mic') as HTMLButtonElement).click();
  expect(recognition.stop).toHaveBeenCalled();
  expect(speech.isBusy()).toBe(true);
  recognition.onend?.();
  expect(speech.isBusy()).toBe(false);
});
it('manual editing freezes visible interim text without resetting the caret', () => {
  const { el, recognition, draft, speech } = setup();
  recognition.onresult?.({ results: [{ isFinal: false, 0: { transcript: 'Interim' } }] });
  const input = el.querySelector('textarea')!;
  input.value = draft();
  input.setSelectionRange(1, 4);
  input.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: 'x', bubbles: true }));
  expect(draft()).toBe('Original Interim');
  expect(input.selectionStart).toBe(1);
  expect(input.selectionEnd).toBe(4);
  expect(speech.isBusy()).toBe(false);
  expect(recognition.abort).toHaveBeenCalled();
});

it('starts recognition with one microphone click, without a start form', () => {
  const { el, recognition } = setup();
  expect(recognition.start).toHaveBeenCalledOnce();
  expect(el.querySelector('.agent-speech-details')).toBeNull();
});
it('offers one language selector directly in the compose toolbar', () => {
  const { el, recognition } = setup();
  recognition.onend?.();
  const selector = el.querySelector('r-select.agent-speech-language');
  expect(selector).not.toBeNull();
  expect(el.querySelector('button.agent-speech-language')).toBeNull();
  expect(el.querySelector('.agent-speech-language-picker')).toBeNull();
  expect(selector!.getAttribute('placement')).toBe('top');
  expect(selector!.getAttribute('aria-label')).toBe('agentSpeechLanguage');
});
it('keeps interim-only results when recognition ends', () => {
  const { recognition, draft } = setup();
  recognition.onresult?.({ results: [{ isFinal: false, 0: { transcript: 'Visible words' } }] });
  recognition.onend?.();
  expect(draft()).toBe('Original Visible words');
  recognition.onresult?.({ results: [{ isFinal: true, 0: { transcript: 'Late' } }] });
  expect(draft()).toBe('Original Visible words');
});

it('writes recognition results into the real composer and never sends automatically', () => {
  const onSend = vi.fn();
  const chat = new ComposerView({ onSend });
  document.body.append(chat.el);
  chat.setInput('Draft');
  mountSpeechInput(chat as unknown as ChatView, () => true);
  chat.el.querySelector<HTMLButtonElement>('.agent-speech-mic')!.click();
  const recognition = FakeRecognition.current;
  recognition.onresult?.({ results: [{ isFinal: false, 0: { transcript: 'spoken words' } }] });
  expect(chat.el.querySelector('textarea')!.value).toBe('Draft spoken words');
  recognition.onend?.();
  expect(chat.getInput()).toBe('Draft spoken words');
  expect(onSend).not.toHaveBeenCalled();
});
it('reports empty recognition instead of silently leaving the draft unchanged', () => {
  const { el, recognition, draft } = setup();
  recognition.onend?.();
  expect(el.querySelector('[role="status"]')!.textContent).toBe('agentSpeechNoResult');
  expect(draft()).toBe('Original');
});
it('keeps the chosen recognition language across subsequent microphone clicks', () => {
  const { el, recognition } = setup();
  recognition.onend?.();
  el.querySelector<HTMLButtonElement>('.agent-speech-language')!.click();
  const language = el.querySelector('r-select') as HTMLElement & { value: string };
  language.value = 'en-US';
  language.dispatchEvent(new Event('change'));
  el.querySelector<HTMLButtonElement>('.agent-speech-mic')!.click();
  expect(FakeRecognition.current.lang).toBe('en-US');
});
it('cleans up a recognition service that never finishes', () => {
  vi.useFakeTimers();
  try {
    const { el, recognition, speech } = setup();
    vi.advanceTimersByTime(60000);
    expect(speech.isBusy()).toBe(false);
    expect(recognition.abort).toHaveBeenCalled();
    expect(el.querySelector('[role="status"]')!.textContent).toBe('agentSpeechFailed');
  } finally {
    vi.useRealTimers();
  }
});

it('finishes dictation before an explicit send and includes the final result exactly once', async () => {
  const onSend = vi.fn();
  let speech: ReturnType<typeof mountSpeechInput>;
  const chat = new ComposerView({ onSend, beforeSend: () => speech.finish() });
  document.body.append(chat.el);
  speech = mountSpeechInput(chat, () => true);
  chat.el.querySelector<HTMLButtonElement>('.agent-speech-mic')!.click();
  const recognition = FakeRecognition.current;
  recognition.onresult?.({ results: [{ isFinal: false, 0: { transcript: 'interim' } }] });
  const send = chat.el.querySelector<HTMLButtonElement>('.cui-send')!;
  expect(send.disabled).toBe(false);
  send.click();
  expect(recognition.stop).toHaveBeenCalledOnce();
  expect(onSend).not.toHaveBeenCalled();
  expect(send.disabled).toBe(true);
  recognition.onresult?.({ results: [{ isFinal: true, 0: { transcript: 'Final words' } }] });
  recognition.onend?.();
  await vi.waitFor(() => expect(onSend).toHaveBeenCalledExactlyOnceWith('Final words'));
  recognition.onresult?.({ results: [{ isFinal: true, 0: { transcript: 'Late' } }] });
  expect(chat.getInput()).toBe('');
  chat.dispose();
});
it('cancelling dictation cancels an in-flight explicit send', async () => {
  const { speech, recognition, el, draft } = setup();
  recognition.onresult?.({ results: [{ isFinal: false, 0: { transcript: 'discard me' } }] });
  const finish = speech.finish();
  el.querySelector<HTMLButtonElement>('.agent-speech-cancel')!.click();
  await expect(finish).resolves.toBe(false);
  expect(draft()).toBe('Original');
});
it('bounds stop even when the recognition service never emits end', async () => {
  vi.useFakeTimers();
  try {
    const { speech, recognition, draft } = setup();
    recognition.onresult?.({ results: [{ isFinal: false, 0: { transcript: 'Keep visible text' } }] });
    const finish = speech.finish();
    await vi.advanceTimersByTimeAsync(2000);
    await expect(finish).resolves.toBe(true);
    expect(speech.isBusy()).toBe(false);
    expect(draft()).toBe('Original Keep visible text');
    expect(recognition.abort).toHaveBeenCalledOnce();
  } finally {
    vi.useRealTimers();
  }
});
it('releases recognition immediately on error without relying on end', () => {
  const { speech, recognition, el } = setup();
  recognition.onerror?.({ error: 'network' });
  expect(speech.isBusy()).toBe(false);
  expect(el.querySelector('[role="status"]')!.textContent).toBe('agentSpeechFailed');
});

it('editing while an explicit send is finishing cancels that send and preserves the edited draft', async () => {
  const onSend = vi.fn();
  let speech: ReturnType<typeof mountSpeechInput>;
  const chat = new ComposerView({ onSend, beforeSend: () => speech.finish() });
  document.body.append(chat.el);
  speech = mountSpeechInput(chat, () => true);
  chat.setInput('Draft');
  chat.el.querySelector<HTMLButtonElement>('.agent-speech-mic')!.click();
  const recognition = FakeRecognition.current;
  recognition.onresult?.({ results: [{ isFinal: false, 0: { transcript: 'spoken' } }] });
  const input = chat.el.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  expect(recognition.stop).toHaveBeenCalledOnce();
  input.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: 'x', bubbles: true }));
  chat.setInput('User correction');
  recognition.onresult?.({ results: [{ isFinal: true, 0: { transcript: 'Late transcript' } }] });
  recognition.onend?.();
  await Promise.resolve();
  expect(onSend).not.toHaveBeenCalled();
  expect(chat.getInput()).toBe('User correction');
  chat.dispose();
});

it('shows distinct microphone states and ignores a late start after requesting stop', () => {
  const { el, recognition } = setup();
  const root = el.querySelector<HTMLElement>('.agent-speech')!;
  expect(root.dataset.state).toBe('starting');
  recognition.onstart?.();
  expect(root.dataset.state).toBe('listening');
  root.querySelector<HTMLButtonElement>('.agent-speech-mic')!.click();
  expect(root.dataset.state).toBe('finishing');
  recognition.onstart?.();
  expect(root.dataset.state).toBe('finishing');
  expect(el.querySelector('[role="status"]')?.textContent).toBe('agentSpeechFinishing');
  recognition.onend?.();
  expect(root.dataset.state).toBe('idle');
});

it('keeps one toolbar and stable microphone nodes across every recognition state', () => {
  const chat = new ComposerView({ onSend: vi.fn() });
  document.body.append(chat.el);
  mountSpeechInput(chat, () => true);
  const root = chat.el.querySelector('.agent-speech')!;
  const feedback = chat.el.querySelector('.agent-speech-feedback')!;
  const mic = root.querySelector<HTMLButtonElement>('.agent-speech-mic')!;
  const icons = Array.from(mic.querySelectorAll('svg'));
  expect(feedback.parentElement).toBe(root);
  expect(icons).toHaveLength(2);
  mic.click();
  FakeRecognition.current.onstart?.();
  expect(Array.from(mic.querySelectorAll('svg'))).toEqual(icons);
  mic.click();
  expect(Array.from(mic.querySelectorAll('svg'))).toEqual(icons);
  FakeRecognition.current.onend?.();
  expect(Array.from(mic.querySelectorAll('svg'))).toEqual(icons);
  chat.dispose();
});

it('dismisses speech privacy with Escape before cancelling active dictation', () => {
  const { el, recognition, speech } = setup();
  recognition.onstart?.();
  const privacy = el.querySelector<HTMLElement>('.agent-speech-privacy')!;
  const toggle = privacy.querySelector<HTMLButtonElement>('button')!;
  privacy.setAttribute('open', '');
  toggle.focus();
  toggle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(privacy.hasAttribute('open')).toBe(false);
  expect(document.activeElement).toBe(toggle);
  expect(speech.isBusy()).toBe(true);
  expect(recognition.abort).not.toHaveBeenCalled();
  el.querySelector<HTMLButtonElement>('.agent-speech-mic')!.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
  );
  expect(speech.isBusy()).toBe(false);
});

it('closes the speech disclosure as soon as the language menu opens', () => {
  const { el, speech } = setup();
  const privacy = el.querySelector<HTMLElement>('.agent-speech-privacy')!;
  const language = el.querySelector<HTMLElement>('.agent-speech-language')!;
  expect(privacy.hasAttribute('open')).toBe(true);
  language.dispatchEvent(new Event('show'));
  expect(privacy.hasAttribute('open')).toBe(false);
  expect(speech.isBusy()).toBe(true);
});

it('closes the language menu when the speech disclosure opens', () => {
  const { el } = setup();
  const privacy = el.querySelector<HTMLElement>('.agent-speech-privacy')!;
  const language = el.querySelector<HTMLElement>('.agent-speech-language')!;
  privacy.removeAttribute('open');
  language.setAttribute('open', '');
  privacy.dispatchEvent(new Event('show'));
  expect(language.hasAttribute('open')).toBe(false);
});

it('expires the initial speech disclosure without ending listening', () => {
  vi.useFakeTimers();
  try {
    const { el, recognition, speech } = setup();
    recognition.onstart?.();
    const privacy = el.querySelector('r-popover.agent-speech-privacy')!;
    expect(privacy.hasAttribute('open')).toBe(true);
    vi.advanceTimersByTime(2999);
    expect(privacy.hasAttribute('open')).toBe(true);
    vi.advanceTimersByTime(1);
    expect(privacy.hasAttribute('open')).toBe(false);
    expect(speech.isBusy()).toBe(true);
    expect(recognition.stop).not.toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }
});
it('keeps the speech disclosure while hovered and grants three seconds after leaving', () => {
  vi.useFakeTimers();
  try {
    const { el } = setup();
    const privacy = el.querySelector('r-popover.agent-speech-privacy')!;
    privacy.dispatchEvent(new Event('pointerenter'));
    vi.advanceTimersByTime(10000);
    expect(privacy.hasAttribute('open')).toBe(true);
    privacy.dispatchEvent(new Event('pointerleave'));
    vi.advanceTimersByTime(3000);
    expect(privacy.hasAttribute('open')).toBe(false);
  } finally {
    vi.useRealTimers();
  }
});
it('keeps the speech disclosure while focused and clears its timeout when closing', () => {
  vi.useFakeTimers();
  try {
    const { el, speech } = setup();
    const privacy = el.querySelector('r-popover.agent-speech-privacy')!;
    privacy.querySelector<HTMLButtonElement>('button')!.focus();
    vi.advanceTimersByTime(10000);
    expect(privacy.hasAttribute('open')).toBe(true);
    speech.close();
    vi.advanceTimersByTime(10000);
    expect(privacy.hasAttribute('open')).toBe(false);
  } finally {
    vi.useRealTimers();
  }
});

it('expires the error popover but retains the error and a readable detail entry', () => {
  vi.useFakeTimers();
  try {
    const { el, recognition, draft } = setup();
    recognition.onerror?.({ error: 'not-allowed' });
    const privacy = el.querySelector('r-popover.agent-speech-privacy')!;
    expect(privacy.hasAttribute('open')).toBe(true);
    vi.advanceTimersByTime(3000);
    expect(privacy.hasAttribute('open')).toBe(false);
    expect(el.querySelector('[role="status"]')!.textContent).toBe('agentSpeechDenied');
    expect(privacy.querySelector('button')!.getAttribute('aria-label')).toBe('agentSpeechDenied');
    expect(draft()).toBe('Original');
  } finally {
    vi.useRealTimers();
  }
});

it.each(['end', 'timeout'] as const)('finishes healthy dictation at the duration limit (%s)', (ending) => {
  vi.useFakeTimers();
  try {
    const { el, recognition, speech, draft } = setup();
    recognition.onstart?.();
    vi.advanceTimersByTime(59000);
    recognition.onresult?.({ results: [{ isFinal: false, 0: { transcript: 'Visible words' } }] });
    vi.advanceTimersByTime(1000);
    expect(recognition.stop).toHaveBeenCalledOnce();
    expect(recognition.abort).not.toHaveBeenCalled();
    expect(speech.isBusy()).toBe(true);
    if (ending === 'end') {
      recognition.onresult?.({ results: [{ isFinal: true, 0: { transcript: 'Final words' } }] });
      recognition.onend?.();
    } else vi.advanceTimersByTime(2000);
    expect(speech.isBusy()).toBe(false);
    expect(draft()).toBe(ending === 'end' ? 'Original Final words' : 'Original Visible words');
    expect(el.querySelector('[role="status"]')!.textContent).toBe('agentSpeechLimit');
    el.querySelector<HTMLButtonElement>('.agent-speech-mic')!.click();
    expect(speech.isBusy()).toBe(true);
    expect(el.querySelector('[role="status"]')!.textContent).toBe('agentSpeechStarting');
    speech.close();
  } finally {
    vi.useRealTimers();
  }
});
