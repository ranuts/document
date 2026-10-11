import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ChatView } from '../../packages/chat-ui/src/chat-view';

let resize: ResizeObserverCallback;
let frames: FrameRequestCallback[];
const disconnect = vi.fn();
beforeEach(() => {
  document.body.replaceChildren();
  HTMLElement.prototype.scrollTo = vi.fn();
  disconnect.mockClear();
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: ResizeObserverCallback) {
        resize = callback;
      }
      observe() {}
      unobserve() {}
      disconnect = disconnect;
    },
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function mount() {
  const view = new ChatView({ onSend: vi.fn() });
  document.body.append(view.el);
  const input = view.el.querySelector('textarea')!;
  const messages = view.el.querySelector<HTMLElement>('.cui-messages')!;
  return { view, input, messages };
}
function resizeEntry(target: Element, width: number): ResizeObserverEntry {
  return {
    target,
    contentRect: new DOMRectReadOnly(0, 0, width, 0),
    borderBoxSize: [],
    contentBoxSize: [],
    devicePixelContentBoxSize: [],
  };
}
function resized(target: Element, width: number) {
  resize([resizeEntry(target, width)], {} as ResizeObserver);
  frames.splice(0).forEach((callback) => callback(0));
}
it('defers dimension writes until after the resize notification to avoid observer loops', () => {
  const { view, input } = mount();
  Object.defineProperty(input, 'scrollHeight', { configurable: true, value: 70 });
  view.setInput('Draft');
  Object.defineProperty(input, 'scrollHeight', { configurable: true, value: 300 });
  resize([resizeEntry(input, 280)], {} as ResizeObserver);
  expect(input.style.height).toBe('70px');
  frames.splice(0).forEach((callback) => callback(0));
  expect(input.style.height).toBe('160px');
});
it('reflows the same draft when the sidebar width changes and caps long input', () => {
  const { view, input } = mount();
  Object.defineProperty(input, 'scrollHeight', { configurable: true, value: 70 });
  view.setInput('A draft that wraps at a narrow width.');
  expect(input.style.height).toBe('70px');
  Object.defineProperty(input, 'scrollHeight', { configurable: true, value: 300 });
  resized(input, 280);
  expect(input.style.height).toBe('160px');
  expect(input.value).toBe('A draft that wraps at a narrow width.');
  Object.defineProperty(input, 'scrollHeight', { configurable: true, value: 50 });
  resized(input, 480);
  expect(input.style.height).toBe('50px');
});
it.each([true, false])('resize follows only a reader already at the end: %s', (atEnd) => {
  const { view, messages } = mount();
  view.append({ role: 'agent', text: 'A long answer' });
  Object.defineProperties(messages, {
    scrollHeight: { configurable: true, value: 1000 },
    clientHeight: { configurable: true, value: 200 },
  });
  messages.scrollTop = atEnd ? 800 : 100;
  messages.dispatchEvent(new Event('scroll'));
  vi.mocked(messages.scrollTo).mockClear();
  Object.defineProperty(messages, 'clientHeight', { configurable: true, value: 100 });
  // Browsers can fire scroll before ResizeObserver when the composer changes the viewport.
  messages.dispatchEvent(new Event('scroll'));
  resized(messages, 320);
  if (atEnd) expect(messages.scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'auto' });
  else {
    expect(messages.scrollTo).not.toHaveBeenCalled();
    expect(messages.scrollTop).toBe(100);
  }
});
it.each(['delta', 'message', 'completion', 'review'] as const)(
  'preserves following when %s arrives between reflow and its scheduled frame',
  (arrival) => {
    const { view, messages } = mount();
    view.appendDelta('First');
    Object.defineProperties(messages, {
      scrollHeight: { configurable: true, value: 1000 },
      clientHeight: { configurable: true, value: 200 },
    });
    messages.scrollTop = 800;
    messages.dispatchEvent(new Event('scroll'));
    Object.defineProperty(messages, 'clientHeight', { configurable: true, value: 100 });
    messages.dispatchEvent(new Event('scroll'));
    resize([resizeEntry(messages, 320)], {} as ResizeObserver);
    vi.mocked(messages.scrollTo).mockClear();
    if (arrival === 'delta') view.appendDelta(' streamed');
    else if (arrival === 'message') view.append({ role: 'status', text: 'Done' });
    else if (arrival === 'completion') view.endStream();
    else view.appendContent(document.createElement('section'));
    frames.splice(0).forEach((callback) => callback(0));
    expect(messages.scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'auto' });
    view.dispose();
  },
);
it('honors scrolling into history before a pending resize frame and the next streamed delta', () => {
  const { view, messages } = mount();
  view.appendDelta('First');
  Object.defineProperties(messages, {
    scrollHeight: { configurable: true, value: 1000 },
    clientHeight: { configurable: true, value: 200 },
  });
  messages.scrollTop = 800;
  messages.dispatchEvent(new Event('scroll'));
  Object.defineProperty(messages, 'clientHeight', { configurable: true, value: 100 });
  messages.dispatchEvent(new Event('scroll'));
  resize([resizeEntry(messages, 320)], {} as ResizeObserver);
  messages.scrollTop = 100;
  messages.dispatchEvent(new Event('scroll'));
  vi.mocked(messages.scrollTo).mockClear();
  view.appendDelta(' streamed');
  frames.splice(0).forEach((callback) => callback(0));
  expect(messages.scrollTo).not.toHaveBeenCalled();
  expect(messages.scrollTop).toBe(100);
  view.dispose();
});
it('copy feedback restores the icon label, can retry, and does not replace running activity', async () => {
  vi.useFakeTimers();
  const writeText = vi.fn().mockRejectedValueOnce(new Error('Denied')).mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  const { view } = mount();
  view.append({ role: 'agent', text: '**Source**' });
  view.setRunning(true);
  view.setActivity('reading');
  const copy = view.el.querySelector<HTMLButtonElement>('.cui-copy')!;
  copy.click();
  await Promise.resolve();
  expect(copy.getAttribute('aria-label')).toBe('Could not copy');
  expect(copy.disabled).toBe(false);
  copy.click();
  await Promise.resolve();
  expect(copy.getAttribute('aria-label')).toBe('Copied');
  expect(writeText).toHaveBeenLastCalledWith('**Source**');
  expect(view.el.querySelector('.cui-status')?.textContent).toBe('Reading content…');
  expect(view.el.querySelector('.cui-feedback')?.getAttribute('role')).toBe('status');
  await vi.advanceTimersByTimeAsync(2000);
  expect(copy.getAttribute('aria-label')).toBe('Copy');
  expect(copy.querySelector('svg')).not.toBeNull();
  view.dispose();
});
it('disposes observers and discards clipboard completions after unmount', async () => {
  let finish!: () => void;
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: () => new Promise<void>((resolve) => (finish = resolve)) },
  });
  const { view, messages } = mount();
  view.append({ role: 'agent', text: 'Source' });
  view.el.querySelector<HTMLButtonElement>('.cui-copy')!.click();
  view.dispose();
  finish();
  await Promise.resolve();
  expect(disconnect).toHaveBeenCalledOnce();
  expect(view.el.querySelector('.cui-feedback')?.textContent).toBe('');
  vi.mocked(messages.scrollTo).mockClear();
  resized(messages, 320);
  expect(messages.scrollTo).not.toHaveBeenCalled();
});
