import { afterEach, expect, it, vi } from 'vitest';
import { LocalInferenceProvider } from '../../packages/agent-core/src/llm/local';
import { WebLLMProvider } from '../../packages/agent-core/src/llm/webllm';

const state = vi.hoisted(() => ({ gpuReload: vi.fn(async () => {}), cpuLoaded: false }));
vi.mock('../../packages/agent-core/node_modules/@mlc-ai/web-llm', () => ({
  prebuiltAppConfig: { model_list: [] },
  WebWorkerMLCEngine: class {
    chat = { completions: { create: vi.fn() } };
    reload = state.gpuReload;
  },
}));
vi.mock('../../packages/agent-core/src/llm/wllama-cache-storage', () => ({
  selectWllamaStorage: async () => undefined,
}));
vi.mock('../../packages/agent-core/src/llm/wllama-cpu-runtime', () => ({
  loadWllamaCPURuntime: async () => ({
    Wllama: class {
      setCompat() {}
      isModelLoaded() {
        return state.cpuLoaded;
      }
      async loadModelFromUrl() {
        state.cpuLoaded = true;
      }
      async exit() {
        state.cpuLoaded = false;
      }
    },
    wasmUrl: '/cpu.wasm',
    compatibility: null,
  }),
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  state.cpuLoaded = false;
});
function browser() {
  vi.stubGlobal('navigator', { gpu: { requestAdapter: async () => ({ features: new Set(['shader-f16']) }) } });
  vi.stubGlobal(
    'Worker',
    class {
      addEventListener() {}
      terminate() {}
    },
  );
}
it('prepares WebGPU only when a supported default runtime starts and ignores a hung host cache', async () => {
  browser();
  const prepare = vi.fn(() => new Promise(() => {}));
  const provider = new WebLLMProvider({ prepareRuntimeAssets: prepare });
  expect(prepare).not.toHaveBeenCalled();
  await provider.preload();
  expect(prepare.mock.calls).toEqual([['webgpu']]);
  expect(state.gpuReload).toHaveBeenCalled();
  await provider.dispose();
});
it('forwards host preparation to the selected CPU backend and tolerates rejected persistence', async () => {
  browser();
  const prepare = vi.fn(async () => {
    throw Error('quota');
  });
  const provider = new LocalInferenceProvider({ detectGPU: async () => false, prepareRuntimeAssets: prepare });
  await provider.preload();
  expect(provider.backend).toBe('wllama');
  expect(prepare.mock.calls).toEqual([['cpu']]);
  expect(state.gpuReload).not.toHaveBeenCalled();
  await provider.dispose();
});
it('forwards host preparation to WebGPU without preparing the unused CPU backend', async () => {
  browser();
  const prepare = vi.fn();
  const provider = new LocalInferenceProvider({ detectGPU: async () => true, prepareRuntimeAssets: prepare });
  await provider.preload();
  expect(provider.backend).toBe('webllm');
  expect(prepare.mock.calls).toEqual([['webgpu']]);
  await provider.dispose();
});
