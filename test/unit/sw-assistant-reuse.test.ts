import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';

const origin = 'https://editor.example';
const currentCore = 'document-editor-core-200';
const oldCore = 'document-editor-core-100';
const runtimeAsset = '/assets/cpu-abc123.wasm';
const helperAsset = '/assets/cpu-helper-def456.js';
const markerKey = '/__document-assistant-prepared__/cpu';
const stateCache = 'document-assistant-capabilities';
const url = (path: string) => new URL(path, origin).href;
const prepared = () => new Response('1', { headers: { 'X-Document-Assistant-Prepared': '1' } });

function worker(
  initial: Record<string, [string, Response][]> = {},
  options: {
    fetchAssets?: (assets: string[]) => Promise<void>;
    unreadable?: 'open' | 'match' | 'clone';
  } = {},
) {
  const stores = new Map(
    Object.entries(initial).map(([name, entries]) => [
      name,
      new Map(entries.map(([path, response]) => [url(path), response])),
    ]),
  );
  const listeners = new Map<string, (event: any) => void>();
  const downloaded: string[] = [];
  const matched: Response[] = [];
  const claim = vi.fn();
  const open = async (name: string) => {
    if (name === oldCore && options.unreadable === 'open') throw Error('cache unavailable');
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name)!;
    return {
      match: async (path: string) => {
        if (name === oldCore && path.includes('/assets/')) {
          if (options.unreadable === 'match') throw Error('entry unavailable');
          if (options.unreadable === 'clone')
            return {
              status: 200,
              clone: () => {
                throw Error('unreadable body');
              },
            };
        }
        const response = store.get(url(path))?.clone();
        if (response) matched.push(response);
        return response;
      },
      put: async (path: string, response: Response) => {
        store.set(url(path), response);
      },
      addAll: async (paths: string[]) => {
        const assets = paths.filter((path) => path.startsWith('/assets/'));
        downloaded.push(...assets);
        if (assets.length) await options.fetchAssets?.(assets);
        for (const path of paths)
          store.set(url(path), new Response(path.includes('/assets/') ? 'network bytes' : '<html></html>'));
      },
      keys: async () => [...store.keys()].map((path) => new Request(path)),
      delete: async (request: Request) => store.delete(request.url),
    };
  };
  const source = readFileSync('public/sw.js', 'utf8')
    .replaceAll('SW_VERSION_PLACEHOLDER', '200')
    .replaceAll('VENDOR_VERSION_PLACEHOLDER', 'same')
    .replace(
      'const ASSISTANT_CAPABILITY_ASSETS = {};',
      `const ASSISTANT_CAPABILITY_ASSETS = ${JSON.stringify({ cpu: [runtimeAsset, helperAsset] })};`,
    );
  runInNewContext(source, {
    URL,
    Promise,
    Date,
    Response,
    Request,
    Headers,
    Set,
    Map,
    self: {
      location: { origin },
      addEventListener: (type: string, listener: (event: any) => void) => listeners.set(type, listener),
      skipWaiting: () => {},
      clients: { matchAll: async () => [], claim },
    },
    caches: {
      open,
      keys: async () => [...stores.keys()],
      has: async (name: string) => stores.has(name),
      delete: async (name: string) => stores.delete(name),
    },
  });
  async function event(type: string, data?: unknown) {
    let job: Promise<unknown> | undefined;
    const reply = vi.fn();
    listeners.get(type)!({
      data,
      ports: [{ postMessage: reply }],
      waitUntil: (promise: Promise<unknown>) => {
        job = promise;
      },
    });
    await job;
    return reply;
  }
  return { event, stores, downloaded, matched, claim };
}

