import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ChatView } from '../../packages/chat-ui/src/chat-view';
import type { ChatMessage } from '../../packages/chat-ui/src/types';

let frames: FrameRequestCallback[];
let views: ChatView[];
beforeEach(() => {
  document.body.replaceChildren();
  frames = [];
  views = [];
  HTMLElement.prototype.scrollTo = vi.fn();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});
afterEach(() => {
  views.forEach((view) => view.dispose());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function mount(options: Partial<ConstructorParameters<typeof ChatView>[0]> = {}) {
  const view = new ChatView({ onSend: vi.fn(), onApplyMessage: async () => 'retry', ...options });
  views.push(view);
  document.body.append(view.el);
  const messages = view.el.querySelector<HTMLElement>('.cui-messages')!;
  return { view, messages };
}
function countControlWrites() {
  let writes = 0;
  const set = Object.getOwnPropertyDescriptor(HTMLButtonElement.prototype, 'disabled')!.set!;
  vi.spyOn(HTMLButtonElement.prototype, 'disabled', 'set').mockImplementation(function (
    this: HTMLButtonElement,
    value: boolean,
  ) {
    if (this.matches('.cui-restore, .cui-apply')) writes++;
    set.call(this, value);
  });
  return () => writes;
}

it.each([100, 500])('initializes %s new message actions without revisiting earlier controls', (count) => {
  const { view } = mount();
  const visits = countControlWrites();
  for (let i = 0; i < count; i++) view.append({ role: 'agent', text: 'Answer' });
  expect(view.el.querySelectorAll('.cui-apply')).toHaveLength(count);
  expect(visits()).toBe(count);
});

it('refreshes existing actions only when draft emptiness or running state changes', async () => {
  const { view } = mount({ onApplyMessage: async () => 'verified' });
  view.append({ role: 'user', text: 'Original request' });
  view.append({ role: 'error', text: 'Failed' });
  view.append({ role: 'agent', text: 'Answer' });
  const restore = view.el.querySelector<HTMLButtonElement>('.cui-restore')!;
  const apply = view.el.querySelector<HTMLButtonElement>('.cui-apply')!;
  apply.click();
  await Promise.resolve();
  expect(apply.disabled).toBe(true);
  const visits = countControlWrites();
  view.setInput('Draft');
  expect(restore.disabled).toBe(true);
  const afterDraft = visits();
  view.setInput('Draft with more text');
  view.refreshSendAvailability();
  view.setLabels({ restore: 'Restore' });
  expect(visits()).toBe(afterDraft);
  view.setRunning(true);
  const afterRunning = visits();
  view.setRunning(true);
  expect(visits()).toBe(afterRunning);
  view.append({ role: 'error', text: 'Another failure' });
  expect(view.el.querySelectorAll<HTMLButtonElement>('.cui-restore')[1].disabled).toBe(true);
  view.setRunning(false);
  view.setInput('  ');
  expect(restore.disabled).toBe(false);
  expect(apply.disabled).toBe(true);
  restore.click();
  expect(view.getInput()).toBe('Original request');
});

it.each([100, 500])('restores %s messages with one scroll and bounded geometry reads', (count) => {
  const { view, messages } = mount();
  let heightReads = 0;
  Object.defineProperties(messages, {
    scrollHeight: {
      configurable: true,
      get: () => {
        heightReads++;
        return 1000;
      },
    },
    clientHeight: { configurable: true, value: 200 },
  });
  const visits = countControlWrites();
  view.appendMany(Array.from({ length: count }, () => ({ role: 'agent', text: 'Answer' as string })));
  expect(view.getLastAnswer()).toBe('Answer');
  expect(messages.scrollTo).toHaveBeenCalledExactlyOnceWith({ top: 1000, behavior: 'auto' });
  expect(heightReads).toBeLessThanOrEqual(3);
  expect(visits()).toBe(count);
  // Normal append retains its immediate scrolling contract; restoration avoids
  // the same layout update being repeated after every insertion.
  view.clear();
  heightReads = 0;
  vi.mocked(messages.scrollTo).mockClear();
  for (let i = 0; i < count; i++) view.append({ role: 'agent', text: 'Answer' });
  expect(messages.scrollTo).toHaveBeenCalledTimes(count);
  expect(heightReads).toBe(count * 3);
});

it('keeps batch grouping, original sources, interruption metadata and request recovery', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  const { view, messages } = mount({ requireDocumentArtifact: true });
  const turns: ChatMessage[] = [
    { role: 'user', text: 'First request' },
    { role: 'tool', text: 'Read' },
    { role: 'tool', text: 'Inspect' },
    { role: 'tool', text: 'Write' },
    { role: 'agent', text: '**Body**', documentArtifact: true },
    { role: 'agent', text: 'Partial', interrupted: true },
    { role: 'status', text: 'Stopped' },
  ];
  view.appendMany(turns);
  expect(messages.querySelector('details summary')?.textContent).toBe('Write');
  expect(Array.from(messages.querySelectorAll('details li'), (li) => li.textContent)).toEqual(['Read', 'Inspect']);
  expect(messages.querySelector('strong')?.textContent).toBe('Body');
  expect(view.getLastAnswer()).toBe('**Body**');
  expect(view.getLastDocumentBody()).toBe('**Body**');
  expect(messages.querySelectorAll('.cui-apply')).toHaveLength(1);
  messages.querySelector<HTMLButtonElement>('[data-interrupted] .cui-copy')!.click();
  await Promise.resolve();
  expect(writeText).toHaveBeenCalledWith('Partial');
  messages.querySelector<HTMLButtonElement>('.cui-restore')!.click();
  expect(view.getInput()).toBe('First request');
});

it('preserves historical reading and leaves empty or disposed batches alone', () => {
  const { view, messages } = mount();
  Object.defineProperties(messages, {
    scrollHeight: { configurable: true, value: 1000 },
    clientHeight: { configurable: true, value: 200 },
  });
  messages.scrollTop = 100;
  messages.dispatchEvent(new Event('scroll'));
  vi.mocked(messages.scrollTo).mockClear();
  view.appendMany([{ role: 'agent', text: 'More history' }]);
  expect(messages.scrollTo).not.toHaveBeenCalled();
  expect(messages.scrollTop).toBe(100);
  expect(view.el.querySelector<HTMLButtonElement>('.cui-scroll-bottom')!.hidden).toBe(false);
  view.clear();
  view.appendMany([]);
  expect(messages.querySelector('.cui-empty')).not.toBeNull();
  view.dispose();
  view.appendMany([{ role: 'agent', text: 'Discarded' }]);
  expect(messages.querySelector('.cui-msg')).toBeNull();
});

it('releases batch layout deferral when a host callback throws after an earlier message', () => {
  let calls = 0;
  const { view, messages } = mount({
    canApplyMessage: () => {
      if (++calls === 2) throw new Error('Host unavailable');
      return true;
    },
  });
  expect(() =>
    view.appendMany([
      { role: 'agent', text: 'Rendered' },
      { role: 'agent', text: 'Failed' },
    ]),
  ).toThrow('Host unavailable');
  expect(messages.querySelectorAll('.cui-msg')).toHaveLength(1);
  expect(messages.scrollTo).toHaveBeenCalledOnce();
  vi.mocked(messages.scrollTo).mockClear();
  view.append({ role: 'agent', text: 'Recovered' });
  expect(view.getLastAnswer()).toBe('Recovered');
  expect(messages.scrollTo).toHaveBeenCalledOnce();
});

it.each(['complete', 'interrupt'] as const)('writes streamed source only on %s after many frames', async (ending) => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  const { view, messages } = mount();
  view.appendDelta('First');
  const row = messages.querySelector<HTMLElement>('.cui-streaming')!;
  const mutations: MutationRecord[] = [];
  const observer = new MutationObserver((records) => mutations.push(...records));
  observer.observe(row, { attributes: true, attributeFilter: ['data-source'] });
  try {
    for (let i = 0; i < 20; i++) {
      view.appendDelta(' chunk');
      frames.splice(0).forEach((callback) => callback(i * 16));
    }
    await Promise.resolve();
    expect(mutations).toHaveLength(0);
    view.appendDelta(' tail');
    if (ending === 'complete') view.endStream();
    else view.append({ role: 'status', text: 'Stopped' });
    await Promise.resolve();
    expect(mutations).toHaveLength(1);
    expect(row.dataset.source).toBe('First' + ' chunk'.repeat(20) + ' tail');
    row.querySelector<HTMLButtonElement>('.cui-copy')!.click();
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith(row.dataset.source);
    expect(view.getLastAnswer()).toBe(ending === 'complete' ? row.dataset.source : '');
  } finally {
    observer.disconnect();
  }
});
