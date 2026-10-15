import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ChatView } from '../../packages/chat-ui/src/chat-view';
import * as markdown from '../../packages/chat-ui/src/markdown';
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
  view.append({ role: 'user', text: 'Existing history' });
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

it('restores only the latest 40 of 1000 messages and loads every earlier row in source order', () => {
  const { view, messages } = mount();
  const source: ChatMessage[] = Array.from({ length: 1000 }, (_, index) => ({
    role: index % 2 ? 'agent' : 'user',
    text: `Message ${index}`,
  }));
  view.restoreHistory(source);
  expect(messages.querySelectorAll('.cui-msg')).toHaveLength(40);
  expect(messages.querySelector('.cui-bubble')?.textContent).toBe('Message 960');
  expect(messages.textContent).not.toContain('Message 0');
  const button = messages.querySelector<HTMLButtonElement>('.cui-load-earlier')!;
  while (!button.hidden) button.click();
  expect(Array.from(messages.querySelectorAll('.cui-bubble'), (row) => row.textContent)).toEqual(
    source.map((item) => item.text),
  );
  expect(view.getLastAnswer()).toBe('Message 999');
});

it('bounds even one oversized turn, merges cross-window tool groups in order and keeps the latest summary', () => {
  const { view, messages } = mount();
  const source: ChatMessage[] = [
    { role: 'user', text: 'Request' },
    ...Array.from({ length: 70 }, (_, index) => ({ role: 'tool' as const, text: `Tool ${index}` })),
  ];
  view.restoreHistory(source);
  expect(messages.querySelectorAll('.cui-activity span')).toHaveLength(40);
  expect(messages.textContent).not.toContain('Request');
  const group = messages.querySelector('details')!;
  const summary = group.querySelector('summary')!;
  expect(summary.textContent).toBe('Tool 69');
  messages.querySelector<HTMLButtonElement>('.cui-load-earlier')!.click();
  expect(messages.querySelector('details')).toBe(group);
  expect(group.querySelector('summary')).toBe(summary);
  expect(Array.from(group.querySelectorAll('li'), (li) => li.textContent)).toEqual(
    Array.from({ length: 69 }, (_, index) => `Tool ${index}`),
  );
  expect(summary.textContent).toBe('Tool 69');
});

it('keeps complete source getters when the eligible answer is outside the latest window', () => {
  const { view } = mount({ requireDocumentArtifact: true });
  view.restoreHistory([
    { role: 'user', text: 'Write' },
    { role: 'agent', text: '**Full document**', documentArtifact: true, copyOnly: true },
    ...Array.from({ length: 70 }, () => ({ role: 'tool' as const, text: 'Receipt' })),
  ]);
  expect(view.el.querySelector('.cui-msg-agent')).toBeNull();
  expect(view.getLastAnswer()).toBe('**Full document**');
  expect(view.getLastDocumentBody()).toBe('**Full document**');
});

it('previews giant restored text but preserves full copy/apply source and requires explicit expansion', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  const apply = vi.fn().mockResolvedValue('retry');
  const { view, messages } = mount({ onApplyMessage: apply, requireDocumentArtifact: true });
  const source = '**Start**\n\n' + 'x'.repeat(100_000) + 'End';
  view.restoreHistory([{ role: 'agent', text: source, documentArtifact: true }]);
  const row = messages.querySelector<HTMLElement>('.cui-msg')!;
  expect(row.querySelector('.cui-bubble')!.textContent!.length).toBeLessThanOrEqual(8000);
  expect(row.dataset.source).toBe(source);
  row.querySelector<HTMLButtonElement>('.cui-copy')!.click();
  await Promise.resolve();
  expect(writeText).toHaveBeenCalledWith(source);
  row.querySelector<HTMLButtonElement>('.cui-apply')!.click();
  await Promise.resolve();
  expect(apply).toHaveBeenCalledWith(source);
  row.querySelector<HTMLButtonElement>('.cui-history-expand')!.click();
  expect(row.querySelector('.cui-bubble')?.textContent).toContain('End');
  expect(row.dataset.source).toBe(source);
});

