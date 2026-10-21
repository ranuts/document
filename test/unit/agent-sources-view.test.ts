import { afterEach, expect, it, vi } from 'vitest';
import { createSourcesView, type SourcesLabels } from '../../lib/agent-plugin/ui/sources-view';
import { ReferenceSources } from '../../lib/agent-plugin/references/reference-sources';
const labels: SourcesLabels = {
  title: 'Sources',
  offline: 'Offline',
  excerpt: 'Bounded excerpts',
  local: 'Local files',
  localHint: 'Text only',
  loading: 'Reading',
  failed: 'Failed',
  tooLarge: 'Too large',
  limit: 'Remove a source before adding another',
  unsupported: 'Unsupported',
  remove: 'Remove',
  attach: 'Attach',
  close: 'Back',
};
afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});
it('offers local references without remote account or server controls', () => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  const popup = vi.spyOn(window, 'open');
  const view = createSourcesView({ sources: new ReferenceSources(), labels, changed: vi.fn(), close: vi.fn() });
  document.body.append(view.el);
  expect(view.el.querySelector('input[type=file]')).toBeTruthy();
  expect(view.el.querySelector('.agent-view-header button')).toBeNull();
  expect(view.el.querySelectorAll('input[type=url], input[type=password]')).toHaveLength(0);
  expect(
    [...view.el.querySelectorAll('button')].some((button) =>
      ['Connect', 'Disconnect', 'Browse files'].includes(button.textContent ?? ''),
    ),
  ).toBe(false);
  window.dispatchEvent(new Event('offline'));
  window.dispatchEvent(new Event('online'));
  expect(fetcher).not.toHaveBeenCalled();
  expect(popup).not.toHaveBeenCalled();
  view.dispose();
  popup.mockRestore();
});
it('does not read until the user acts; removing a source invalidates its queued snapshot', () => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  const sources = new ReferenceSources();
  sources.add({ id: 'one', connector: 'local', title: 'Notes', text: 'private' });
  const snapshot = sources.capture();
  const view = createSourcesView({ sources, labels, changed: vi.fn(), close: vi.fn() });
  document.body.append(view.el);
  expect(fetcher).not.toHaveBeenCalled();
  expect(view.el.textContent).not.toContain('private');
  (view.el.querySelector('.agent-source-row button') as HTMLButtonElement).click();
  expect(snapshot.isCurrent()).toBe(false);
  view.dispose();
});
it('discards a delayed file read after switching conversation or disposing', async () => {
  const sources = new ReferenceSources();
  sources.select('one');
  const view = createSourcesView({ sources, labels, changed: vi.fn(), close: vi.fn() });
  document.body.append(view.el);
  let resolve!: (value: string) => void;
  const file = new File(['original'], 'note.txt');
  Object.defineProperty(file, 'text', {
    value: () =>
      new Promise<string>((r) => {
        resolve = r;
      }),
  });
  const input = view.el.querySelector<HTMLInputElement>('input[type=file]')!;
  Object.defineProperty(input, 'files', { value: [file] });
  input.dispatchEvent(new Event('change'));
  view.cancelPending();
  sources.select('two');
  resolve('private text');
  await new Promise((r) => setTimeout(r, 0));
  expect(sources.list()).toEqual([]);
  sources.select('one');
  expect(sources.list()).toEqual([]);
  view.dispose();
});
it('explains the five attachment limit and lets removal unblock the next attachment', async () => {
  const sources = new ReferenceSources();
  for (let i = 0; i < 5; i++) sources.add({ id: String(i), connector: 'local', title: String(i), text: 'text' });
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  const view = createSourcesView({ sources, labels, changed: vi.fn(), close: vi.fn() });
  document.body.append(view.el);
  const input = view.el.querySelector<HTMLInputElement>('[type=file]')!;
  const file = new File(['text'], 'sixth.txt');
  Object.defineProperty(file, 'text', { value: async () => 'text' });
  Object.defineProperty(input, 'files', { value: [file] });
  input.dispatchEvent(new Event('change'));
  await vi.waitFor(() => expect(view.el.querySelector('.agent-sources-status')!.textContent).toBe(labels.limit));
  expect(sources.list()).toHaveLength(5);
  (view.el.querySelector('.agent-source-row button') as HTMLButtonElement).click();
  input.dispatchEvent(new Event('change'));
  await vi.waitFor(() => expect(sources.list().some((s) => s.title === 'sixth.txt')).toBe(true));
  expect(sources.list()).toHaveLength(5);
  expect(fetcher).not.toHaveBeenCalled();
  view.dispose();
});

it('accepts new conversation attachments while an obsolete read is still pending and ignores its result', async () => {
  const sources = new ReferenceSources();
  sources.select('old');
  const view = createSourcesView({ sources, labels, changed: vi.fn(), close: vi.fn() });
  document.body.append(view.el);
  const input = view.el.querySelector<HTMLInputElement>('[type=file]')!;
  let resolveOld!: (text: string) => void;
  const old = new File(['old'], 'old.txt');
  Object.defineProperty(old, 'text', {
    value: () =>
      new Promise<string>((r) => {
        resolveOld = r;
      }),
  });
  Object.defineProperty(input, 'files', { configurable: true, value: [old] });
  input.dispatchEvent(new Event('change'));
  view.cancelPending();
  sources.select('new');
  const fresh = new File(['new'], 'new.txt');
  Object.defineProperty(fresh, 'text', { value: async () => 'new conversation data' });
  Object.defineProperty(input, 'files', { configurable: true, value: [fresh] });
  input.dispatchEvent(new Event('change'));
  await vi.waitFor(() => expect(sources.list().map((s) => s.title)).toEqual(['new.txt']));
  resolveOld('stale private data');
  await new Promise((r) => setTimeout(r, 0));
  expect(sources.list().map((s) => s.title)).toEqual(['new.txt']);
  sources.select('old');
  expect(sources.list()).toEqual([]);
  view.dispose();
});

