import { afterEach, expect, it, vi } from 'vitest';
import { ChatView } from '../../packages/chat-ui/src/chat-view';
const views: ChatView[] = [];
afterEach(() => {
  views.splice(0).forEach((view) => view.dispose());
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
function mount() {
  const view = new ChatView({ onSend: vi.fn() });
  views.push(view);
  document.body.append(view.el);
  const input = view.el.querySelector('textarea')!;
  const messages = view.el.querySelector<HTMLElement>('.cui-messages')!;
  Object.defineProperties(messages, {
    scrollHeight: { configurable: true, value: 1000 },
    clientHeight: { configurable: true, value: 200 },
  });
  messages.scrollTo = vi.fn();
  view.append({ role: 'agent', text: 'First answer' });
  return { view, input, messages };
}
it('restores composer selection without replacing the host draft or stealing outside focus', () => {
  const { view, input } = mount();
  view.setInput('a useful draft');
  input.focus();
  input.setSelectionRange(2, 8, 'backward');
  const snapshot = view.captureNavigation();
  const outside = document.createElement('button');
  document.body.append(outside);
  outside.focus();
  input.setSelectionRange(0, 0);
  view.restoreNavigation(snapshot);
  expect([input.selectionStart, input.selectionEnd, input.selectionDirection]).toEqual([2, 8, 'backward']);
  expect(document.activeElement).toBe(outside);
  view.restoreNavigation(snapshot, { focus: true });
  expect(document.activeElement).toBe(input);
});
it('does not apply an old caret to a changed draft or interfere with IME composition', () => {
  const { view, input } = mount();
  view.setInput('original');
  input.setSelectionRange(2, 5);
  const snapshot = view.captureNavigation();
  view.setInput('new');
  input.setSelectionRange(1, 1);
  view.restoreNavigation(snapshot, { focus: true });
  expect(input.selectionStart).toBe(1);
  view.setInput('original');
  input.setSelectionRange(1, 1);
  input.dispatchEvent(new Event('compositionstart'));
  view.restoreNavigation(snapshot, { focus: true });
  expect(input.selectionStart).toBe(1);
});
it('preserves reading position and stays detached from streamed growth after navigation', () => {
  const { view, messages } = mount();
  messages.scrollTop = 120;
  messages.dispatchEvent(new Event('scroll'));
  const snapshot = view.captureNavigation();
  messages.scrollTop = 0;
  view.restoreNavigation(snapshot);
  expect(messages.scrollTop).toBe(120);
  vi.mocked(messages.scrollTo).mockClear();
  view.append({ role: 'agent', text: 'New answer' });
  expect(messages.scrollTo).not.toHaveBeenCalled();
});
it('follows fresh content when the captured reader was at the end', () => {
  const { view, messages } = mount();
  const snapshot = view.captureNavigation();
  view.restoreNavigation(snapshot);
  expect(messages.scrollTo).toHaveBeenLastCalledWith({ top: 1000, behavior: 'auto' });
});
it('ignores unrelated transcript anchors instead of applying a stale scroll offset', () => {
  const { view, messages } = mount();
  messages.scrollTop = 120;
  messages.dispatchEvent(new Event('scroll'));
  const snapshot = view.captureNavigation();
  view.clear();
  view.append({ role: 'agent', text: 'Different conversation' });
  messages.scrollTop = 0;
  view.restoreNavigation(snapshot);
  expect(messages.scrollTop).toBe(0);
});
it('keeps a live reading anchor when streamed content changes while the view is hidden', () => {
  const { view, messages } = mount();
  view.appendDelta('Streaming response');
  view.endStream();
  messages.scrollTop = 120;
  messages.dispatchEvent(new Event('scroll'));
  const snapshot = view.captureNavigation();
  view.el.hidden = true;
  messages.scrollTop = 0;
  view.restoreNavigation(snapshot);
  expect(messages.scrollTop).toBe(0);
  view.el.hidden = false;
  view.restoreNavigation(snapshot);
  expect(messages.scrollTop).toBe(120);
});
it('does not move reading position when a saved anchor is missing from changed history', () => {
  const { view, messages } = mount();
  messages.scrollTop = 120;
  messages.dispatchEvent(new Event('scroll'));
  const snapshot = view.captureNavigation();
  view.restoreHistory([{ role: 'agent', text: 'New transcript' }]);
  messages.scrollTop = 0;
  view.restoreNavigation(snapshot);
  expect(messages.scrollTop).toBe(0);
});

it('returns focus to historical reading rather than the composer', () => {
  const { view, input, messages } = mount();
  messages.focus();
  const snapshot = view.captureNavigation();
  input.focus();
  view.restoreNavigation(snapshot, { focus: true });
  expect(document.activeElement).toBe(messages);
});
it('uses the visible row anchor after layout changes instead of its old absolute offset', () => {
  const { view, messages } = mount();
  const row = messages.querySelector<HTMLElement>('.cui-msg')!;
  let top = 20;
  vi.spyOn(row, 'getBoundingClientRect').mockImplementation(() => ({
    top,
    bottom: top + 100,
    height: 100,
    left: 0,
    right: 100,
    width: 100,
    x: 0,
    y: top,
    toJSON: () => ({}),
  }));
  messages.scrollTop = 120;
  messages.dispatchEvent(new Event('scroll'));
  const snapshot = view.captureNavigation();
  top = 70;
  messages.scrollTop = 120;
  view.restoreNavigation(snapshot);
  expect(messages.scrollTop).toBe(170);
});
it('restores the same live row after its source grows without jumping to the latest reply', async () => {
  const { view, messages } = mount();
  view.clear();
  view.appendDelta('A live response');
  await new Promise(requestAnimationFrame);
  messages.scrollTop = 120;
  messages.dispatchEvent(new Event('scroll'));
  const snapshot = view.captureNavigation();
  view.appendDelta(' grows later');
  await new Promise(requestAnimationFrame);
  view.endStream();
  messages.scrollTop = 0;
  view.restoreNavigation(snapshot);
  expect(messages.scrollTop).toBe(120);
  vi.mocked(messages.scrollTo).mockClear();
  view.appendDelta('Next streamed content');
  expect(messages.scrollTo).not.toHaveBeenCalled();
});
it('restores an already visited history window after rebuilding the same conversation', () => {
  const { view, messages } = mount();
  const history = Array.from({ length: 45 }, (_, index) => ({ role: 'agent' as const, text: `Answer ${index}` }));
  view.restoreHistory(history);
  view.el.querySelector<HTMLButtonElement>('.cui-load-earlier')!.click();
  messages.scrollTop = 120;
  messages.dispatchEvent(new Event('scroll'));
  const snapshot = view.captureNavigation();
  view.restoreHistory(history);
  expect(view.el.querySelectorAll('.cui-msg')).toHaveLength(40);
  view.restoreNavigation(snapshot);
  expect(view.el.querySelectorAll('.cui-msg')).toHaveLength(45);
  expect(messages.scrollTop).toBe(120);
});
it('does not restore disposed or zero-height views', () => {
  const { view, input, messages } = mount();
  view.setInput('draft');
  input.setSelectionRange(1, 3);
  const snapshot = view.captureNavigation();
  input.setSelectionRange(0, 0);
  Object.defineProperty(messages, 'clientHeight', { configurable: true, value: 0 });
  view.restoreNavigation(snapshot, { focus: true });
  expect(input.selectionEnd).toBe(0);
  Object.defineProperty(messages, 'clientHeight', { configurable: true, value: 200 });
  view.dispose();
  view.restoreNavigation(snapshot, { focus: true });
  expect(input.selectionEnd).toBe(0);
});
it('restores the scroll position inside a long composer draft', () => {
  const { view, input } = mount();
  view.setInput('long draft\n'.repeat(50));
  input.scrollTop = 80;
  const snapshot = view.captureNavigation();
  input.scrollTop = 0;
  view.restoreNavigation(snapshot);
  expect(input.scrollTop).toBe(80);
});
it('keeps active IME focus when restoring a snapshot captured from historical reading', () => {
  const { view, input, messages } = mount();
  view.setInput('正在输入');
  messages.focus();
  const snapshot = view.captureNavigation();
  input.focus();
  input.setSelectionRange(1, 2);
  input.dispatchEvent(new Event('compositionstart'));
  view.restoreNavigation(snapshot, { focus: true });
  expect(document.activeElement).toBe(input);
  expect([input.selectionStart, input.selectionEnd]).toEqual([1, 2]);
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  expect(view.getInput()).toBe('正在输入');
  input.dispatchEvent(new Event('compositionend'));
});