it('derives each restored recovery source without changing the latest request during prepend', () => {
  const { view, messages } = mount();
  view.restoreHistory([
    { role: 'user', text: 'Older request' },
    { role: 'error', text: 'Older failure' },
    ...Array.from({ length: 60 }, () => ({ role: 'tool' as const, text: 'Read' })),
    { role: 'user', text: 'Latest request' },
    { role: 'status', text: 'Stopped' },
  ]);
  messages.querySelector<HTMLButtonElement>('.cui-restore')!.click();
  expect(view.getInput()).toBe('Latest request');
  view.setInput('');
  messages.querySelector<HTMLButtonElement>('.cui-load-earlier')!.click();
  messages.querySelector<HTMLButtonElement>('.cui-msg-error .cui-restore')!.click();
  expect(view.getInput()).toBe('Older request');
  view.setInput('');
  view.append({ role: 'error', text: 'New failure' });
  Array.from(messages.querySelectorAll<HTMLButtonElement>('.cui-restore')).at(-1)!.click();
  expect(view.getInput()).toBe('Latest request');
});

it('retains live output, review nodes, action identity, draft and focus while loading older rows', () => {
  const { view, messages } = mount();
  view.restoreHistory(Array.from({ length: 100 }, (_, index) => ({ role: 'agent', text: `Answer ${index}` })));
  const answer = messages.querySelector('.cui-msg-agent');
  const copy = answer!.querySelector('.cui-copy');
  view.append({ role: 'user', text: 'Next request' });
  view.setRunning(true);
  view.appendDelta('Live');
  const live = messages.querySelector('.cui-streaming');
  const review = document.createElement('section');
  view.appendContent(review);
  view.setInput('Next draft');
  view.focus();
  const input = document.activeElement;
  messages.querySelector<HTMLButtonElement>('.cui-load-earlier')!.click();
  expect(messages.contains(answer)).toBe(true);
  expect(answer!.querySelector('.cui-copy')).toBe(copy);
  expect(messages.contains(review)).toBe(true);
  expect(messages.querySelector('.cui-streaming')).toBe(live);
  expect(view.getInput()).toBe('Next draft');
  expect(document.activeElement).toBe(input);
  view.appendDelta(' answer');
  frames.splice(0).forEach((callback) => callback(16));
  expect(live!.querySelector('.cui-bubble')?.textContent).toBe('Live answer');
});

it('anchors prepend to the actual old node movement instead of the total scroll height', () => {
  const { view, messages } = mount();
  view.restoreHistory(Array.from({ length: 80 }, (_, index) => ({ role: 'agent', text: `Answer ${index}` })));
  const anchor = messages.querySelector<HTMLElement>('.cui-bubble')!;
  vi.spyOn(messages, 'getBoundingClientRect').mockReturnValue({ top: 0, bottom: 200 } as DOMRect);
  vi.spyOn(anchor, 'getBoundingClientRect').mockImplementation(
    () => ({ top: messages.querySelectorAll('.cui-msg').length === 40 ? 30 : 85, bottom: 100 }) as DOMRect,
  );
  messages.scrollTop = 70;
  messages.querySelector<HTMLButtonElement>('.cui-load-earlier')!.click();
  expect(messages.scrollTop).toBe(125);
});

it('invalidates old pagination and expansion owners after clear, replacement and disposal', () => {
  const { view, messages } = mount();
  const source: ChatMessage[] = Array.from({ length: 80 }, () => ({ role: 'agent', text: 'x'.repeat(9000) }));
  view.restoreHistory(source);
  const oldLoad = messages.querySelector<HTMLButtonElement>('.cui-load-earlier')!;
  const oldExpand = messages.querySelector<HTMLButtonElement>('.cui-history-expand')!;
  view.clear();
  view.restoreHistory([{ role: 'user', text: 'New owner' }]);
  oldLoad.click();
  oldExpand.click();
  expect(messages.querySelectorAll('.cui-msg')).toHaveLength(1);
  expect(messages.textContent).toContain('New owner');
  expect(view.getLastAnswer()).toBe('');
  view.restoreHistory(source);
  const load = messages.querySelector<HTMLButtonElement>('.cui-load-earlier')!;
  view.dispose();
  load.click();
  expect(messages.querySelectorAll('.cui-msg')).toHaveLength(40);
});

