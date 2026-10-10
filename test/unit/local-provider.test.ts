import { expect, it, vi } from 'vitest';
import { detectGPUAdapter, LocalInferenceProvider } from '../../packages/agent-core/src/llm/local';
import type { LLMResponse, LocalLLMProvider } from '../../packages/agent-core/src/llm/types';

function engine(name: string, load: () => Promise<void> = async () => {}) {
  let ready = false;
  const reply = {
    text: '你好',
    toolCalls: [],
    stopReason: 'stop',
    assistant: { role: 'assistant', content: '你好' },
  } as const;
  return {
    name,
    isReady: () => ready,
    preload: vi.fn(async () => {
      await load();
      ready = true;
    }),
    dispose: vi.fn(async () => {
      ready = false;
    }),
    chat: vi.fn(async (): Promise<LLMResponse> => ({ ...reply, toolCalls: [] })),
    chatStream: vi.fn(async (_messages, _tools, delta) => {
      delta('你好');
      return { ...reply, toolCalls: [] };
    }),
  } satisfies LocalLLMProvider;
}

it('uses CPU when no GPU adapter exists, without loading GPU or implicitly downloading on chat', async () => {
  const gpu = engine('webllm');
  const cpu = engine('wllama');
  const provider = new LocalInferenceProvider({ detectGPU: async () => false, gpu: () => gpu, cpu: () => cpu });
  await expect(provider.chat([], [])).rejects.toThrow(/load/i);
  expect(cpu.preload).not.toHaveBeenCalled();
  await provider.preload();
  expect(provider.backend).toBe('wllama');
  expect((await provider.chat([{ role: 'user', content: '你好' }], [])).text).toBe('你好');
  expect(gpu.preload).not.toHaveBeenCalled();
});

it('uses CPU if GPU adapter detection rejects', async () => {
  const cpu = engine('wllama');
  const provider = new LocalInferenceProvider({
    detectGPU: async () => {
      throw new Error('adapter denied');
    },
    cpu: () => cpu,
  });
  await provider.preload();
  expect(provider.isReady()).toBe(true);
  expect(provider.backend).toBe('wllama');
});

it.each([true, false])(
  'does not initialize either backend after cancellation during adapter detection (%s)',
  async (available) => {
    let finish!: (value: boolean) => void;
    const gpu = vi.fn(() => engine('webllm'));
    const cpu = vi.fn(() => engine('wllama'));
    const provider = new LocalInferenceProvider({
      detectGPU: () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
      gpu,
      cpu,
    });
    const pending = provider.preload();
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await provider.dispose();
    finish(available);
    await rejected;
    expect(gpu).not.toHaveBeenCalled();
    expect(cpu).not.toHaveBeenCalled();
    expect(provider.backend).toBeUndefined();
    expect(provider.isReady()).toBe(false);
    await expect(provider.preload()).rejects.toMatchObject({ name: 'AbortError' });
  },
);

it('releases a failed GPU before loading CPU and shares concurrent initialization', async () => {
  const order: string[] = [];
  const gpu = engine('webllm', async () => {
    order.push('gpu');
    throw new Error('GPU lost');
  });
  gpu.dispose.mockImplementation(async () => {
    order.push('release');
  });
  const cpu = engine('wllama', async () => {
    order.push('cpu');
  });
  const provider = new LocalInferenceProvider({ detectGPU: async () => true, gpu: () => gpu, cpu: () => cpu });
  await Promise.all([provider.preload(), provider.preload()]);
  expect(order).toEqual(['gpu', 'release', 'cpu']);
  expect(provider.backend).toBe('wllama');
});

it('does not fall back after disposal while GPU loading is pending', async () => {
  let reject!: (error: Error) => void;
  const gpu = engine(
    'webllm',
    () =>
      new Promise<void>((_resolve, fail) => {
        reject = fail;
      }),
  );
  const cpu = engine('wllama');
  const provider = new LocalInferenceProvider({ detectGPU: async () => true, gpu: () => gpu, cpu: () => cpu });
  const loading = provider.preload();
  const rejected = expect(loading).rejects.toMatchObject({ name: 'AbortError' });
  await vi.waitFor(() => expect(gpu.preload).toHaveBeenCalled());
  await provider.dispose();
  reject(new Error('load cancelled'));
  await rejected;
  expect(cpu.preload).not.toHaveBeenCalled();
  expect(provider.isReady()).toBe(false);
});