it('reuses identical build assets from an earlier owned core when the network is unavailable', async () => {
  const w = worker(
    {
      [stateCache]: [[markerKey, prepared()]],
      [oldCore]: [
        [
          runtimeAsset,
          new Response(new Uint8Array([0, 97, 115, 109]), {
            headers: { 'Content-Type': 'application/wasm', 'Cross-Origin-Resource-Policy': 'same-origin' },
          }),
        ],
        [helperAsset, new Response('cached helper')],
      ],
    },
    {
      fetchAssets: async () => {
        throw Error('offline');
      },
    },
  );
  await w.event('install');
  const copied = w.stores.get(currentCore)!.get(url(runtimeAsset))!;
  expect([...new Uint8Array(await copied.clone().arrayBuffer())]).toEqual([0, 97, 115, 109]);
  expect(copied.headers.get('Content-Type')).toBe('application/wasm');
  expect(copied.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
  expect(w.matched).not.toContain(copied);
  expect(w.stores.get(oldCore)!.get(url(runtimeAsset))!.bodyUsed).toBe(false);
  expect(w.downloaded).toEqual([]);
  expect(w.stores.get(stateCache)!.has(url(markerKey))).toBe(true);
});

it('keeps current-core hits without downloading or reading an earlier core', async () => {
  const w = worker(
    {
      [currentCore]: [
        [runtimeAsset, new Response('current runtime')],
        [helperAsset, new Response('current helper')],
      ],
    },
    { unreadable: 'open' },
  );
  const reply = await w.event('message', { type: 'PREPARE_ASSISTANT', capability: 'cpu' });
  expect(reply).toHaveBeenCalledWith({ type: 'ASSISTANT_PREPARED', ok: true });
  expect(w.downloaded).toEqual([]);
  expect(await w.stores.get(currentCore)!.get(url(runtimeAsset))!.text()).toBe('current runtime');
});

it.each([
  ['a changed content hash', oldCore, '/assets/cpu-oldhash.wasm'],
  ['a different query', oldCore, `${runtimeAsset}?old=1`],
  ['another origin', oldCore, `https://outside.example${runtimeAsset}`],
  ['an unrelated cache', 'model-provider-cache', runtimeAsset],
  ['a vendor runtime cache', 'document-editor-runtime-same', runtimeAsset],
])('downloads the exact allowlisted URL instead of trusting %s', async (_label, name, path) => {
  const w = worker({ [name]: [[path, new Response('untrusted or stale bytes')]] });
  await w.event('message', { type: 'PREPARE_ASSISTANT', capability: 'cpu' });
  expect(w.downloaded).toEqual([runtimeAsset, helperAsset]);
  expect(await w.stores.get(currentCore)!.get(url(runtimeAsset))!.text()).toBe('network bytes');
});

it.each([undefined, 'open', 'match', 'clone'] as const)(
  'fetches safely when an earlier cache is missing or unreadable: %s',
  async (unreadable) => {
    const w = worker({ [oldCore]: [] }, { unreadable });
    const reply = await w.event('message', { type: 'PREPARE_ASSISTANT', capability: 'cpu' });
    expect(reply).toHaveBeenCalledWith({ type: 'ASSISTANT_PREPARED', ok: true });
    expect(w.downloaded).toEqual([runtimeAsset, helperAsset]);
  },
);

it('does not let a caller add URLs to the build allowlist', async () => {
  const w = worker();
  await w.event('message', {
    type: 'PREPARE_ASSISTANT',
    capability: 'cpu',
    urls: ['/private/file', 'https://outside.example/weights'],
  });
  const rejected = await w.event('message', { type: 'PREPARE_ASSISTANT', capability: '/private/file' });
  expect(rejected).toHaveBeenCalledWith({ type: 'ASSISTANT_PREPARED', ok: false });
  expect(w.downloaded).toEqual([runtimeAsset, helperAsset]);
});

it('shares concurrent preparation and waits for every asset before committing markers', async () => {
  let release!: () => void;
  let started!: () => void;
  const fetching = new Promise<void>((resolve) => {
    started = resolve;
  });
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const w = worker(
    { [oldCore]: [[runtimeAsset, new Response('cached runtime')]] },
    {
      fetchAssets: async () => {
        started();
        await pending;
      },
    },
  );
  const first = w.event('message', { type: 'PREPARE_ASSISTANT', capability: 'cpu' });
  const second = w.event('message', { type: 'PREPARE_ASSISTANT', capability: 'cpu' });
  await fetching;
  expect(w.downloaded).toEqual([helperAsset]);
  expect(w.stores.get(currentCore)!.has(url(markerKey))).toBe(false);
  expect(w.stores.get(stateCache)?.has(url(markerKey)) ?? false).toBe(false);
  release();
  const replies = await Promise.all([first, second]);
  for (const reply of replies) expect(reply).toHaveBeenCalledWith({ type: 'ASSISTANT_PREPARED', ok: true });
  expect(w.stores.get(currentCore)!.has(url(markerKey))).toBe(true);
});

it('preserves earlier caches and rejects activation when any prepared asset is unavailable', async () => {
  const w = worker(
    {
      [oldCore]: [
        [markerKey, prepared()],
        [runtimeAsset, new Response('cached runtime')],
      ],
    },
    {
      fetchAssets: async () => {
        throw Error('offline');
      },
    },
  );
  await expect(w.event('activate')).rejects.toThrow('offline');
  expect(w.stores.has(oldCore)).toBe(true);
  expect(w.stores.get(currentCore)!.has(url(markerKey))).toBe(false);
  expect(w.claim).not.toHaveBeenCalled();
  expect(w.downloaded).toEqual([helperAsset]);
});

it('does not reuse an unsuccessful response from an earlier core', async () => {
  const w = worker({ [oldCore]: [[runtimeAsset, new Response('not available', { status: 404 })]] });
  await w.event('message', { type: 'PREPARE_ASSISTANT', capability: 'cpu' });
  expect(w.downloaded).toEqual([runtimeAsset, helperAsset]);
  expect(await w.stores.get(currentCore)!.get(url(runtimeAsset))!.text()).toBe('network bytes');
});

it('finishes the prepared graph before retiring an earlier core and claiming clients', async () => {
  let release!: () => void;
  let started!: () => void;
  const fetching = new Promise<void>((resolve) => {
    started = resolve;
  });
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const w = worker(
    {
      [oldCore]: [
        [markerKey, prepared()],
        [runtimeAsset, new Response('cached runtime')],
      ],
    },
    {
      fetchAssets: async () => {
        started();
        await pending;
      },
    },
  );
  const activation = w.event('activate');
  await fetching;
  expect(w.stores.has(oldCore)).toBe(true);
  expect(w.stores.get(currentCore)!.has(url(markerKey))).toBe(false);
  expect(w.claim).not.toHaveBeenCalled();
  release();
  await activation;
  expect(w.downloaded).toEqual([helperAsset]);
  expect(w.stores.has(oldCore)).toBe(false);
  expect(w.stores.get(currentCore)!.has(url(markerKey))).toBe(true);
  expect(w.claim).toHaveBeenCalledOnce();
});