it('keeps the owned earlier button between pages and returns focus to the log on exhaustion', () => {
  const { view, messages } = mount();
  view.restoreHistory(Array.from({ length: 100 }, (_, index) => ({ role: 'user', text: String(index) })));
  const earlier = messages.querySelector<HTMLButtonElement>('.cui-load-earlier')!;
  earlier.focus();
  earlier.click();
  expect(messages.querySelector('.cui-load-earlier')).toBe(earlier);
  expect(document.activeElement).toBe(earlier);
  earlier.click();
  expect(earlier.hidden).toBe(true);
  earlier.click();
  expect(messages.querySelectorAll('.cui-msg')).toHaveLength(100);
  expect(document.activeElement).toBe(messages);
});

it('never parses omitted Markdown and caps automatic restored-message parser inputs', () => {
  const render = vi.spyOn(markdown, 'renderMarkdown');
  const { view } = mount();
  const source: ChatMessage[] = Array.from({ length: 1000 }, (_, index) => ({ role: 'agent', text: `**${index}**` }));
  source[999] = { role: 'agent', text: 'x'.repeat(100_000) };
  view.restoreHistory(source);
  expect(render).toHaveBeenCalledTimes(40);
  expect(render.mock.calls.every(([, text]) => text.length <= 8000)).toBe(true);
  expect(render.mock.calls.some(([, text]) => text === '**0**')).toBe(false);
});

it.each([undefined, 100, 0, 1, Number.NaN])('bounds requested history page sizes: %s', (pageSize) => {
  const { view, messages } = mount();
  view.restoreHistory(
    Array.from({ length: 100 }, (_, index) => ({ role: 'user', text: String(index) })),
    { pageSize },
  );
  expect(messages.querySelectorAll('.cui-msg').length).toBeLessThanOrEqual(40);
  expect(messages.querySelectorAll('.cui-msg').length).toBeGreaterThan(0);
});

it('keeps legacy ordinary large appends full and restores empty or disposed input without work', () => {
  const { view, messages } = mount();
  const source = 'x'.repeat(9000);
  view.append({ role: 'user', text: source });
  expect(messages.querySelector('.cui-bubble')?.textContent).toBe(source);
  expect(messages.querySelector('.cui-history-expand')).toBeNull();
  view.restoreHistory([]);
  expect(messages.querySelector('.cui-empty')).not.toBeNull();
  view.dispose();
  view.restoreHistory([{ role: 'user', text: 'Ignored' }]);
  expect(messages.querySelector('.cui-msg')).toBeNull();
});

it('localizes both history controls and invalidates saved expansion callbacks on disposal', () => {
  const { view, messages } = mount();
  view.restoreHistory(Array.from({ length: 41 }, () => ({ role: 'user', text: 'x'.repeat(9000) })));
  view.setLabels({ loadEarlier: 'Earlier', expandMessage: 'Full message' });
  const earlier = messages.querySelector<HTMLButtonElement>('.cui-load-earlier')!;
  const expand = messages.querySelector<HTMLButtonElement>('.cui-history-expand')!;
  expect(earlier.textContent).toBe('Earlier');
  expect(expand.textContent).toBe('Full message');
  expand.focus();
  expand.click();
  expect(document.activeElement).toBe(messages);
  const stale = messages.querySelector<HTMLButtonElement>('.cui-history-expand')!;
  const bubble = stale.parentElement!.querySelector('.cui-bubble')!;
  view.dispose();
  stale.click();
  expect(bubble.textContent!.length).toBe(8000);
});

