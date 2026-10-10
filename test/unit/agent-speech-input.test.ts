import { afterEach, expect, it, vi } from 'vitest';
import { mountSpeechInput } from '../../lib/agent-plugin/ui/speech-input';
import type { ChatView } from '@ranuts/chat-ui';
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
  (el.querySelector('.agent-speech-details button') as HTMLButtonElement).click();
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
  expect(draft()).toBe('Original 你好');
  expect(speech.isBusy()).toBe(false);
});
it('cancel preserves the exact draft and ignores late results', () => {
  const { el, recognition, draft, speech } = setup();
  (el.querySelectorAll('.agent-speech-details button')[1] as HTMLButtonElement).click();
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
