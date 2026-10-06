import { expect, it, vi } from 'vitest';
import { WllamaProvider } from '../../packages/agent-core/src/llm/wllama';

const state = vi.hoisted(() => ({
  entered: undefined as undefined | (() => void),
  reject: undefined as undefined | ((error: Error) => void),
  exits: 0,
}));
vi.mock('../../packages/agent-core/src/llm/wllama-cache-storage', () => ({
  selectWllamaStorage: async () => undefined,
}));
vi.mock('../../packages/agent-core/src/llm/wllama-compat-assets', () => ({ getWllamaCompatibility: async () => null }));
vi.mock('../../packages/agent-core/node_modules/@wllama/wllama/esm/index.js', () => ({
  CacheManager: class {},
  Wllama: class {
    setCompat() {}
    isModelLoaded() {
      return false;
    }
    loadModelFromUrl() {
      return new Promise((_resolve, reject) => {
        state.reject = reject;
        state.entered?.();
      });
    }
    async exit() {
      state.exits++;
      state.reject?.(new Error('Worker terminated'));
    }
  },
}));

it('owns and releases the worker while SDK initialization is still pending', async () => {
  state.exits = 0;
  const entered = new Promise<void>((resolve) => {
    state.entered = resolve;
  });
  const provider = new WllamaProvider({ modelUrl: 'https://models.example/model.gguf', wasmUrl: '/local.wasm' });
  const loading = provider.preload();
  const outcome = loading.then(
    () => ({ name: 'unexpected success' }),
    (error) => error,
  );
  await entered;
  await provider.dispose();
  expect(state.exits).toBe(1);
  expect(await outcome).toMatchObject({ name: 'AbortError' });
  await provider.dispose();
  expect(state.exits).toBe(1);
  expect(provider.isReady()).toBe(false);
});