it('bounds giant user/tool/status previews and expands them only when explicitly requested', () => {
  const { view, messages } = mount();
  const source = 'Original ' + 'x'.repeat(9000);
  view.restoreHistory([
    { role: 'user', text: source },
    { role: 'tool', text: source },
    { role: 'status', text: source },
  ]);
  expect(messages.querySelectorAll('.cui-history-expand')).toHaveLength(3);
  const expanders = Array.from(messages.querySelectorAll<HTMLButtonElement>('.cui-history-expand'));
  for (const button of expanders) button.click();
  expect(messages.querySelector('.cui-msg-user .cui-bubble')?.textContent).toBe(source);
  expect(messages.querySelector('.cui-msg-status .cui-bubble')?.textContent).toBe(source);
  expect(messages.querySelector('.cui-activity span')?.textContent).toBe(source);
});

it('finds eligible source answers while skipping interrupted output and ordinary prose for document getters', () => {
  const { view } = mount();
  view.restoreHistory([
    { role: 'agent', text: 'Draft', documentArtifact: true },
    { role: 'agent', text: 'Answer' },
    { role: 'agent', text: 'Partial', interrupted: true },
    ...Array.from({ length: 50 }, () => ({ role: 'tool' as const, text: 'Read' })),
  ]);
  expect(view.getLastAnswer()).toBe('Answer');
  expect(view.getLastDocumentBody()).toBe('Draft');
  view.restoreHistory([{ role: 'user', text: 'No answer' }]);
  expect(view.getLastDocumentBody()).toBe('');
});

it('derives recovery for a first window entirely inside one older request', () => {
  const { view, messages } = mount();
  const original = '  Original request\nwith exact whitespace  ';
  view.restoreHistory([
    { role: 'user', text: original },
    ...Array.from({ length: 50 }, () => ({ role: 'tool' as const, text: 'Read' })),
    { role: 'error', text: 'Failed' },
  ]);
  expect(messages.querySelector('.cui-msg-user')).toBeNull();
  messages.querySelector<HTMLButtonElement>('.cui-restore')!.click();
  expect(view.getInput()).toBe(original);
});

it('preserves observation of an existing tool group and unobserves only the merged staging group', () => {
  const observe = vi.fn();
  const unobserve = vi.fn();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = observe;
      unobserve = unobserve;
      disconnect() {}
    },
  );
  const { view, messages } = mount();
  view.restoreHistory(Array.from({ length: 70 }, (_, index) => ({ role: 'tool', text: `Read ${index}` })));
  const group = messages.querySelector('.cui-activity')!;
  expect(observe).toHaveBeenCalledWith(group);
  messages.querySelector<HTMLButtonElement>('.cui-load-earlier')!.click();
  expect(messages.querySelector('.cui-activity')).toBe(group);
  expect(unobserve).toHaveBeenCalledOnce();
  expect(unobserve).not.toHaveBeenCalledWith(group);
});

it('falls back to exact raw source if explicit giant-message Markdown expansion fails', () => {
  const { view, messages } = mount();
  const source = '**Header**\n\n' + 'x'.repeat(9000);
  view.restoreHistory([{ role: 'agent', text: source, documentArtifact: true }]);
  const row = messages.querySelector<HTMLElement>('.cui-msg')!;
  vi.spyOn(markdown, 'renderMarkdown').mockImplementationOnce(() => {
    throw new Error('Parser unavailable');
  });
  row.querySelector<HTMLButtonElement>('.cui-history-expand')!.click();
  expect(row.querySelector('.cui-bubble')?.textContent).toBe(source);
  expect(row.dataset.source).toBe(source);
  expect(row.querySelector('.cui-copy')).not.toBeNull();
});

it('keeps a bounded raw preview when restored Markdown fails and preserves full copy source', () => {
  const { view, messages } = mount();
  const source = '**Header**\n\n' + 'x'.repeat(9000);
  vi.spyOn(markdown, 'renderMarkdown').mockImplementationOnce(() => {
    throw new Error('Parser unavailable');
  });
  expect(() => view.restoreHistory([{ role: 'agent', text: source }])).not.toThrow();
  const row = messages.querySelector<HTMLElement>('.cui-msg')!;
  expect(row.querySelector('.cui-bubble')?.textContent).toBe(source.slice(0, 8000));
  expect(row.dataset.source).toBe(source);
  expect(row.querySelector('.cui-history-expand')).not.toBeNull();
});
