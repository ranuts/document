import { afterEach, expect, it, vi } from 'vitest';
import { createSourcesView, type SourcesLabels } from '../../lib/agent-plugin/ui/sources-view';
import { ReferenceSources } from '../../lib/agent-plugin/connectors/reference-sources';
const labels: SourcesLabels = {
  title: 'Sources',
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
  await vi.waitFor(() => expect(view.el.querySelector('[role=status]')!.textContent).toBe('Unavailable'));
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
