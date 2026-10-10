import { afterEach, expect, it, vi } from 'vitest';
import { WllamaProvider } from '../../packages/agent-core/src/llm/wllama';

const state = vi.hoisted(() => ({
  load: vi.fn(async () => {}),
  loadFiles: vi.fn(async () => {}),
  count: vi.fn(async () => ({ promptTokens: 24, contextTokens: 2048 })),
  complete: vi.fn(async () => ({ choices: [{ message: { content: 'Hello' }, finish_reason: 'stop' }] })),
  compatibility: vi.fn(),
  exit: vi.fn(async () => {}),
  loader: vi.fn(),
}));
vi.mock('../../packages/agent-core/src/llm/wllama-cpu-runtime', () => ({
  loadWllamaCPURuntime: async () => {
    state.loader();
    return {
      Wllama: class {
        isModelLoaded() {
          return true;
        }
        loadModelFromUrl = state.load;
        loadModel = state.loadFiles;
        countChatTokens = state.count;
        createChatCompletion = state.complete;
        setCompat = state.compatibility;
        exit = state.exit;
      },
      wasmUrl: '/paired/default.wasm',
      compatibility: { wasm: '/paired/compat.wasm', worker: { code: 'paired worker' } },
    };
  },
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it.each(['javascript:alert(1)', 'data:application/octet-stream;base64,AA==', 'file:///tmp/model.gguf'])(
  'rejects unsupported model URL %s before initializing the CPU runtime',
  async (modelUrl) => {
    vi.stubGlobal('navigator', {
      storage: { getDirectory: async () => ({ getDirectoryHandle: async () => ({}) }) },
    });
    const provider = new WllamaProvider({ cpuOnly: true, modelUrl });
    await expect(provider.preload()).rejects.toThrow('Model artifacts require HTTP or HTTPS');
    expect(state.loader).not.toHaveBeenCalled();
    expect(state.load).not.toHaveBeenCalled();
    await provider.dispose();
  },
);

it('preserves initialization and cleanup failures and prevents another runtime after failed cleanup', async () => {
  vi.stubGlobal('navigator', {
    storage: { getDirectory: async () => ({ getDirectoryHandle: async () => ({}) }) },
  });
  const initialization = new Error('Download failed');
  const cleanup = new Error('Worker exit failed');
  state.load.mockRejectedValue(initialization);
  state.exit.mockRejectedValue(cleanup);
  const provider = new WllamaProvider({ cpuOnly: true, modelUrl: 'https://models.example/model.gguf' });
  try {
    await expect(provider.preload()).rejects.toMatchObject({ errors: [initialization, cleanup] });
    await expect(provider.preload()).rejects.toBe(cleanup);
    expect(state.loader).toHaveBeenCalledOnce();
    await expect(provider.dispose()).rejects.toBe(cleanup);
    expect(state.exit).toHaveBeenCalledOnce();
  } finally {
    state.load.mockResolvedValue(undefined);
    state.exit.mockResolvedValue(undefined);
  }
});

it('loads the paired CPU runtime through normal preload and measures before generation', async () => {
  vi.stubGlobal('navigator', {
    hardwareConcurrency: 4,
    storage: { getDirectory: async () => ({ getDirectoryHandle: async () => ({}) }) },
  });
  vi.stubGlobal('location', { origin: 'https://editor.example' });
  const provider = new WllamaProvider({ cpuOnly: true, modelUrl: 'https://models.example/model.gguf' });
  await provider.preload();
  expect(state.loader).toHaveBeenCalledOnce();
  expect(state.compatibility).toHaveBeenCalledWith(
    { wasm: '/paired/compat.wasm', worker: { code: 'paired worker' } },
    'firefox_safari',
  );
  expect(state.load).toHaveBeenCalledWith(
    'https://models.example/model.gguf',
    expect.objectContaining({ n_ctx: 2048, n_gpu_layers: 0, signal: expect.any(AbortSignal) }),
  );
  expect((await provider.chat([{ role: 'user', content: 'Hello' }], [])).text).toBe('Hello');
  expect(state.count).toHaveBeenCalledTimes(2);
  expect(state.complete.mock.calls[0]).toEqual(state.count.mock.calls[1]);
  await provider.dispose();
  expect(state.exit).toHaveBeenCalledOnce();
});

it('resolves a self-hosted relative GGUF URL against the current page', async () => {
  vi.stubGlobal('navigator', {
    storage: { getDirectory: async () => ({ getDirectoryHandle: async () => ({}) }) },
  });
  vi.stubGlobal('location', { origin: 'https://editor.example', href: 'https://editor.example/editor' });
  const provider = new WllamaProvider({ cpuOnly: true, modelUrl: '/models/local.gguf' });
  await provider.preload();
  expect(state.load).toHaveBeenCalledWith('https://editor.example/models/local.gguf', expect.any(Object));
  await provider.dispose();
});

it('keeps selected local files authoritative over an unused invalid model URL', async () => {
  vi.stubGlobal('navigator', {
    storage: { getDirectory: async () => ({ getDirectoryHandle: async () => ({}) }) },
  });
  const files = [new File(['GGUF'], 'local.gguf')];
  const provider = new WllamaProvider({ cpuOnly: true, modelUrl: 'file:///unused.gguf', modelFiles: files });
  await provider.preload();
  expect(state.loadFiles).toHaveBeenCalledWith(files, expect.any(Object));
  expect(state.load).not.toHaveBeenCalled();
  await provider.dispose();
});

it('rejects a resolved SDK load when the native loaded-model preflight fails and releases its worker', async () => {
  vi.stubGlobal('navigator', {
    hardwareConcurrency: 4,
    storage: { getDirectory: async () => ({ getDirectoryHandle: async () => ({}) }) },
  });
  vi.stubGlobal('location', { origin: 'https://editor.example' });
  const initialization = new Error('count_chat requires a loaded text-only chat model');
  state.count.mockRejectedValueOnce(initialization);
  const provider = new WllamaProvider({ cpuOnly: true, modelUrl: 'https://models.example/model.gguf' });
  try {
    await expect(provider.preload()).rejects.toBe(initialization);
    expect(provider.isReady()).toBe(false);
    expect(state.complete).not.toHaveBeenCalled();
    expect(state.exit).toHaveBeenCalledOnce();
    await provider.dispose();
    expect(state.exit).toHaveBeenCalledOnce();
  } finally {
    state.count.mockReset().mockResolvedValue({ promptTokens: 24, contextTokens: 2048 });
    await provider.dispose();
  }
});
