import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ChatView } from '../../packages/chat-ui/src/chat-view';
import * as markdown from '../../packages/chat-ui/src/markdown';
import { MarkdownPresentation } from '../../packages/chat-ui/src/markdown-presentation';

let view: ChatView;
let frames: FrameRequestCallback[];
beforeEach(() => {
  vi.useFakeTimers();
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  HTMLElement.prototype.scrollTo = vi.fn();
  document.body.replaceChildren();
});
afterEach(() => {
  view?.dispose();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('acknowledges Stop once, freezes 100 KB of source without parsing, and retains the next draft until settlement', async () => {
  const stop = vi.fn();
  const send = vi.fn();
  view = new ChatView({
    onSend: send,
    onStop: stop,
    onApplyMessage: async () => 'verified',
    labels: { stopping: 'Stopping…' },
  });
  document.body.append(view.el);
  view.setRunning(true);
  const source = '**partial**\n'.repeat(9000);
  view.appendDelta(source, { documentArtifact: true });
  view.setInput('My next request');
  view.focus();
  const input = view.el.querySelector('textarea')!;
  input.setSelectionRange(3, 7);
  const parse = vi.spyOn(markdown, 'renderMarkdown');
  const button = view.el.querySelector<HTMLButtonElement>('.cui-send')!;
  button.click();
  button.click();
  view.requestStop();
  expect(stop).toHaveBeenCalledOnce();
  expect(parse).not.toHaveBeenCalled();
  expect(button.disabled).toBe(true);
  expect(button.getAttribute('aria-label')).toBe('Stopping…');
  expect(view.el.querySelector('.cui-status')?.textContent).toBe('Stopping…');
  expect(view.el.querySelector('.cui-elapsed')?.textContent).toBe('');
  expect(view.el.querySelector('.cui-messages')?.getAttribute('aria-busy')).toBe('true');
  const row = view.el.querySelector<HTMLElement>('[data-interrupted]')!;
  expect(row.dataset.source).toBe(source);
  expect(row.querySelector('.cui-apply')).toBeNull();
  expect(row.querySelector('.cui-bubble')?.textContent).toBe(source);
  expect(row.querySelector('.cui-copy')).not.toBeNull();
  expect(view.getLastDocumentBody()).toBe('');
  view.appendDelta('late delta');
  view.endStream();
  expect(parse).not.toHaveBeenCalled();
  expect(row.dataset.source).toBe(source);
  expect(document.activeElement).toBe(input);
  expect([input.selectionStart, input.selectionEnd]).toEqual([3, 7]);
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  expect(send).not.toHaveBeenCalled();
  expect(view.getInput()).toBe('My next request');
  frames.splice(0).forEach((frame) => frame(16));
  expect(parse).not.toHaveBeenCalled();
  await vi.runOnlyPendingTimersAsync();
  expect(parse).toHaveBeenCalledExactlyOnceWith(
    row.querySelector('.cui-bubble'),
    source,
    expect.any(MarkdownPresentation),
  );
  view.setRunning(false);
  expect(button.disabled).toBe(false);
  expect(view.getInput()).toBe('My next request');
});

it.each(['clear', 'dispose'] as const)('does not parse detached interrupted output after %s', async (action) => {
  view = new ChatView({ onSend: vi.fn() });
  document.body.append(view.el);
  view.setRunning(true);
  view.appendDelta('**old**');
  const parse = vi.spyOn(markdown, 'renderMarkdown');
  view.requestStop();
  view[action]();
  frames.splice(0).forEach((frame) => frame(16));
  await vi.runOnlyPendingTimersAsync();
  expect(parse).not.toHaveBeenCalled();
});

it('formats only the captured interrupted row after another stream has started and returns button focus to the draft', async () => {
  view = new ChatView({ onSend: vi.fn() });
  document.body.append(view.el);
  view.setRunning(true);
  view.appendDelta('**old**');
  const old = view.el.querySelector('.cui-msg-agent')!;
  view.el.querySelector<HTMLButtonElement>('.cui-send')!.focus();
  view.requestStop();
  expect(document.activeElement).toBe(view.el.querySelector('textarea'));
  view.setRunning(false);
  view.setRunning(true);
  view.appendDelta('**new**');
  const live = view.el.querySelector('.cui-streaming')!;
  frames.splice(0).forEach((frame) => frame(16));
  await vi.runOnlyPendingTimersAsync();
  expect(old.querySelector('strong')?.textContent).toBe('old');
  expect(live.querySelector('strong')).toBeNull();
  expect(live.textContent).toContain('**new**');
  view.endStream();
  expect(live.querySelector('strong')?.textContent).toBe('new');
});

it('keeps cancellation busy and its acknowledgement stable through late host phases and locale changes', () => {
  view = new ChatView({ onSend: vi.fn() });
  document.body.append(view.el);
  view.setRunning(true);
  view.setActivity('reviewing');
  view.requestStop();
  const messages = view.el.querySelector('.cui-messages')!;
  expect(messages.getAttribute('aria-busy')).toBe('true');
  view.setActivity('reviewing');
  view.setRunning(true);
  view.setLabels({ stopping: 'Wird angehalten…' });
  expect(messages.getAttribute('aria-busy')).toBe('true');
  expect(view.el.dataset.activity).toBe('stopping');
  expect(view.el.querySelector('.cui-status')?.textContent).toBe('Wird angehalten…');
  expect(view.el.querySelector<HTMLButtonElement>('.cui-send')?.disabled).toBe(true);
  view.setRunning(false);
  expect(messages.getAttribute('aria-busy')).toBe('false');
});
