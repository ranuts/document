import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Reasoning } from 'ranui/reasoning';
import type { DisclosureRow } from 'ranui/disclosure-row';
import { ChatView } from '../../packages/chat-ui/src/chat-view';

let view: ChatView;
let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;
const flush = () => {
  const pending = [...frames.values()];
  frames.clear();
  for (const callback of pending) callback(16);
};
const rows = () => [...view.el.querySelectorAll<Reasoning>('r-reasoning')];
// ranui documents _shadowDom as its closed-root testing seam (ranui/testing).
// Production code uses only public Reasoning properties and composed events.
const toggle = (reasoning: Reasoning) =>
  reasoning._shadowDom
    .querySelector<DisclosureRow>('r-disclosure-row')!
    ._shadowDom.querySelector<HTMLElement>('[role="button"]')!;

beforeEach(() => {
  frames = new Map();
  nextFrame = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  HTMLElement.prototype.scrollTo = vi.fn();
  document.body.replaceChildren();
  view = new ChatView({ onSend: vi.fn(), streamingMarkdown: true });
  document.body.append(view.el);
});
afterEach(() => {
  view.dispose();
  vi.unstubAllGlobals();
});

it('creates native reasoning only for real running output and batches content without model timing', () => {
  view.appendReasoningDelta('ignored while idle');
  view.setRunning(true);
  view.appendReasoningDelta('');
  expect(rows()).toHaveLength(0);
  for (let index = 0; index < 1000; index++) view.appendReasoningDelta('word ');
  expect(rows()).toHaveLength(1);
  const reasoning = rows()[0];
  expect(reasoning.streaming).toBe(true);
  expect(reasoning.open).toBe(true);
  expect(reasoning.content).toBe('');
  expect(frames.size).toBe(1);
  const write = vi.spyOn(reasoning, 'content', 'set');
  flush();
  expect(write).toHaveBeenCalledOnce();
  expect(reasoning.content).toBe('word '.repeat(1000));
  expect(reasoning.duration).toBeNull();
  expect(view.el.querySelector<HTMLElement>('.cui-progress')!.hidden).toBe(true);
  view.appendDelta('Actual answer');
  expect(reasoning.streaming).toBe(false);
  expect(reasoning.open).toBe(false);
  view.endStream();
  expect(view.getLastAnswer()).toBe('Actual answer');
});

it('preserves reader-owned native disclosure state across updates, completion and relabeling', () => {
  view.setRunning(true);
  view.appendReasoningDelta('Public reasoning');
  const reasoning = rows()[0];
  toggle(reasoning).click();
  expect(reasoning.open).toBe(false);
  view.appendReasoningDelta(' keeps coming');
  flush();
  expect(reasoning.open).toBe(false);
  view.endReasoning();
  toggle(reasoning).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  expect(reasoning.open).toBe(true);
  view.setLabels({ reasoning: 'Reasoning translated' });
  view.endReasoning();
  expect(reasoning.open).toBe(true);
  expect(reasoning.label).toBe('Reasoning translated');
});

it('shares a 64 KiB UTF-8 budget across phases, keeps emoji whole and emits one localized notice', () => {
  view.setLabels({ reasoningTruncated: 'Output shortened' });
  view.setRunning(true);
  view.appendReasoningDelta('a'.repeat(65530));
  view.endReasoning();
  view.append({ role: 'tool', text: 'Tool receipt' });
  view.appendReasoningDelta('😀😀after');
  flush();
  expect(rows().map((row) => row.content)).toEqual(['a'.repeat(65530), '😀']);
  expect(
    new TextEncoder().encode(
      rows()
        .map((row) => row.content)
        .join(''),
    ).byteLength,
  ).toBe(65534);
  expect(view.el.querySelectorAll('.cui-reasoning-notice')).toHaveLength(1);
  expect(view.el.querySelector('.cui-reasoning-notice')!.textContent).toBe('Output shortened');
  view.endReasoning();
  view.appendReasoningDelta('late');
  view.setRunning(true);
  view.appendReasoningDelta('still the same run');
  expect(rows()).toHaveLength(2);
  view.setLabels({ reasoningTruncated: 'Notice translated' });
  expect(view.el.querySelector('.cui-reasoning-notice')!.textContent).toBe('Notice translated');
  view.setRunning(false);
  view.setRunning(true);
  view.appendReasoningDelta('New run');
  flush();
  expect(rows()).toHaveLength(3);
  expect(rows()[2].content).toBe('New run');
});

it.each(['answer', 'tool', 'review', 'phase', 'end'] as const)('ends an active phase when %s arrives', (event) => {
  view.setRunning(true);
  view.appendReasoningDelta('A public phase');
  const reasoning = rows()[0];
  if (event === 'answer') view.appendDelta('Answer');
  else if (event === 'tool') view.append({ role: 'tool', text: 'Reading file' });
  else if (event === 'review') view.appendContent(document.createElement('section'));
  else if (event === 'phase') view.setActivity('reading');
  else view.endStream();
  expect(reasoning.streaming).toBe(false);
  expect(reasoning.content).toBe('A public phase');
  expect(reasoning.label).toBe('Reasoning');
});

