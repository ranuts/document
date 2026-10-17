import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { afterEach, expect, it, vi } from 'vitest';
import { prepareAssistantOffline } from '../../lib/assistant-offline';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const capabilities = {
  webgpu: ['/assets/gpu.js'],
  cpu: ['/assets/cpu.wasm'],
  'cpu-compat': ['/assets/compat.wasm'],
  pdf: ['/assets/pdf.mjs'],
};
function worker(initial: Record<string, Map<string, Response>> = {}, fail = false) {
  const stores = new Map(Object.entries(initial));
  const listeners = new Map<string, (event: any) => void>();
  const added: string[] = [];
  const deleted: string[] = [];
  const open = async (name: string) => {
    let store = stores.get(name);
    if (!store) {
      store = new Map();
      stores.set(name, store);
    }
    return {
      match: async (url: string) =>
        store!.get(url) ??
        (!url.includes('/assets/') && !url.includes('__document') ? { text: async () => '<html></html>' } : undefined),
      put: async (url: string, response: Response) => {
        store!.set(url, response);
      },
      addAll: async (urls: string[]) => {
        if (fail && urls.some((u) => u.startsWith('/assets/'))) throw Error('quota');
        for (const url of urls) {
          added.push(url);
          store!.set(url, new Response('payload'));
        }
      },
      keys: async () => [...store!.keys()].map((url) => new Request(new URL(url, 'https://editor.example'))),
      delete: async (request: Request) => store!.delete(new URL(request.url).pathname),
    };
  };
  const source = readFileSync('public/sw.js', 'utf8').replace(
    'const ASSISTANT_CAPABILITY_ASSETS = {};',
    `const ASSISTANT_CAPABILITY_ASSETS = ${JSON.stringify(capabilities)};`,
  );
  runInNewContext(source, {
    URL,
    Promise,
    Date,
    Response,
    Set,
    Map,
    self: {
      location: { origin: 'https://editor.example' },
      addEventListener: (type: string, fn: any) => listeners.set(type, fn),
      skipWaiting: () => {},
      clients: { matchAll: async () => [], claim: async () => {} },
    },
    caches: {
      open,
      keys: async () => [...stores.keys()],
      has: async (name: string) => stores.has(name),
      delete: async (name: string) => {
        deleted.push(name);
        return stores.delete(name);
      },
      match: async (url: string) => {
        for (const store of stores.values()) if (store.has(url)) return store.get(url);
      },
    },
  });
  async function event(type: string, data?: unknown) {
    let job: Promise<unknown> | undefined;
    const reply = vi.fn();
    listeners.get(type)!({
      data,
      ports: [{ postMessage: reply }],
      waitUntil: (p: Promise<unknown>) => {
        job = p;
      },
    });
    await job;
    return reply;
  }
  return {
    added,
    stores,
    event,
    deleted,
    setFailure: (value: boolean) => {
      fail = value;
    },
  };
}
const marker = (capability: string) => `/__document-assistant-prepared__/${capability}`;
const prepared = () => new Response('1', { headers: { 'X-Document-Assistant-Prepared': '1' } });

