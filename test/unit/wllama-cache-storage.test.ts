import { expect, it } from 'vitest';
import { CacheAPIStorage, selectWllamaStorage } from '../../packages/agent-core/src/llm/wllama-cache-storage';

function memoryCache(): Cache {
  const entries = new Map<string, Response>();
  return {
    async put(key: string, response: Response) {
      entries.set(key, new Response(await response.arrayBuffer()));
    },
    async match(key: string) {
      return entries.get(key)?.clone();
    },
    async keys() {
      return [...entries.keys()].map((key) => new Request(key));
    },
    async delete(key: string) {
      return entries.delete(key);
    },
  } as unknown as Cache;
}

it('round trips model and metadata keys without interpreting URLs or slashes', async () => {
  const storage = new CacheAPIStorage(memoryCache(), 'https://editor.example');
  const key = 'https://other.example/model?x=/中文';
  await storage.write(key, new Response('model').body!);
  await storage.write('__metadata__model', new Response('{}').body!);
  expect(await (await storage.read(key))?.text()).toBe('model');
  expect(await storage.getSize(key)).toBe(5);
  expect(await storage.list()).toEqual([
    { key, size: 5 },
    { key: '__metadata__model', size: 2 },
  ]);
  await storage.delete(key);
  await storage.delete(key);
  expect(await storage.read(key)).toBeNull();
  expect(await storage.getSize(key)).toBe(-1);
  expect(await storage.list()).toEqual([{ key: '__metadata__model', size: 2 }]);
});

it('propagates cache write failures instead of reporting a saved model', async () => {
  const cache = memoryCache();
  cache.put = async () => {
    throw new DOMException('Full', 'QuotaExceededError');
  };
  const storage = new CacheAPIStorage(cache, 'https://editor.example');
  await expect(storage.write('model', new Response('model').body!)).rejects.toMatchObject({
    name: 'QuotaExceededError',
  });
  expect(await storage.read('model')).toBeNull();
});

it('preserves the default backend when OPFS actually opens', async () => {
  expect(
    await selectWllamaStorage(
      async () => ({}),
      async () => {
        throw new Error('must not open fallback');
      },
      'https://editor.example',
    ),
  ).toBeUndefined();
});

it('selects usable Cache API storage when the OPFS method exists but rejects', async () => {
  const storage = await selectWllamaStorage(
    async () => {
      throw new DOMException('Denied', 'UnknownError');
    },
    async () => memoryCache(),
    'https://editor.example',
  );
  await storage!.write('model', new Response('saved').body!);
  expect(await (await storage!.read('model'))?.text()).toBe('saved');
});

it('reports fallback storage failure without creating an ephemeral success', async () => {
  await expect(
    selectWllamaStorage(
      undefined,
      async () => {
        throw new Error('Cache unavailable');
      },
      'https://editor.example',
    ),
  ).rejects.toThrow('Cache unavailable');
});
