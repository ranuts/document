import { readFileSync } from 'node:fs';
import { Blob } from 'node:buffer';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

// Exercise the actual installed SDK cache implementation, including our versioned patch.
const source = readFileSync(
  process.env.WEBLLM_CACHE_SOURCE ?? 'packages/agent-core/node_modules/@mlc-ai/web-llm/lib/index.js',
  'utf8',
);
const start = source.indexOf('class ArtifactIndexedDBCache {');
const end = source.indexOf('class ArtifactOPFSCache {', start);
const code = source.slice(start, end).replace(/\/\*\*[\s\S]*?\*\//g, '');
const awaiter = (context: unknown, args: unknown[], _promise: unknown, generator: (...args: unknown[]) => Generator) =>
  new Promise((resolve, reject) => {
    const iterator = generator.apply(context, args ?? []);
    const step = (value?: unknown): void => {
      let result;
      try {
        result = iterator.next(value);
      } catch (error) {
        reject(error);
        return;
      }
      if (result.done) resolve(result.value);
      else Promise.resolve(result.value).then(step, reject);
    };
    step();
  });
const Cache = new Function('__awaiter', `return ${code}`)(awaiter);
beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.stubGlobal('Blob', Blob);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('stores model buffers as Blob records and reconstructs exact bytes', async () => {
  const cache = new Cache('test-model');
  const data = new Uint8Array([0, 1, 254, 255]).buffer;
  await cache.addToIndexedDB('model.bin', { arrayBuffer: async () => data }, 'arraybuffer');
  const record = await cache.asyncGetHelper('model.bin');
  expect(record.data).toBeInstanceOf(Blob);
  expect(new Uint8Array(await cache.fetchWithCache('model.bin', 'arraybuffer'))).toEqual(new Uint8Array(data));
});
it('rejects transaction aborts even when a write request succeeded', async () => {
  const add = IDBObjectStore.prototype.add;
  vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(function (
    this: IDBObjectStore,
    ...args: Parameters<typeof add>
  ) {
    const request = add.apply(this, args);
    request.addEventListener('success', () => this.transaction.abort());
    return request;
  });
  const cache = new Cache('test-abort');
  await expect(
    cache.addToIndexedDB('model.bin', { arrayBuffer: async () => new ArrayBuffer(4) }, 'arraybuffer'),
  ).rejects.toBeTruthy();
});

it('keeps legacy ArrayBuffer records and JSON configuration readable', async () => {
  const cache = new Cache('test-compatibility');
  await cache.initDB();
  const data = new Uint8Array([3, 2, 1]).buffer;
  await new Promise<void>((resolve, reject) => {
    const transaction = cache.db.transaction('urls', 'readwrite');
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.objectStore('urls').add({ url: 'legacy.bin', data });
  });
  expect(new Uint8Array(await cache.fetchWithCache('legacy.bin', 'arraybuffer'))).toEqual(new Uint8Array(data));
  await cache.addToIndexedDB('config.json', { json: async () => ({ model: 'test' }) }, 'json');
  expect(await cache.fetchWithCache('config.json', 'json')).toEqual({ model: 'test' });
});