it.each(['stop', 'error', 'settle'] as const)('freezes interruption on %s and ignores late callbacks', (event) => {
  view.setRunning(true);
  view.appendReasoningDelta('Retained public output');
  const reasoning = rows()[0];
  if (event === 'stop') view.requestStop();
  else if (event === 'error') view.append({ role: 'error', text: 'Service unavailable' });
  else view.setRunning(false);
  expect(reasoning.streaming).toBe(false);
  expect(reasoning.content).toBe('Retained public output');
  expect(reasoning.label).toBe('Reasoning interrupted');
  view.appendReasoningDelta('Late output');
  view.endReasoning();
  expect(reasoning.label).toBe('Reasoning interrupted');
  expect(reasoning.content).toBe('Retained public output');
});

it.each(['clear', 'restore', 'dispose'] as const)(
  'discards ephemeral output and rejects late work after %s',
  (event) => {
    view.setRunning(true);
    view.appendReasoningDelta('Never persist this');
    const reasoning = rows()[0];
    if (event === 'clear') view.clear();
    else if (event === 'restore') view.restoreHistory([{ role: 'agent', text: 'Stored answer' }]);
    else view.dispose();
    view.appendReasoningDelta('Late output');
    view.endReasoning();
    flush();
    expect(rows()).toHaveLength(0);
    expect(reasoning.content).toBe('');
    reasoning.dispatchEvent(new CustomEvent('disclosuretoggle'));
    expect(frames.size).toBe(0);
  },
);

it('keeps reasoning out of answer/source/copy/save/apply and message hooks', async () => {
  view.dispose();
  const copy = vi.fn().mockResolvedValue(undefined);
  const save = vi.fn();
  const apply = vi.fn().mockResolvedValue('verified');
  const present = vi.fn();
  const actions = vi.fn().mockReturnValue([]);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: copy } });
  view = new ChatView({
    onSend: vi.fn(),
    onSaveMessage: save,
    onApplyMessage: apply,
    presentMessage: present,
    getMessageActions: actions,
  });
  document.body.append(view.el);
  view.setRunning(true);
  view.appendReasoningDelta('Ephemeral public reasoning');
  view.appendDelta('**Answer source**', { documentArtifact: true });
  view.endStream();
  view.setRunning(false);
  expect(view.getLastAnswer()).toBe('**Answer source**');
  expect(view.getLastDocumentBody()).toBe('**Answer source**');
  expect(view.el.querySelectorAll('[data-source]')).toHaveLength(1);
  view.el.querySelector<HTMLButtonElement>('.cui-copy')!.click();
  view.el.querySelector<HTMLButtonElement>('.cui-save')!.click();
  view.el.querySelector<HTMLButtonElement>('.cui-apply')!.click();
  await Promise.resolve();
  expect(copy).toHaveBeenCalledWith('**Answer source**');
  expect(save).toHaveBeenCalledWith('**Answer source**', undefined);
  expect(apply).toHaveBeenCalledWith('**Answer source**');
  expect(present).toHaveBeenCalled();
  for (const [bubble] of present.mock.calls) expect(bubble.closest('r-reasoning')).toBeNull();
  expect(actions).toHaveBeenCalledOnce();
});

it.each([true, false])('reasoning expansion respects current scroll ownership: following=%s', (following) => {
  const messages = view.el.querySelector<HTMLElement>('.cui-messages')!;
  view.append({ role: 'agent', text: 'Earlier answer' });
  Object.defineProperties(messages, {
    scrollHeight: { configurable: true, value: 1000 },
    clientHeight: { configurable: true, value: 200 },
  });
  messages.scrollTop = following ? 800 : 100;
  messages.dispatchEvent(new Event('scroll'));
  view.setRunning(true);
  view.appendReasoningDelta('Public output');
  flush();
  view.endReasoning();
  flush();
  vi.mocked(messages.scrollTo).mockClear();
  toggle(rows()[0]).click();
  flush();
  if (following) expect(messages.scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'auto' });
  else {
    expect(messages.scrollTo).not.toHaveBeenCalled();
    expect(messages.scrollTop).toBe(100);
  }
});

it('buffers surrogate pairs split between deltas before enforcing the UTF-8 cap', () => {
  view.setRunning(true);
  view.appendReasoningDelta('a'.repeat(65533) + '\uD83D');
  flush();
  expect(rows()[0].content).toBe('a'.repeat(65533));
  view.appendReasoningDelta('\uDE00');
  flush();
  expect(rows()[0].content).toBe('a'.repeat(65533));
  expect(view.el.querySelectorAll('.cui-reasoning-notice')).toHaveLength(1);
  expect(new TextEncoder().encode(rows()[0].content).byteLength).toBe(65533);
});

it('buffers a first high surrogate without an empty row and completes the emoji on the next delta', () => {
  view.setRunning(true);
  view.appendReasoningDelta('\uD83D');
  flush();
  expect(rows()).toHaveLength(0);
  view.appendReasoningDelta('\uDE00');
  flush();
  expect(rows()[0].content).toBe('😀');
});

it.each([false, true])('normalizes an orphaned high surrogate at phase end; interrupted=%s', (interrupted) => {
  view.setRunning(true);
  view.appendReasoningDelta('\uD83D');
  if (interrupted) view.requestStop();
  else view.endReasoning();
  expect(rows()[0].content).toBe('\uFFFD');
  expect(rows()[0].streaming).toBe(false);
  expect(rows()[0].label).toBe(interrupted ? 'Reasoning interrupted' : 'Reasoning');
});

it('normalizes orphaned low surrogates and does not join a pair across inference phases', () => {
  view.setRunning(true);
  view.appendReasoningDelta('\uD83D');
  view.endReasoning();
  view.appendReasoningDelta('\uDE00');
  view.endReasoning();
  expect(rows().map((row) => row.content)).toEqual(['\uFFFD', '\uFFFD']);
});
