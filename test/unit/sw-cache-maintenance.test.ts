// Exercise the shipped worker in its own global scope, including waitUntil.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const workerSource = readFileSync(resolve('public/sw.js'), 'utf8');
const origin = 'https://editor.example';
const vendor = new URL('/sdkjs/word/sdk-all.js', origin).href;
const retiredAsset = new URL('/assets/retired.js', origin).href;

function worker(cache: {
  match: () => Promise<undefined>;
  put: () => Promise<void>;
  keys: () => Promise<{ url: string }[]>;
  delete: (request: { url: string }) => Promise<boolean>;
}) {
  const listeners = new Map<string, (event: any) => void>();
  runInNewContext(workerSource, {
    URL,
    Date,
    Promise,
    self: {
      location: { origin },
      addEventListener: (type: string, listener: (event: any) => void) => listeners.set(type, listener),
    },
    caches: { open: async () => cache },
    fetch: async () => ({
      status: 200,
      type: 'basic',
      clone() {
        return this;
      },
    }),
  });
  const lifetime: Promise<unknown>[] = [];
  let response: Promise<unknown> = Promise.resolve();
  listeners.get('fetch')!({
    request: { url: vendor, method: 'GET' },
    respondWith: (promise: Promise<unknown>) => {
      response = promise;
    },
    waitUntil: (promise: Promise<unknown>) => lifetime.push(promise),
  });
  return { response, lifetime };
}

describe('worker cache maintenance lifetime', () => {
  it('finishes eviction before its waitUntil promise settles and preserves vendor assets', async () => {
    let releaseKeys!: (keys: { url: string }[]) => void;
    const pendingKeys = new Promise<{ url: string }[]>((resolve) => {
      releaseKeys = resolve;
    });
    const entries = Array.from({ length: 2000 }, (_, index) => ({ url: `${vendor}?part=${index}` }));
    entries.push({ url: retiredAsset });
    let evicted = '';
    const { response, lifetime } = worker({
      match: async () => undefined,
      put: async () => {},
      keys: async () => pendingKeys,
      delete: async (request) => {
        evicted = request.url;
        entries.splice(entries.indexOf(request), 1);
        return true;
      },
    });
    await response;
    let completed = false;
    const work = Promise.all(lifetime).then(() => {
      completed = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(completed).toBe(false);
    releaseKeys(entries);
    await work;
    expect(evicted).toBe(retiredAsset);
    expect(entries).toHaveLength(2000);
  });

  it('keeps a successful network response when cache maintenance fails', async () => {
    const { response, lifetime } = worker({
      match: async () => undefined,
      put: async () => {},
      keys: async () => {
        throw new Error('Storage unavailable');
      },
      delete: async () => true,
    });
    await expect(response).resolves.toMatchObject({ status: 200 });
    await expect(Promise.all(lifetime)).resolves.toBeDefined();
  });
});
