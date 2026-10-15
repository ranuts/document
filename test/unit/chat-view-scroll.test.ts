import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ChatView } from '../../packages/chat-ui/src/chat-view';

let frames: Map<number, FrameRequestCallback>;
let frameId: number;
let resize: ResizeObserverCallback;
let views: ChatView[];
beforeEach(() => {
  document.body.replaceChildren();
  frames = new Map();
  frameId = 0;
  views = [];
  HTMLElement.prototype.scrollTo = vi.fn();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: ResizeObserverCallback) {
        resize = callback;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
});
afterEach(() => {
  views.forEach((view) => view.dispose());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function flush() {
  const callbacks = [...frames.values()];
  frames.clear();
  callbacks.forEach((callback) => callback(16));
}
function mount() {
  const view = new ChatView({ onSend: vi.fn() });
  views.push(view);
  document.body.append(view.el);
  view.append({ role: 'agent', text: 'Older answer' });
  const messages = view.el.querySelector<HTMLElement>('.cui-messages')!;
  let height = 1200;
  Object.defineProperties(messages, {
    scrollHeight: { configurable: true, get: () => height },
    clientHeight: { configurable: true, value: 200 },
  });
  const move = (top: number) => {
    messages.scrollTop = top;
    messages.dispatchEvent(new Event('scroll'));
  };
  move(0);
  vi.mocked(messages.scrollTo).mockClear();
  const jump = () => view.el.querySelector<HTMLButtonElement>('.cui-scroll-bottom')!.click();
  const grow = (next: number) => {
    height = next;
  };
  return { view, messages, move, jump, grow };
}
it('retains smooth jump intent through native progress and retargets streamed growth without snapping', () => {
  const { view, messages, move, jump, grow } = mount();
  jump();
  expect(messages.scrollTo).toHaveBeenLastCalledWith({ top: 1200, behavior: 'smooth' });
  move(1);
  view.appendDelta('New streamed output');
  grow(1600);
  flush();
  expect(messages.scrollTo).toHaveBeenLastCalledWith({ top: 1600, behavior: 'smooth' });
  expect(
    vi.mocked(messages.scrollTo).mock.calls.every(([options]) => (options as ScrollToOptions).behavior === 'smooth'),
  ).toBe(true);
});
it('does not settle an old scrollend above the current target and follows after actual arrival', () => {
  const { view, messages, move, jump, grow } = mount();
  jump();
  grow(1600);
  resize([], {} as ResizeObserver);
  flush();
  move(1000);
  messages.dispatchEvent(new Event('scrollend'));
  expect(messages.scrollTo).toHaveBeenLastCalledWith({ top: 1600, behavior: 'smooth' });
  move(1400);
  messages.dispatchEvent(new Event('scrollend'));
  grow(1800);
  view.append({ role: 'agent', text: 'More output' });
  expect(messages.scrollTo).toHaveBeenLastCalledWith({ top: 1800, behavior: 'auto' });
});
it('settles on measured bottom arrival without scrollend or polling', () => {
  const { view, messages, move, jump, grow } = mount();
  jump();
  move(1000);
  expect(frames.size).toBe(0);
  grow(1600);
  view.append({ role: 'agent', text: 'After arrival' });
  expect(messages.scrollTo).toHaveBeenLastCalledWith({ top: 1600, behavior: 'auto' });
});
it('ignores nested scrollend instead of settling the transcript animation', () => {
  const { view, messages, jump, grow } = mount();
  jump();
  messages.scrollTop = 1000;
  messages.querySelector('.cui-bubble')!.dispatchEvent(new Event('scrollend', { bubbles: true }));
  grow(1600);
  view.append({ role: 'agent', text: 'Growth' });
  expect(messages.scrollTo).toHaveBeenLastCalledWith({ top: 1600, behavior: 'smooth' });
});
it.each(['wheel', 'touchmove', 'keydown'] as const)(
  'cancels actual native motion on %s and ignores stale events and resize',
  (type) => {
    const { view, messages, move, jump, grow } = mount();
    jump();
    move(250);
    messages.dispatchEvent(
      type === 'keydown'
        ? new KeyboardEvent(type, { key: 'PageUp' })
        : type === 'wheel'
          ? new WheelEvent(type, { deltaY: -100 })
          : new Event(type),
    );
    expect(messages.scrollTo).toHaveBeenLastCalledWith({ top: 250, behavior: 'instant' });
    vi.mocked(messages.scrollTo).mockClear();
    // Old native delivery has no authority to reattach even if an offset is near the floor.
    move(1000);
    messages.dispatchEvent(new Event('scrollend'));
    grow(1600);
    resize([], {} as ResizeObserver);
    view.appendDelta('Still reading earlier output');
    flush();
    expect(messages.scrollTo).not.toHaveBeenCalled();
    jump();
    expect(messages.scrollTo).toHaveBeenLastCalledWith({ top: 1600, behavior: 'smooth' });
  },
);
it('retains ordinary near-bottom following outside a canceled native animation', () => {
  const { view, messages, move, grow } = mount();
  move(980);
  grow(1600);
  view.append({ role: 'agent', text: 'Normal output' });
  expect(messages.scrollTo).toHaveBeenLastCalledWith({ top: 1600, behavior: 'auto' });
});
it('allows a fresh reader gesture to restore ordinary near-bottom following after interruption', () => {
  const { view, messages, move, jump, grow } = mount();
  jump();
  move(250);
  messages.dispatchEvent(new WheelEvent('wheel', { deltaY: -100 }));
  messages.dispatchEvent(new WheelEvent('wheel', { deltaY: 100 }));
  move(980);
  grow(1600);
  view.append({ role: 'agent', text: 'Following again' });
  expect(messages.scrollTo).toHaveBeenLastCalledWith({ top: 1600, behavior: 'auto' });
});
it('does not treat typing or a nested editable navigation key as transcript scrolling', () => {
  const { messages, move, jump } = mount();
  jump();
  move(250);
  vi.mocked(messages.scrollTo).mockClear();
  messages.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
  const editor = document.createElement('textarea');
  messages.append(editor);
  editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
  expect(messages.scrollTo).not.toHaveBeenCalled();
});
it.each(['pointerdown', 'mousedown'] as const)('cancels a native jump before an own-scrollbar %s drag', (type) => {
  if (type === 'mousedown') vi.stubGlobal('PointerEvent', undefined);
  const { view, messages, move, jump, grow } = mount();
  jump();
  move(250);
  messages.dispatchEvent(new Event(type, { bubbles: true }));
  expect(messages.scrollTo).toHaveBeenLastCalledWith({ top: 250, behavior: 'instant' });
  // A compatibility mouse event from the same pointer must not release cancellation.
  if (type === 'pointerdown') messages.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  vi.mocked(messages.scrollTo).mockClear();
  move(1000);
  messages.dispatchEvent(new Event('scrollend'));
  grow(1600);
  resize([], {} as ResizeObserver);
  view.appendDelta('After scrollbar drag');
  flush();
  expect(messages.scrollTo).not.toHaveBeenCalled();
  jump();
  expect(messages.scrollTo).toHaveBeenLastCalledWith({ top: 1600, behavior: 'smooth' });
});
it('does not interpret pointer events on nested transcript controls as scrollbar intent', () => {
  const { view, messages, move, jump, grow } = mount();
  jump();
  move(250);
  messages.querySelector('.cui-copy')!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
  messages.querySelector('.cui-copy')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  grow(1600);
  view.append({ role: 'agent', text: 'Still following' });
  expect(messages.scrollTo).toHaveBeenLastCalledWith({ top: 1600, behavior: 'smooth' });
});
it('uses an immediate jump for reduced motion', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  const { view, messages, jump, grow } = mount();
  jump();
  expect(messages.scrollTo).toHaveBeenLastCalledWith({ top: 1200, behavior: 'auto' });
  grow(1600);
  view.append({ role: 'agent', text: 'Immediate follow' });
  expect(messages.scrollTo).toHaveBeenLastCalledWith({ top: 1600, behavior: 'auto' });
});
it.each(['clear', 'dispose'] as const)('resets native ownership and pending layout on %s', (method) => {
  const { view, messages, jump } = mount();
  jump();
  view.appendDelta('Pending');
  view[method]();
  vi.mocked(messages.scrollTo).mockClear();
  messages.dispatchEvent(new Event('scrollend'));
  messages.dispatchEvent(new Event('scroll'));
  flush();
  expect(messages.scrollTo).not.toHaveBeenCalled();
  if (method === 'clear') {
    view.append({ role: 'user', text: 'New owner' });
    expect(messages.scrollTo).toHaveBeenLastCalledWith({ top: 1200, behavior: 'auto' });
  }
});
