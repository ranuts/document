import { afterEach, expect, it, vi } from 'vitest';
import { createSourcesView, type SourcesLabels } from '../../lib/agent-plugin/ui/sources-view';
import { ReferenceSources } from '../../lib/agent-plugin/connectors/reference-sources';
const labels: SourcesLabels = {
  title: 'Sources',
  offline: 'Offline',
  excerpt: 'Bounded excerpts',
  local: 'Local files',
  localHint: 'Text only',
  mcp: 'MCP',
  url: 'URL',
  token: 'Token',
  connect: 'Connect',
  disconnect: 'Disconnect',
  drive: 'Drive',
  driveHint: 'Read only',
  unavailable: 'Unavailable',
  reconnect: 'Reconnect',
  loading: 'Reading',
  failed: 'Failed',
  tooLarge: 'Too large',
  limit: 'Remove a source before adding another',
  unsupported: 'Unsupported',
  remove: 'Remove',
  attached: 'Browse files',
  attach: 'Attach',
  close: 'Back',
  more: 'More',
};
afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});
it('does not read or connect until the user acts; removing a source invalidates its queued snapshot', () => {
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
it('explains missing cloud deployment without displaying returned HTML or private bodies', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response('<html>private server response</html>', { status: 404, headers: { 'content-type': 'text/html' } }),
    ),
  );
  const view = createSourcesView({ sources: new ReferenceSources(), labels, changed: vi.fn(), close: vi.fn() });
  document.body.append(view.el);
  [...view.el.querySelectorAll('button')].find((b) => b.textContent === 'Browse files')!.click();
  await vi.waitFor(() => expect(view.el.querySelector('.agent-sources-status')!.textContent).toBe('Unavailable'));
  expect(view.el.textContent).not.toContain('private server');
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
it('closes a stale authorization popup when disconnect wins over start', async () => {
  const popup = { close: vi.fn(), location: { href: '' } };
  vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
  let complete!: (response: Response) => void;
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      url.endsWith('/start')
        ? new Promise<Response>((resolve) => {
            complete = resolve;
          })
        : Promise.resolve(
            new Response(JSON.stringify({ connected: false }), { headers: { 'content-type': 'application/json' } }),
          ),
    ),
  );
  const view = createSourcesView({ sources: new ReferenceSources(), labels, changed: vi.fn(), close: vi.fn() });
  document.body.append(view.el);
  const buttons = [...view.el.querySelectorAll('button')];
  buttons
    .filter((b) => b.textContent === 'Connect')
    .at(-1)!
    .click();
  buttons
    .filter((b) => b.textContent === 'Disconnect')
    .at(-1)!
    .click();
  complete(
    new Response(JSON.stringify({ authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth' }), {
      headers: { 'content-type': 'application/json' },
    }),
  );
  await vi.waitFor(() => expect(popup.close).toHaveBeenCalled());
  expect(popup.location.href).toBe('');
  view.dispose();
  vi.restoreAllMocks();
});
it('hides cloud discovery offline while keeping attachments and local MCP controls, without reconnecting online', () => {
  const network = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  const sources = new ReferenceSources();
  sources.add({ id: 'cached-drive', connector: 'google', title: 'Cached policy', text: 'Already attached' });
  const view = createSourcesView({ sources, labels, changed: vi.fn(), close: vi.fn() });
  document.body.append(view.el);
  expect((view.el.querySelector('.agent-cloud-sources') as HTMLElement).hidden).toBe(true);
  expect(view.el.querySelector('.agent-source-row')?.textContent).toContain('Cached policy');
  expect(view.el.querySelector('details')).toBeTruthy();
  expect(view.el.querySelector('[type=file]')).toBeTruthy();
  expect((view.el.querySelector('.agent-offline-hint') as HTMLElement).hidden).toBe(false);
  network.mockReturnValue(true);
  window.dispatchEvent(new Event('online'));
  expect((view.el.querySelector('.agent-cloud-sources') as HTMLElement).hidden).toBe(false);
  expect(fetcher).not.toHaveBeenCalled();
  expect(sources.list()).toHaveLength(1);
  view.dispose();
  network.mockRestore();
});

