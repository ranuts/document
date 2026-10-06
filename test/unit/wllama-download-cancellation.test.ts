import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { Blob as NodeBlob } from 'node:buffer';
import { CacheManager, ModelManager } from '../../packages/agent-core/node_modules/@wllama/wllama/esm/index.js';

beforeEach(() => vi.stubGlobal('Blob', NodeBlob));
afterEach(() => vi.unstubAllGlobals());

it.each(['metadata', 'cache-head', 'model-head'] as const)(
  'cancels pending SDK %s without starting a model GET or deleting cache',
  async (phase) => {
    const controller = new AbortController();
    const remove = vi.fn(async () => {});
    const backend = {
      isSupported: () => true,
      read: async () => null,
      write: async () => {},
      getSize: async () => (phase === 'cache-head' ? 16 : -1),
      list: async () => [],
      delete: remove,
    };
    const cache = new CacheManager([backend]);
    let release!: (error: unknown) => void;
    const fetcher = vi.fn((_url: unknown, init?: RequestInit) => {
      if (fetcher.mock.calls.length > 1) return Promise.reject(new Error('Unexpected request after cancellation'));
      return new Promise<Response>((_resolve, reject) => {
        release = reject;
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
      });
    });
    vi.stubGlobal('fetch', fetcher);
    const url =
      phase === 'metadata'
        ? 'https://huggingface.co/example/model/resolve/pinned/model.gguf'
        : 'https://models.example/model.gguf';
    const options = { signal: controller.signal, headers: { 'X-Test': 'marker' } };
    const loading =
      phase === 'model-head'
        ? new ModelManager({ cacheManager: cache, logger: { ...console, debug: () => {} } }).downloadModel(
            { url },
            options,
          )
        : cache.download(url, options);
    const outcome = loading.then(
      () => 'unexpected success',
      (error) => error,
    );
    try {
      await vi.waitFor(() => expect(fetcher).toHaveBeenCalled());
      expect(fetcher.mock.calls[0][1]?.signal).toBe(controller.signal);
      expect(fetcher.mock.calls[0][1]?.headers).toEqual(options.headers);
      controller.abort();
      expect(await outcome).toMatchObject({ name: 'AbortError' });
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(remove).not.toHaveBeenCalled();
    } finally {
      controller.abort();
      release?.(controller.signal.reason);
      await outcome;
      vi.unstubAllGlobals();
    }
  },
);

it.each(['delete', 'write'] as const)(
  'checks cancellation after pending cache %s before further work',
  async (phase) => {
    const controller = new AbortController();
    let release!: () => void;
    const pending = vi.fn(() =>
      pending.mock.calls.length > 1
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            release = resolve;
          }),
    );
    const backend = {
      isSupported: () => true,
      read: async () => null,
      write: phase === 'write' ? pending : vi.fn(async () => {}),
      getSize: async () => 16,
      list: async () => [],
      delete: phase === 'delete' ? pending : vi.fn(async () => {}),
    };
    const fetcher = vi.fn(() =>
      fetcher.mock.calls.length > 1
        ? Promise.reject(new Error('Unexpected model GET'))
        : Promise.resolve(new Response(null, { headers: { 'content-length': phase === 'delete' ? '32' : '16' } })),
    );
    vi.stubGlobal('fetch', fetcher);
    const cache = new CacheManager([backend]);
    const outcome = cache.download('https://models.example/model.gguf', { signal: controller.signal }).then(
      () => 'unexpected success',
      (error) => error,
    );
    try {
      await vi.waitFor(() => expect(pending).toHaveBeenCalled());
      controller.abort();
      release();
      expect(await outcome).toMatchObject({ name: 'AbortError' });
      expect(pending).toHaveBeenCalledTimes(1);
      expect(fetcher).toHaveBeenCalledTimes(1);
    } finally {
      controller.abort();
      release?.();
      await outcome;
      vi.unstubAllGlobals();
    }
  },
);

it.each([1, 2])('rejects cancellation during downloaded file write stage %i', async (stage) => {
  const controller = new AbortController();
  let release!: () => void;
  const write = vi.fn(() =>
    write.mock.calls.length === stage
      ? new Promise<void>((resolve) => {
          release = resolve;
        })
      : Promise.resolve(),
  );
  const backend = {
    isSupported: () => true,
    read: async () => null,
    write,
    getSize: async () => -1,
    list: async () => [],
    delete: vi.fn(async () => {}),
  };
  const fetcher = vi.fn(async () => new Response('model bytes', { headers: { 'content-length': '11' } }));
  vi.stubGlobal('fetch', fetcher);
  const outcome = new CacheManager([backend])
    .download('https://models.example/model.gguf', { signal: controller.signal })
    .then(
      () => 'unexpected success',
      (error) => error,
    );
  try {
    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(stage));
    controller.abort();
    release();
    expect(await outcome).toMatchObject({ name: 'AbortError' });
    expect(write).toHaveBeenCalledTimes(stage);
  } finally {
    controller.abort();
    release?.();
    await outcome;
    vi.unstubAllGlobals();
  }
});

it('keeps ordinary offline metadata failure compatible with a valid cached model', async () => {
  const url = 'https://huggingface.co/example/model/resolve/pinned/model.gguf';
  const backend = {
    isSupported: () => true,
    read: async () => new Blob([JSON.stringify({ originalURL: url, originalSize: 16, etag: 'cached' })]),
    write: vi.fn(async () => {}),
    getSize: async () => 16,
    list: async () => [],
    delete: vi.fn(async () => {}),
  };
  const fetcher = vi.fn(async () => {
    throw new Error('Network unavailable');
  });
  vi.stubGlobal('fetch', fetcher);
  await new CacheManager([backend]).download(url, { signal: new AbortController().signal });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(backend.write).not.toHaveBeenCalled();
  expect(backend.delete).not.toHaveBeenCalled();
});

it('does not touch network or cache for an already canceled download', async () => {
  const controller = new AbortController();
  controller.abort();
  const getSize = vi.fn(async () => -1);
  const backend = {
    isSupported: () => true,
    read: async () => null,
    write: async () => {},
    getSize,
    list: async () => [],
    delete: async () => {},
  };
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  await expect(
    new CacheManager([backend]).download('https://models.example/model.gguf', { signal: controller.signal }),
  ).rejects.toMatchObject({ name: 'AbortError' });
  expect(fetcher).not.toHaveBeenCalled();
  expect(getSize).not.toHaveBeenCalled();
});