it('installs no local runtime and prepares only the activated capability', async () => {
  const w = worker();
  await w.event('install');
  expect(w.added.filter((a) => a.startsWith('/assets/'))).toEqual([]);
  const reply = await w.event('message', { type: 'PREPARE_ASSISTANT', capability: 'cpu' });
  expect(w.added.filter((a) => a.startsWith('/assets/'))).toEqual(['/assets/cpu.wasm']);
  expect(reply).toHaveBeenCalledWith({ type: 'ASSISTANT_PREPARED', ok: true });
  await w.event('message', { type: 'PREPARE_ASSISTANT', capability: 'pdf' });
  expect(w.added).toContain('/assets/pdf.mjs');
  expect(w.added).not.toContain('/assets/gpu.js');
  expect(w.added).not.toContain('/assets/compat.wasm');
});
it('ignores legacy generic opt-in and rejects arbitrary capability URLs', async () => {
  const w = worker();
  await w.event('message', { type: 'PREPARE_ASSISTANT' });
  const reply = await w.event('message', { type: 'PREPARE_ASSISTANT', capability: 'https://external.example/model' });
  expect(reply).toHaveBeenCalledWith({ type: 'ASSISTANT_PREPARED', ok: false });
  expect(w.added).toEqual([]);
});
it('retries quota failure without marking a capability as prepared', async () => {
  const w = worker({}, true);
  const reply = await w.event('message', { type: 'PREPARE_ASSISTANT', capability: 'cpu' });
  expect(reply).toHaveBeenCalledWith({ type: 'ASSISTANT_PREPARED', ok: false });
  expect([...w.stores.values()].some((s) => s.has(marker('cpu')))).toBe(false);
  w.setFailure(false);
  const retry = await w.event('message', { type: 'PREPARE_ASSISTANT', capability: 'cpu' });
  expect(retry).toHaveBeenCalledWith({ type: 'ASSISTANT_PREPARED', ok: true });
});
it('restores the union of capabilities across earlier builds before retiring them', async () => {
  const w = worker({
    'document-editor-core-old-a': new Map([[marker('cpu'), prepared()]]),
    'document-editor-core-old-b': new Map([[marker('pdf'), prepared()]]),
  });
  await w.event('install');
  expect(w.added).toContain('/assets/cpu.wasm');
  expect(w.added).toContain('/assets/pdf.mjs');
  expect(w.added).not.toContain('/assets/gpu.js');
  await w.event('activate');
  expect(w.deleted).toContain('document-editor-core-old-a');
  expect([...w.stores.values()].some((s) => s.has(marker('cpu')))).toBe(true);
  expect([...w.stores.values()].some((s) => s.has(marker('pdf')))).toBe(true);
});
it('migrates old all-runtime preparation and catches preparation committed after install', async () => {
  const old = new Map<string, Response>();
  const w = worker({ 'document-editor-core-old': old });
  await w.event('install');
  old.set('/__document-assistant-prepared__', prepared());
  await w.event('activate');
  expect(w.added).toContain('/assets/gpu.js');
  expect(w.added).toContain('/assets/cpu.wasm');
  expect(w.added).toContain('/assets/compat.wasm');
  expect(w.added).toContain('/assets/pdf.mjs');
});
it('sends the selected capability and bounds missing worker replies', async () => {
  vi.useFakeTimers();
  const close = vi.fn();
  vi.stubGlobal(
    'MessageChannel',
    class {
      port1 = { onmessage: null, close };
      port2 = { close };
    },
  );
  const postMessage = vi.fn();
  const pending = prepareAssistantOffline(
    'cpu',
    { controller: { postMessage }, ready: Promise.resolve({ active: { postMessage } }) },
    50,
  );
  expect(postMessage.mock.calls[0][0]).toEqual({ type: 'PREPARE_ASSISTANT', capability: 'cpu' });
  await vi.advanceTimersByTimeAsync(50);
  expect(await pending).toBe(false);
  expect(close).toHaveBeenCalledTimes(2);
});
it('keeps failed worker readiness from disabling online use', async () => {
  expect(await prepareAssistantOffline('cpu', { controller: null, ready: Promise.reject(Error('denied')) }, 50)).toBe(
    false,
  );
});
it('remembered generic opt-in on Home never prepares local runtimes', async () => {
  const postMessage = vi.fn();
  const global = { localStorage: { getItem: () => 'true' }, setTimeout: vi.fn(() => 1), clearTimeout: vi.fn() };
  runInNewContext(readFileSync('public/sw-register.js', 'utf8'), {
    window: global,
    Promise,
    MessageChannel: class {
      port1 = { close: vi.fn(), onmessage: null };
      port2 = { close: vi.fn() };
    },
  });
  const registration = {
    installing: { postMessage, state: 'installing', addEventListener: vi.fn() },
    active: null,
    waiting: null,
    addEventListener: vi.fn(),
  };
  await (global as any)
    .__createSwUpdater({ serviceWorker: { register: async () => registration, controller: null } })
    .start();
  expect(postMessage).not.toHaveBeenCalled();
});
