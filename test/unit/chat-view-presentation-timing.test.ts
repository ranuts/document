import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ChatView } from '../../packages/chat-ui/src/chat-view';
let frames: FrameRequestCallback[];
let view: ChatView;
let rect: DOMRect;
let visibleText = true;
const ranges: Array<[number, number]> = [];
beforeEach(() => {
  frames = [];
  ranges.length = 0;
  visibleText = true;
  rect = new DOMRect(0, 0, 200, 200);
  HTMLElement.prototype.scrollTo = vi.fn();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(() => rect);
  vi.spyOn(document, 'createRange').mockImplementation(() => {
    let start = 0;
    return {
      setStart: (_node: Node, offset: number) => {
        start = offset;
      },
      setEnd: (_node: Node, offset: number) => {
        ranges.push([start, offset]);
      },
      getClientRects: () => (visibleText ? [new DOMRect(1, 1, 60, 20)] : []),
    } as unknown as Range;
  });
  view = new ChatView({ onSend: vi.fn(), streamingMarkdown: true });
  document.body.append(view.el);
});
afterEach(() => {
  view.dispose();
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const flush = () => frames.splice(0).forEach((frame) => frame(1));
it('reports actual visible DOM after follow layout, not appendDelta buffering, once per owner', () => {
  const presented = vi.fn();
  view.observePresentation(presented);
  view.appendDelta('Visible answer');
  expect(presented).not.toHaveBeenCalled();
  flush();
  expect(presented).toHaveBeenCalledOnce();
  view.appendDelta(' more');
  flush();
  view.endStream();
  expect(presented).toHaveBeenCalledOnce();
});
it('observes synchronous nonstream append and final endStream before the host settles', () => {
  const append = vi.fn();
  view.observePresentation(append);
  view.append({ role: 'agent', text: 'Answer' });
  expect(append).toHaveBeenCalledOnce();
  const final = vi.fn();
  view.observePresentation(final);
  view.appendDelta('Final answer');
  view.endStream();
  expect(final).toHaveBeenCalledOnce();
});
it.each(['hidden', 'detached', 'offscreen', 'no-text-rect'] as const)('leaves %s presentation absent', (state) => {
  if (state === 'hidden') vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  if (state === 'detached') view.el.remove();
  if (state === 'offscreen') rect = new DOMRect(0, 2000, 200, 200);
  if (state === 'no-text-rect') visibleText = false;
  const presented = vi.fn();
  view.observePresentation(presented);
  view.appendDelta('Answer');
  flush();
  view.endStream();
  expect(presented).not.toHaveBeenCalled();
});
it.each(['clear', 'dispose', 'stop'] as const)('invalidates pending presentation on %s', (method) => {
  view.setRunning(true);
  const stale = vi.fn();
  view.observePresentation(stale);
  view.appendDelta('Old answer');
  if (method === 'stop') view.requestStop();
  else view[method]();
  flush();
  expect(stale).not.toHaveBeenCalled();
});
it('replaces ownership and limits text measurement even on a giant raw answer', () => {
  const stale = vi.fn();
  const current = vi.fn();
  view.observePresentation(stale);
  view.appendDelta('Old');
  view.observePresentation(current);
  view.endStream();
  expect(current).not.toHaveBeenCalled();
  view.appendDelta('x'.repeat(108_000));
  flush();
  expect(stale).not.toHaveBeenCalled();
  expect(current).toHaveBeenCalledOnce();
  expect(ranges.every(([start, end]) => end - start <= 64)).toBe(true);
  expect(ranges.length).toBeLessThanOrEqual(16);
});

it.each(['queued-frame', 'completion', 'completion-then-frame', 'continued-old-stream'] as const)(
  'does not present old stream content to a replacement observer through %s',
  (action) => {
    const old = vi.fn();
    const current = vi.fn();
    view.observePresentation(old);
    view.appendDelta('Old request output');
    const originalRow = view.el.querySelector('.cui-msg-agent');
    view.observePresentation(current);
    if (action === 'continued-old-stream') view.appendDelta(' continued');
    if (action === 'completion' || action === 'completion-then-frame') view.endStream();
    if (action !== 'completion') flush();
    expect(old).not.toHaveBeenCalled();
    expect(current).not.toHaveBeenCalled();
    expect(view.el.querySelector('.cui-msg-agent')).toBe(originalRow);
    expect(originalRow?.querySelector('.cui-bubble')?.textContent).toBe(
      action === 'continued-old-stream' ? 'Old request output continued' : 'Old request output',
    );
  },
);

it.each([true, false])('waits for a new stream when rearming the same callback (Markdown %s)', (streamingMarkdown) => {
  view.dispose();
  view.el.remove();
  view = new ChatView({ onSend: vi.fn(), streamingMarkdown });
  document.body.append(view.el);
  const presented = vi.fn();
  view.observePresentation(presented);
  view.appendDelta('Old request');
  view.observePresentation(presented);
  view.endStream();
  flush();
  expect(presented).not.toHaveBeenCalled();
  view.appendDelta('Current request');
  flush();
  expect(presented).toHaveBeenCalledOnce();
  view.endStream();
  expect([...view.el.querySelectorAll<HTMLElement>('.cui-msg-agent')].map((row) => row.dataset.source)).toEqual([
    'Old request',
    'Current request',
  ]);
});

it('does not adopt a previously flushed stream when its late tail or completion arrives', () => {
  const old = vi.fn();
  const current = vi.fn();
  view.observePresentation(old);
  view.appendDelta('Already presented');
  flush();
  expect(old).toHaveBeenCalledOnce();
  view.observePresentation(current);
  view.appendDelta(' late old tail');
  flush();
  view.endStream();
  expect(current).not.toHaveBeenCalled();
  expect(view.getLastAnswer()).toBe('Already presented late old tail');
  view.append({ role: 'agent', text: 'New completed request' });
  expect(current).toHaveBeenCalledOnce();
});

it('keeps provider-boundary, filtered and actual frame presentation clocks distinct end to end', async () => {
  const { createRequestTiming } = await import('../../lib/agent-plugin/ui/request-timing');
  const { AgentChatController } = await import('../../lib/agent-plugin/ui/controller');
  let now = 10;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  const timing = createRequestTiming();
  view.observePresentation(() => timing.presented());
  let finish!: () => void;
  const controller = new AgentChatController(
    {
      name: 'test',
      isReady: () => true,
      chat: async () => {
        throw new Error('Unused');
      },
      chatStream: async (_messages, _tools, delta) => {
        now = 20;
        delta('<think>Hidden');
        now = 40;
        delta('</think>Answer');
        await new Promise<void>((resolve) => {
          finish = resolve;
        });
        return {
          text: 'Answer',
          toolCalls: [],
          stopReason: 'stop',
          assistant: { role: 'assistant', content: 'Answer' },
        };
      },
    },
    (turn) => {
      view.append(turn);
    },
    { onAgentDelta: (delta) => view.appendDelta(delta), onAgentStreamEnd: () => view.endStream() },
  );
  const run = controller.send('Hello', { timing });
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
  now = 60;
  flush();
  now = 80;
  finish();
  await run;
  expect(timing.finish('success')).toMatchObject({
    firstProviderTextMs: 10,
    firstFilteredTextMs: 30,
    firstPresentedTextMs: 50,
  });
});

it.each(['opacity', 'display'] as const)(
  'does not mark text presented under an ancestor with invisible %s',
  (property) => {
    const ancestor = document.createElement('div');
    ancestor.style[property] = property === 'opacity' ? '0' : 'none';
    ancestor.append(view.el);
    document.body.append(ancestor);
    const presented = vi.fn();
    view.observePresentation(presented);
    view.appendDelta('Answer');
    flush();
    expect(presented).not.toHaveBeenCalled();
    ancestor.style[property] = '';
    view.appendDelta(' visible now');
    flush();
    expect(presented).toHaveBeenCalledOnce();
  },
);

it('uses native visibility checks including ancestor opacity before probing text', () => {
  const presented = vi.fn();
  view.observePresentation(presented);
  view.appendDelta('Answer');
  const checkVisibility = vi.fn().mockReturnValueOnce(false).mockReturnValue(true);
  Object.defineProperty(view.el.querySelector('.cui-bubble')!, 'checkVisibility', { value: checkVisibility });
  flush();
  expect(presented).not.toHaveBeenCalled();
  expect(ranges).toHaveLength(0);
  expect(checkVisibility).toHaveBeenCalledWith({
    opacityProperty: true,
    visibilityProperty: true,
    contentVisibilityAuto: true,
  });
  view.endStream();
  expect(presented).toHaveBeenCalledOnce();
});

it('leaves deeply nested fallback visibility unobserved rather than scanning an unbounded ancestor tree', () => {
  let child: HTMLElement = view.el;
  for (let index = 0; index < 20; index++) {
    const parent = document.createElement('div');
    parent.append(child);
    child = parent;
  }
  document.body.append(child);
  const presented = vi.fn();
  view.observePresentation(presented);
  view.appendDelta('Answer');
  const computed = vi.spyOn(globalThis, 'getComputedStyle');
  flush();
  expect(presented).not.toHaveBeenCalled();
  expect(computed.mock.calls.length).toBeLessThanOrEqual(16);
});
