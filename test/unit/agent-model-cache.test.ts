import { beforeEach, expect, it, vi } from 'vitest';
import { Blob } from 'node:buffer';
import {
  deleteCachedModel,
  deleteCachedGGUF,
  rememberModelSource,
  rememberedModelSources,
} from '../../packages/agent-core/src/llm/model-cache';
const sdk = vi.hoisted(() => ({ weights: vi.fn(), config: vi.fn(), wasm: vi.fn() }));
const gguf = vi.hoisted(() => ({
  entries: new Map<string, Blob>(),
  list: vi.fn(),
  remove: vi.fn(),
}));
// Keep the SDK's list/delete/deleteMany behavior real; only browser storage is replaced.
vi.mock('../../packages/agent-core/src/llm/wllama-cache-storage', () => ({
  selectWllamaStorage: async () => ({
    isSupported: () => true,
    list: gguf.list,
    read: async (key: string) => gguf.entries.get(key) ?? null,
    delete: gguf.remove,
  }),
}));
beforeEach(() => {
  gguf.entries.clear();
  gguf.list
    .mockReset()
    .mockImplementation(async () => [...gguf.entries].map(([key, value]) => ({ key, size: value.size })));
  gguf.remove.mockReset().mockImplementation(async (key: string) => {
    gguf.entries.delete(key);
  });
});
function cacheGGUF(key: string, url: string): void {
  gguf.entries.set(key, new Blob(['model']));
  gguf.entries.set(
    `__metadata__${key}`,
    new Blob([JSON.stringify({ originalURL: url, originalSize: 5, etag: 'test' })]),
  );
}
vi.mock('../../packages/agent-core/node_modules/@mlc-ai/web-llm/lib/index.js', () => ({
  deleteModelInCache: sdk.weights,
  deleteChatConfigInCache: sdk.config,
  deleteModelWasmInCache: sdk.wasm,
  prebuiltAppConfig: {
    model_list: [
      { model_id: 'model-a', model: 'https://example.com/model-a', model_lib: 'https://example.com/shared.wasm' },
    ],
  },
}));
it('deletes the selected model while retaining shared runtime files', async () => {
  await deleteCachedModel('model-a');
  expect(sdk.weights).toHaveBeenCalledWith('model-a', expect.objectContaining({ cacheBackend: 'indexeddb' }));
  expect(sdk.config).toHaveBeenCalledWith('model-a', expect.anything());
  expect(sdk.wasm).not.toHaveBeenCalled();
});
it('propagates deletion failure instead of reporting completion', async () => {
  sdk.weights.mockRejectedValueOnce(new Error('storage denied'));
  await expect(deleteCachedModel('model-a')).rejects.toThrow('storage denied');
});

it('retains valid relative artifact sources and rejects unsafe protocols', () => {
  localStorage.clear();
  rememberModelSource({
    id: 'custom',
    label: 'Custom',
    modelUrl: '/models/custom/',
    modelLibUrl: '/models/runtime.wasm',
  });
  expect(rememberedModelSources()).toHaveLength(1);
  rememberModelSource({ id: 'unsafe', label: 'Unsafe', modelUrl: 'file:///models/private' });
  expect(rememberedModelSources().map((item) => item.id)).toEqual(['custom']);
});

it('deletes a GGUF shard group and its metadata with two inventory scans', async () => {
  cacheGGUF('first', 'https://example.com/model-00001-of-00003.gguf?revision=1');
  cacheGGUF('second', 'https://example.com/model-00002-of-00003.gguf?revision=1');
  cacheGGUF('third', 'https://example.com/model-00003-of-00003.gguf?revision=1');
  cacheGGUF('other', 'https://other.example/model-00001-of-00003.gguf?revision=1');
  await deleteCachedGGUF('https://example.com/model-00001-of-00003.gguf?revision=1');
  expect([...gguf.entries.keys()]).toEqual(['other', '__metadata__other']);
  expect(gguf.list).toHaveBeenCalledTimes(2);
});

it('rejects a missing GGUF group without deleting any cache entry', async () => {
  cacheGGUF('other', 'https://example.com/other.gguf');
  await expect(deleteCachedGGUF('https://example.com/missing.gguf')).rejects.toThrow(/no longer available/);
  expect([...gguf.entries.keys()]).toEqual(['other', '__metadata__other']);
});

it('propagates GGUF deletion failure and retains unrelated models', async () => {
  cacheGGUF('model', 'https://example.com/model.gguf');
  cacheGGUF('other', 'https://example.com/other.gguf');
  gguf.remove.mockRejectedValueOnce(new DOMException('Denied', 'UnknownError'));
  await expect(deleteCachedGGUF('https://example.com/model.gguf')).rejects.toMatchObject({ name: 'UnknownError' });
  expect([...gguf.entries.keys()]).toEqual(['model', '__metadata__model', 'other', '__metadata__other']);
});
