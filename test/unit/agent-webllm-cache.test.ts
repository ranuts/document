import { afterEach, expect, it, vi } from 'vitest';
import { isModelCached, WebLLMProvider } from '../../packages/agent-core/src/llm/webllm';
const sdk = vi.hoisted(() => ({ check: vi.fn().mockResolvedValue(true), construct: vi.fn() }));
vi.mock('../../packages/agent-core/node_modules/@mlc-ai/web-llm', () => ({
  prebuiltAppConfig: { model_list: [{ model_id: 'test' }] },
  hasModelInCache: sdk.check,
  WebWorkerMLCEngine: class {
    chat = {};
    constructor(_worker: unknown, options: unknown) {
      sdk.construct(options);
    }
    async reload() {}
  },
}));
afterEach(() => vi.unstubAllGlobals());
it('checks model caches using IndexedDB with the SDK model catalogue', async () => {
  await isModelCached('test');
  expect(sdk.check).toHaveBeenCalledWith('test', { model_list: [{ model_id: 'test' }], cacheBackend: 'indexeddb' });
});
it('initialises workers using the same IndexedDB app configuration', async () => {
  vi.stubGlobal('navigator', { gpu: { requestAdapter: async () => ({ features: new Set(['shader-f16']) }) } });
  vi.stubGlobal(
    'Worker',
    class {
      addEventListener() {}
      terminate() {}
    },
  );
  const provider = new WebLLMProvider();
  await provider.preload();
  expect(sdk.construct).toHaveBeenCalledWith(
    expect.objectContaining({ appConfig: { model_list: [{ model_id: 'test' }], cacheBackend: 'indexeddb' } }),
  );
  await provider.dispose();
});