it('never falls back on an initialization AbortError', async () => {
  const gpu = engine('webllm', async () => {
    throw new DOMException('Stopped', 'AbortError');
  });
  const cpu = engine('wllama');
  const provider = new LocalInferenceProvider({ detectGPU: async () => true, gpu: () => gpu, cpu: () => cpu });
  await expect(provider.preload()).rejects.toMatchObject({ name: 'AbortError' });
  expect(cpu.preload).not.toHaveBeenCalled();
});

it('reports both failures and permits explicit retry with fresh candidates', async () => {
  const provider = new LocalInferenceProvider({
    detectGPU: async () => true,
    gpu: () =>
      engine('webllm', async () => {
        throw new Error('GPU failed');
      }),
    cpu: () =>
      engine('wllama', async () => {
        throw new Error('CPU failed');
      }),
  });
  await expect(provider.preload()).rejects.toMatchObject({
    errors: [expect.objectContaining({ message: 'GPU failed' }), expect.objectContaining({ message: 'CPU failed' })],
  });
  await expect(provider.preload()).rejects.toBeInstanceOf(AggregateError);
  expect(provider.isReady()).toBe(false);
});

it('does not replay failed streaming output through a fallback or expose tools', async () => {
  const gpu = engine('webllm');
  gpu.chatStream.mockImplementation(async (_messages, tools, delta) => {
    expect(tools).toEqual([]);
    delta('partial');
    throw new Error('worker lost');
  });
  const cpu = engine('wllama');
  const provider = new LocalInferenceProvider({ detectGPU: async () => true, gpu: () => gpu, cpu: () => cpu });
  await provider.preload();
  const delta = vi.fn();
  await expect(provider.chatStream([], [{ name: 'write', description: '', inputSchema: {} }], delta)).rejects.toThrow(
    'worker lost',
  );
  expect(delta.mock.calls).toEqual([['partial']]);
  expect(cpu.preload).not.toHaveBeenCalled();
});

it('requires an actual GPU adapter rather than the presence of navigator.gpu', async () => {
  const original = Object.getOwnPropertyDescriptor(navigator, 'gpu');
  try {
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: { requestAdapter: async () => null } });
    expect(await detectGPUAdapter()).toBe(false);
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: { requestAdapter: async () => ({}) } });
    expect(await detectGPUAdapter()).toBe(true);
    Object.defineProperty(navigator, 'gpu', {
      configurable: true,
      value: {
        requestAdapter: async () => {
          throw new Error('denied');
        },
      },
    });
    expect(await detectGPUAdapter()).toBe(false);
  } finally {
    if (original) Object.defineProperty(navigator, 'gpu', original);
    else Reflect.deleteProperty(navigator, 'gpu');
  }
});

it('can recover from total initialization failure on an explicit retry', async () => {
  let attempts = 0;
  const provider = new LocalInferenceProvider({
    detectGPU: async () => false,
    cpu: () =>
      engine('wllama', async () => {
        if (++attempts === 1) throw new Error('temporary storage error');
      }),
  });
  await expect(provider.preload()).rejects.toBeInstanceOf(AggregateError);
  await provider.preload();
  expect((await provider.chat([], [])).text).toBe('你好');
});

it('rejects unsolicited native tool calls from a local engine', async () => {
  const gpu = engine('webllm');
  gpu.chat.mockResolvedValue({
    text: '',
    toolCalls: [{ id: 'bad', name: 'insert_text', input: { text: 'unreviewed edit' } }],
    stopReason: 'tool_use',
    assistant: { role: 'assistant', content: '' },
  });
  const provider = new LocalInferenceProvider({ detectGPU: async () => true, gpu: () => gpu });
  await provider.preload();
  await expect(provider.chat([], [])).rejects.toThrow(/tool/i);
});

it('delegates measured-budget capability only to its ready active engine', async () => {
  const cpu = { ...engine('wllama'), hasExactContextBudget: () => true };
  const provider = new LocalInferenceProvider({ detectGPU: async () => false, cpu: () => cpu });
  expect(provider.hasExactContextBudget()).toBe(false);
  await provider.preload();
  expect(provider.hasExactContextBudget()).toBe(true);
  await provider.dispose();
  expect(provider.hasExactContextBudget()).toBe(false);
});
