import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const origin = 'https://editor.example';
const oldAsset = `${origin}/assets/old-lazy.js`;
const oldCore = 'document-editor-core-100';
const source = readFileSync(resolve('public/sw.js'), 'utf8')
  .replaceAll('SW_VERSION_PLACEHOLDER', '200')
  .replaceAll('VENDOR_VERSION_PLACEHOLDER', 'same');

describe('deploy preserves lazy chunks for live pages', () => {
  it.each([true, false])('retains old core only with a live window: %s', async (live) => {
    const stores = new Map<string, Map<string, Response>>([
      [oldCore, new Map([[oldAsset, new Response('export const oldBuild = true;')]])],
      ['document-editor-core-200', new Map()],
      ['document-editor-runtime-same', new Map()],
    ]);
    const listeners = new Map<string, (event: any) => void>();
    const caches = {
      keys: async () => [...stores.keys()],
      has: async (name: string) => stores.has(name),
      delete: async (name: string) => stores.delete(name),
      match: async (request: string | { url: string }) => {
        const url = typeof request === 'string' ? request : request.url;
        for (const store of stores.values()) {
          const response = store.get(url);
          if (response) return response.clone();
        }
        return undefined;
      },
      open: async (name: string) => {
        if (!stores.has(name)) stores.set(name, new Map());
        const store = stores.get(name)!;
        return {
          keys: async () => [...store.keys()].map((url) => ({ url })),
          delete: async ({ url }: { url: string }) => store.delete(url),
          put: async (url: string, response: Response) => store.set(url, response),
        };
      },
    };
    runInNewContext(source, {
      URL,
      Date,
      Promise,
      Response,
      Headers,
      caches,
      fetch: async () => new Response('Retired build', { status: 404 }),
      self: {
        location: { origin },
        addEventListener: (type: string, listener: (event: any) => void) => listeners.set(type, listener),
        clients: { matchAll: async () => (live ? [{ url: `${origin}/editor` }] : []), claim: () => {} },
      },
    });
    const lifetime: Promise<unknown>[] = [];
    const waitUntil = (promise: Promise<unknown>) => lifetime.push(promise);
    listeners.get('activate')!({ waitUntil });
    await Promise.all(lifetime);
    expect(stores.has(oldCore)).toBe(live);
    if (live) {
      let response!: Promise<Response>;
      listeners.get('fetch')!({
        request: { url: oldAsset, method: 'GET' },
        waitUntil,
        respondWith: (value: Promise<Response>) => (response = value),
      });
      expect(await (await response).text()).toBe('export const oldBuild = true;');
      await Promise.all(lifetime);
    }
  });
});

it.each(['/editor.html', '/editor', '/theme-presentation.js'])(
  'offline stable URL %s uses the current core',
  async (path) => {
    const url = `${origin}${path}`;
    const stores = new Map([
      [oldCore, new Map([[url, new Response('old build')]])],
      ['document-editor-core-200', new Map([[url, new Response('new build')]])],
    ]);
    const listeners = new Map<string, (event: any) => void>();
    const key = (request: string | { url: string }) => (typeof request === 'string' ? request : request.url);
    runInNewContext(source, {
      URL,
      Date,
      Promise,
      Response,
      Headers,
      fetch: async () => {
        throw new Error('Offline');
      },
      self: {
        location: { origin },
        addEventListener: (type: string, callback: (event: any) => void) => listeners.set(type, callback),
      },
      caches: {
        match: async (request: string | { url: string }, options?: { cacheName?: string }) => {
          for (const [name, store] of stores) {
            if (options?.cacheName && name !== options.cacheName) continue;
            const response = store.get(key(request));
            if (response) return response.clone();
          }
          return undefined;
        },
        open: async (name: string) => ({
          match: async (request: string | { url: string }) => stores.get(name)?.get(key(request))?.clone(),
        }),
      },
    });
    let response!: Promise<Response>;
    listeners.get('fetch')!({
      request: { url, method: 'GET', mode: path.startsWith('/editor') ? 'navigate' : 'cors' },
      respondWith: (value: Promise<Response>) => (response = value),
      waitUntil: () => {},
    });
    expect(await (await response).text()).toBe('new build');
  },
);