it('an obsolete completion cannot clear the status or busy ownership of a newer read', async () => {
  const sources = new ReferenceSources();
  sources.select('old');
  const view = createSourcesView({ sources, labels, changed: vi.fn(), close: vi.fn() });
  document.body.append(view.el);
  const input = view.el.querySelector<HTMLInputElement>('[type=file]')!;
  const callbacks: Array<(text: string) => void> = [];
  const choose = (name: string) => {
    const file = new File(['text'], name);
    Object.defineProperty(file, 'text', { value: () => new Promise<string>((r) => callbacks.push(r)) });
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    input.dispatchEvent(new Event('change'));
  };
  choose('old.txt');
  view.cancelPending();
  sources.select('new');
  choose('new.txt');
  expect(callbacks).toHaveLength(2);
  callbacks[0]('stale data');
  await new Promise((r) => setTimeout(r, 0));
  expect(view.el.querySelector('.agent-sources-status')!.textContent).toBe('Reading');
  choose('should-not-start-while-new-read-is-busy.txt');
  expect(callbacks).toHaveLength(2);
  callbacks[1]('current data');
  await vi.waitFor(() => expect(sources.list().map((s) => s.title)).toEqual(['new.txt']));
  expect(view.el.querySelector('.agent-sources-status')!.textContent).toBe('');
  view.dispose();
});

it('finds and highlights late attached-source hits without reading the network', async () => {
  const sources = new ReferenceSources();
  sources.add({
    id: 'one',
    connector: 'local',
    title: 'Long notes',
    text: 'prefix '.repeat(3000) + '<script>Budget   forecast</script>',
  });
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  const view = createSourcesView({
    sources,
    labels: { ...labels, search: 'Search sources', previewTruncated: 'Partial preview' },
    changed: vi.fn(),
    close: vi.fn(),
  });
  document.body.append(view.el);
  const input = view.el.querySelector('input[type=search]') as HTMLInputElement;
  input.value = 'budget forecast';
  input.dispatchEvent(new Event('input'));
  expect(view.el.querySelectorAll('.agent-source-row')).toHaveLength(1);
  const detail = view.el.querySelector('details.agent-source-preview') as HTMLDetailsElement;
  detail.open = true;
  detail.dispatchEvent(new Event('toggle'));
  expect(detail.querySelector('mark')?.textContent).toBe('Budget   forecast');
  expect(detail.querySelector('script')).toBeNull();
  expect(detail.querySelector('small')?.textContent).toBe('Partial preview');
  expect(fetcher).not.toHaveBeenCalled();
  view.dispose();
});
it.each(['corrupt', 'encrypted', 'empty', 'timeout'] as const)(
  'shows actionable %s failures rather than offline',
  async (code) => {
    const view = createSourcesView({
      sources: new ReferenceSources(),
      labels: { ...labels, [code]: `Explanation ${code}` },
      changed: vi.fn(),
      close: vi.fn(),
    });
    const file = {
      name: 'broken.txt',
      size: 1,
      text: async () => {
        throw new Error(`source-${code}`);
      },
    };
    const input = view.el.querySelector('input[type=file]')!;
    Object.defineProperty(input, 'files', { value: [file] });
    input.dispatchEvent(new Event('change'));
    await vi.waitFor(() =>
      expect(view.el.querySelector('.agent-sources-status')!.textContent).toBe(`Explanation ${code}`),
    );
    view.dispose();
  },
);

it('retains local attachments across offline and online transitions without a network request', () => {
  const network = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  const sources = new ReferenceSources();
  sources.add({ id: 'notes', connector: 'local', title: 'Local policy', text: 'Attached text' });
  const view = createSourcesView({ sources, labels, changed: vi.fn(), close: vi.fn() });
  document.body.append(view.el);
  expect(view.el.querySelector('.agent-source-row')?.textContent).toContain('Local policy');
  expect((view.el.querySelector('.agent-offline-hint') as HTMLElement).hidden).toBe(false);
  network.mockReturnValue(true);
  window.dispatchEvent(new Event('online'));
  expect((view.el.querySelector('.agent-offline-hint') as HTMLElement).hidden).toBe(true);
  expect(sources.list()).toHaveLength(1);
  expect(fetcher).not.toHaveBeenCalled();
  view.dispose();
  network.mockRestore();
});

it('keeps removal focus in the filtered source list and falls back to Attach when empty', () => {
  const sources = new ReferenceSources();
  for (const id of ['hidden', 'one', 'two', 'three'])
    sources.add({ id, connector: 'local', title: id === 'hidden' ? 'Other' : `Notes ${id}`, text: id });
  const view = createSourcesView({ sources, labels, changed: vi.fn(), close: vi.fn() });
  document.body.append(view.el);
  const search = view.el.querySelector<HTMLInputElement>('[type=search]')!;
  search.value = 'Notes';
  search.dispatchEvent(new Event('input'));
  const remove = (name: string) => {
    const control = view.el.querySelector<HTMLButtonElement>(`[aria-label="Remove: Notes ${name}"]`)!;
    control.focus();
    control.click();
  };
  remove('two');
  expect(document.activeElement?.getAttribute('aria-label')).toBe('Remove: Notes three');
  remove('three');
  expect(document.activeElement?.getAttribute('aria-label')).toBe('Remove: Notes one');
  remove('one');
  expect(document.activeElement).toBe(view.el.querySelector('.agent-source-attach'));
  expect(sources.list().map((source) => source.id)).toEqual(['hidden']);
  view.dispose();
});
