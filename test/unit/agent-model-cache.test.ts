import { expect, it, vi } from 'vitest';
import {
  deleteCachedModel,
  rememberModelSource,
  rememberedModelSources,
} from '../../packages/agent-core/src/llm/model-cache';
const sdk = vi.hoisted(() => ({ weights: vi.fn(), config: vi.fn(), wasm: vi.fn() }));
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