it('restores the Drive connect action after authorization expires without losing attached snapshots', async () => {
  let expired = false;
  const fetcher = vi.fn(
    async () =>
      new Response(
        JSON.stringify(
          expired
            ? { error: 'reconnect_required' }
            : { files: [{ id: 'file', name: 'Policy' }], nextPageToken: 'next' },
        ),
        { status: expired ? 401 : 200, headers: { 'content-type': 'application/json' } },
      ),
  );
  vi.stubGlobal('fetch', fetcher);
  const sources = new ReferenceSources();
  sources.add({ id: 'saved', connector: 'google', title: 'Attached', text: 'snapshot' });
  const view = createSourcesView({ sources, labels, changed: vi.fn(), close: vi.fn() });
  document.body.append(view.el);
  const cloud = view.el.querySelector('.agent-cloud-sources')!;
  const connect = [...cloud.querySelectorAll('button')].find((b) => b.textContent === 'Connect')!;
  const browse = [...cloud.querySelectorAll('button')].find((b) => b.textContent === 'Browse files')!;
  browse.click();
  await vi.waitFor(() => expect(connect.hidden).toBe(true));
  expired = true;
  [...cloud.querySelectorAll('button')].find((b) => b.textContent === 'Policy')!.click();
  await vi.waitFor(() => expect(view.el.querySelector('.agent-sources-status')!.textContent).toBe('Reconnect'));
  expect(connect.hidden).toBe(false);
  expect(cloud.querySelector('.agent-source-options')!.childElementCount).toBe(0);
  expect([...cloud.querySelectorAll('button')].find((b) => b.textContent === 'More')!.hidden).toBe(true);
  expect(sources.list()).toHaveLength(1);
  expect(fetcher).toHaveBeenCalledTimes(2);
  view.dispose();
});
it('restores MCP connection controls after an expired token so a replacement token can be entered', async () => {
  const { McpResources } = await import('../../lib/agent-plugin/connectors/reference-sources');
  const list = vi.spyOn(McpResources.prototype, 'list').mockResolvedValue([{ uri: 'resource:one', name: 'Policy' }]);
  const read = vi.spyOn(McpResources.prototype, 'read').mockRejectedValueOnce(new Error('source-auth'));
  read.mockResolvedValue({ id: 'retried', connector: 'mcp', title: 'Policy', text: 'Readable after reconnect' });
  const view = createSourcesView({ sources: new ReferenceSources(), labels, changed: vi.fn(), close: vi.fn() });
  document.body.append(view.el);
  const details = view.el.querySelector('details')!;
  (details.querySelector('[type=url]') as HTMLInputElement).value = 'https://mcp.example.test';
  const connect = [...details.querySelectorAll('button')].find((b) => b.textContent === 'Connect')!;
  connect.click();
  await vi.waitFor(() => expect(connect.hidden).toBe(true));
  [...details.querySelectorAll('button')].find((b) => b.textContent === 'Policy')!.click();
  await vi.waitFor(() => expect(view.el.querySelector('.agent-sources-status')!.textContent).toBe('Reconnect'));
  expect(connect.hidden).toBe(false);
  expect(details.querySelector('.agent-source-options')!.childElementCount).toBe(0);
  (details.querySelector('[type=password]') as HTMLInputElement).value = 'replacement-token';
  connect.click();
  await vi.waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  await vi.waitFor(() => expect(connect.hidden).toBe(true));
  [...details.querySelectorAll('button')].find((b) => b.textContent === 'Policy')!.click();
  await vi.waitFor(() => expect(view.el.querySelector('.agent-source-row')?.textContent).toContain('Policy'));
  expect((details.querySelector('[type=password]') as HTMLInputElement).value).toBe('');
  view.dispose();
  vi.restoreAllMocks();
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

it('a delayed disconnect cannot erase a newer attachment status', async () => {
  let finishDisconnect!: (response: Response) => void;
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      url.endsWith('/disconnect')
        ? new Promise<Response>((r) => {
            finishDisconnect = r;
          })
        : Promise.resolve(
            new Response(JSON.stringify({ files: [] }), { headers: { 'content-type': 'application/json' } }),
          ),
    ),
  );
  const view = createSourcesView({ sources: new ReferenceSources(), labels, changed: vi.fn(), close: vi.fn() });
  document.body.append(view.el);
  const cloud = view.el.querySelector('.agent-cloud-sources')!;
  [...cloud.querySelectorAll('button')].find((b) => b.textContent === 'Browse files')!.click();
  const disconnect = [...cloud.querySelectorAll('button')].find((b) => b.textContent === 'Disconnect')!;
  await vi.waitFor(() => expect(disconnect.hidden).toBe(false));
  disconnect.click();
  let finishFile!: (text: string) => void;
  const file = new File(['body'], 'fresh.txt');
  Object.defineProperty(file, 'text', {
    value: () =>
      new Promise<string>((r) => {
        finishFile = r;
      }),
  });
  const input = view.el.querySelector<HTMLInputElement>('[type=file]')!;
  Object.defineProperty(input, 'files', { value: [file] });
  input.dispatchEvent(new Event('change'));
  finishDisconnect(new Response('{}', { headers: { 'content-type': 'application/json' } }));
  await new Promise((r) => setTimeout(r, 0));
  expect(view.el.querySelector('.agent-sources-status')!.textContent).toBe('Reading');
  finishFile('fresh data');
  await vi.waitFor(() => expect(view.el.querySelector('.agent-source-row')?.textContent).toContain('fresh.txt'));
  view.dispose();
});
