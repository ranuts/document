import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { afterEach, expect, it, vi } from 'vitest';
import { prepareAssistantOffline } from '../../lib/assistant-offline';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function worker(addAll = vi.fn(async (_assets: string[]) => {})) {
  const listeners = new Map<string, (event: any) => void>();
  const cache = {
    put: vi.fn(async () => {}),
    addAll,
    match: async (url: string) => (url.includes('/assets/') ? undefined : { text: async () => '<html></html>' }),
  };
  const source = readFileSync('public/sw.js', 'utf8').replace(
    'const ASSISTANT_ASSETS_TO_CACHE = [];',
    'const ASSISTANT_ASSETS_TO_CACHE = ["/assets/agent.js", "/assets/runtime.wasm"];',
  );
  runInNewContext(source, {
    URL,
    Promise,
    Date,
    Response,
    Set,
    self: {
      location: { origin: 'https://editor.example' },
      addEventListener: (type: string, fn: any) => listeners.set(type, fn),
      skipWaiting: () => {},
    },
    caches: { open: async () => cache, keys: async () => [] },
  });
  return { listeners, addAll };
}

it('does not cache optional runtime during installation and prepares it only on request', async () => {
  const { listeners, addAll } = worker();
  let job: Promise<unknown>;
  listeners.get('install')!({
    waitUntil: (value: Promise<unknown>) => {
      job = value;
    },
  });
  await job!;
  expect(addAll.mock.calls.flat(2)).not.toContain('/assets/runtime.wasm');
  addAll.mockClear();
  const reply = vi.fn();
  listeners.get('message')!({
    data: { type: 'PREPARE_ASSISTANT' },
    ports: [{ postMessage: reply }],
    waitUntil: (value: Promise<unknown>) => {
      job = value;
    },
  });
  await job!;
  expect(addAll).toHaveBeenCalledWith(['/assets/agent.js', '/assets/runtime.wasm']);
  expect(reply).toHaveBeenCalledWith({ type: 'ASSISTANT_PREPARED', ok: true });
});

it('reports an optional cache failure and permits a later retry', async () => {
  const addAll = vi.fn(async (_assets: string[]) => {}).mockRejectedValueOnce(new Error('quota'));
  const { listeners } = worker(addAll);
  const reply = vi.fn();
  let job: Promise<unknown>;
  const event = {
    data: { type: 'PREPARE_ASSISTANT' },
    ports: [{ postMessage: reply }],
    waitUntil: (value: Promise<unknown>) => {
      job = value;
    },
  };
  listeners.get('message')!(event);
  await job!;
  expect(reply).toHaveBeenLastCalledWith({ type: 'ASSISTANT_PREPARED', ok: false });
  listeners.get('message')!(event);
  await job!;
  expect(reply).toHaveBeenLastCalledWith({ type: 'ASSISTANT_PREPARED', ok: true });
});

it('bounds a missing worker response and closes message ports', async () => {
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
    { controller: { postMessage }, ready: Promise.resolve({ active: { postMessage } }) },
    50,
  );
  await vi.advanceTimersByTimeAsync(50);
  expect(await pending).toBe(false);
  expect(close).toHaveBeenCalledTimes(2);
});

it('keeps unsupported or failed offline preparation from disabling online use', async () => {
  expect(await prepareAssistantOffline(undefined)).toBe(false);
  expect(await prepareAssistantOffline({ controller: null, ready: Promise.reject(new Error('denied')) }, 50)).toBe(
    false,
  );
});

it('prepares new optional hashes during install when an older build was prepared', async () => {
  const listeners = new Map<string, (event: any) => void>();
  const marker = new Response('1', { headers: { 'X-Document-Assistant-Prepared': '1' } });
  const added: string[] = [];
  const put = vi.fn(async () => {});
  const source = readFileSync('public/sw.js', 'utf8').replace(
    'const ASSISTANT_ASSETS_TO_CACHE = [];',
    'const ASSISTANT_ASSETS_TO_CACHE = ["/assets/agent-new.js", "/assets/engine-new.wasm"];',
  );
  runInNewContext(source, {
    URL,
    Promise,
    Date,
    Set,
    Response,
    self: {
      location: { origin: 'https://editor.example' },
      addEventListener: (type: string, fn: any) => listeners.set(type, fn),
      skipWaiting: () => {},
    },
    caches: {
      keys: async () => [],
      match: async () => marker,
      open: async () => ({
        addAll: async (assets: string[]) => {
          added.push(...assets);
        },
        put,
        match: async (path: string) => (path.includes('/assets/') ? undefined : { text: async () => '<html></html>' }),
      }),
    },
  });
  let install: Promise<unknown>;
  listeners.get('install')!({
    waitUntil: (value: Promise<unknown>) => {
      install = value;
    },
  });
  await install!;
  expect(added).toContain('/assets/agent-new.js');
  expect(added).toContain('/assets/engine-new.wasm');
  expect(put).toHaveBeenCalledWith('/__document-assistant-prepared__', expect.any(Response));
});

it('rechecks preparation committed by the outgoing worker during installation', async () => {
  const listeners = new Map<string, (event: any) => void>();
  let marker: Response | undefined;
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  const added: string[] = [];
  const source = readFileSync('public/sw.js', 'utf8').replace(
    'const ASSISTANT_ASSETS_TO_CACHE = [];',
    'const ASSISTANT_ASSETS_TO_CACHE = ["/assets/new-engine.wasm"];',
  );
  runInNewContext(source, {
    URL,
    Promise,
    Date,
    Set,
    Response,
    self: {
      location: { origin: 'https://editor.example' },
      addEventListener: (type: string, fn: any) => listeners.set(type, fn),
      skipWaiting: () => {},
    },
    caches: {
      keys: async () => [],
      match: async () => marker,
      open: async () => ({
        addAll: async (assets: string[]) => {
          if (assets.includes('./editor')) await barrier;
          added.push(...assets);
        },
        put: async () => {},
        match: async (path: string) => (path.includes('/assets/') ? undefined : { text: async () => '<html></html>' }),
      }),
    },
  });
  let install: Promise<unknown>;
  listeners.get('install')!({
    waitUntil: (value: Promise<unknown>) => {
      install = value;
    },
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(added).not.toContain('/assets/new-engine.wasm');
  marker = new Response('1', { headers: { 'X-Document-Assistant-Prepared': '1' } });
  release();
  await install!;
  expect(added).toContain('/assets/new-engine.wasm');
});

it('migrates a remembered landing-page opt-in without starting a model', async () => {
  const postMessage = vi.fn();
  const close = vi.fn();
  let factory: any;
  const global = {
    localStorage: { getItem: () => 'true' },
    setTimeout: vi.fn(() => 1),
    clearTimeout: vi.fn(),
  };
  runInNewContext(readFileSync('public/sw-register.js', 'utf8'), {
    window: global,
    Promise,
    MessageChannel: class {
      port1 = { close, onmessage: null };
      port2 = { close };
    },
  });
  factory = (global as any).__createSwUpdater;
  const registration = {
    installing: { postMessage, state: 'installing', addEventListener: vi.fn() },
    active: null,
    waiting: null,
    addEventListener: vi.fn(),
  };
  await factory({ serviceWorker: { register: async () => registration, controller: null } }).start();
  expect(postMessage.mock.calls[0][0]).toEqual({ type: 'PREPARE_ASSISTANT' });
  expect(postMessage.mock.calls[0][1]).toHaveLength(1);
});
