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
