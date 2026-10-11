import { describe, expect, it, vi } from 'vitest';
import {
  checkWebGPUSupport,
  DEFAULT_WEBLLM_MODEL,
  isWebGPUAvailable,
  WEBLLM_MODELS,
  WebLLMProvider,
} from '@ranuts/agent-core/llm/webllm';
import { createProvider, defaultProviderId } from '@ranuts/agent-core/llm/factory';
import { CHAT_ONLY_SYSTEM_PROMPT, DEFAULT_SYSTEM_PROMPT } from '@ranuts/agent-core/llm/prompt';

describe('WebLLMProvider', () => {
  it('reports WebGPU unavailable under jsdom', () => {
    expect(isWebGPUAvailable()).toBe(false);
  });

  it('exposes a curated model list with the default included', () => {
    expect(WEBLLM_MODELS.map((m) => m.id)).toEqual(['Qwen3-4B-q4f16_1-MLC']);
    expect(DEFAULT_WEBLLM_MODEL).toBe('Qwen3-4B-q4f16_1-MLC');
    expect(WEBLLM_MODELS.map((m) => m.id)).toContain(DEFAULT_WEBLLM_MODEL);
  });

  it('defaults to Qwen3 4B but accepts a custom override', () => {
    expect(new WebLLMProvider().model).toBe(DEFAULT_WEBLLM_MODEL);
    expect(new WebLLMProvider({ model: 'Llama-3.2-1B-Instruct-q4f16_1-MLC' }).model).toBe(
      'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    );
  });

  it('is ready when an engine is injected, not ready otherwise (no WebGPU)', () => {
    expect(new WebLLMProvider({ engine: { chat: { completions: { create: vi.fn() } } } }).isReady()).toBe(true);
    expect(new WebLLMProvider().isReady()).toBe(false);
  });

  it('chat() sends the OpenAI-shaped request and parses the result', async () => {
    const create = vi.fn().mockResolvedValue({ choices: [{ message: { content: 'done' }, finish_reason: 'stop' }] });
    const provider = new WebLLMProvider({
      model: 'Hermes-3-Llama-3.1-8B-q4f16_1-MLC',
      engine: { chat: { completions: { create } } },
    });
    const result = await provider.chat(
      [{ role: 'user', content: 'go' }],
      [{ name: 'insert_text', description: 'd', inputSchema: { type: 'object' } }],
    );
    const body = create.mock.calls[0][0];
    expect(body.tool_choice).toBe('auto');
    expect(body.extra_body).toBeUndefined();
    // Hermes function calling forbids a custom system prompt, so when tools are
    // passed there must be no system message; the guidance is folded into the
    // first user message instead.
    expect(body.messages.some((m: { role: string }) => m.role === 'system')).toBe(false);
    expect(body.messages[0].role).toBe('user');
    expect(body.messages[0].content).toContain('go');
    expect(result.text).toBe('done');
  });

  it('chatOnly drops tools: no tools/tool_choice sent, and a real system prompt is kept', async () => {
    const create = vi.fn().mockResolvedValue({ choices: [{ message: { content: 'hi' }, finish_reason: 'stop' }] });
    const provider = new WebLLMProvider({ engine: { chat: { completions: { create } } }, chatOnly: true });
    await provider.chat(
      [{ role: 'user', content: 'go' }],
      [{ name: 'insert_text', description: 'd', inputSchema: { type: 'object' } }],
    );
    const body = create.mock.calls[0][0];
    // Tools are stripped, so the request carries no tool fields...
    expect(body.tools).toBeUndefined();
    expect(body.extra_body).toEqual({ enable_thinking: false });
    expect(body.tool_choice).toBeUndefined();
    // The request keeps the advisor prompt rather than the tool-driving default.
    const system = body.messages.find((m: { role: string }) => m.role === 'system');
    expect(system?.content).toContain(CHAT_ONLY_SYSTEM_PROMPT);
    expect(system?.content).not.toBe(DEFAULT_SYSTEM_PROMPT);
  });

  it('an explicit systemPrompt overrides the chat-only advisor default', () => {
    expect(new WebLLMProvider({ chatOnly: true, systemPrompt: 'custom' })['systemPrompt']).toContain('custom');
  });
  it('adapts legacy tool history for text-only models without mutating saved history', async () => {
    const create = vi.fn().mockResolvedValue({ choices: [{ message: { content: 'hi' }, finish_reason: 'stop' }] });
    const provider = new WebLLMProvider({ engine: { chat: { completions: { create } } }, chatOnly: true });
    const history = [
      { role: 'user' as const, content: 'Read selection' },
      {
        role: 'assistant' as const,
        content: [{ type: 'tool_use' as const, id: 'x', name: 'get_selection', input: {} }],
      },
      {
        role: 'user' as const,
        content: [{ type: 'tool_result' as const, toolUseId: 'x', content: 'Budget 1250 EUR' }],
      },
      { role: 'user' as const, content: 'What is the budget?' },
    ];
    const before = JSON.stringify(history);
    await provider.chat(history, []);
    const messages = create.mock.calls[0][0].messages;
    expect(
      messages.every(
        (m: { role: string; content: unknown; tool_calls?: unknown }) =>
          ['system', 'user', 'assistant'].includes(m.role) && typeof m.content === 'string' && !m.tool_calls,
      ),
    ).toBe(true);
    expect(messages.some((m: { content: string }) => m.content.includes('Budget 1250 EUR'))).toBe(true);
    expect(JSON.stringify(history)).toBe(before);
  });

  it.each(WEBLLM_MODELS.map(({ id }) => id))('disables thinking for writing with %s', async (model) => {
    const create = vi.fn().mockResolvedValue({ choices: [{ message: { content: 'text' }, finish_reason: 'stop' }] });
    const provider = new WebLLMProvider({ model, engine: { chat: { completions: { create } } }, chatOnly: true });
    await provider.chat([{ role: 'user', content: 'Rewrite this text.' }], []);
    expect(create.mock.calls[0][0].extra_body).toEqual({ enable_thinking: false });
  });

  it('uses schema-constrained tool-free generation without the chat advisor prompt', async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: '{"status":"ready","content":"Hello"}' }, finish_reason: 'stop' }],
    });
    const provider = new WebLLMProvider({ engine: { chat: { completions: { create } } }, chatOnly: true });
    const schema = { type: 'object', required: ['status', 'content'] };
    await provider.generateJSON([{ role: 'user', content: 'bounded task' }], schema);
    const body = create.mock.calls[0][0];
    expect(body.response_format).toEqual({ type: 'json_object', schema: JSON.stringify(schema) });
    expect(body.temperature).toBe(0.7);
    expect(body.tools).toBeUndefined();
    expect(body.tool_choice).toBeUndefined();
    expect(body.messages[0].content).not.toContain(CHAT_ONLY_SYSTEM_PROMPT);
  });

  it('preload() resolves with an injected engine without loading the SDK', async () => {
    const provider = new WebLLMProvider({ engine: { chat: { completions: { create: vi.fn() } } } });
    await expect(provider.preload()).resolves.toBeUndefined();
  });

  it('chatStream() requests a stream, reports deltas, and resolves the full text', async () => {
    async function* chunks() {
      yield { choices: [{ delta: { content: 'on' } }] };
      yield { choices: [{ delta: { content: 'line' } }] };
      yield { choices: [{ delta: {}, finish_reason: 'stop' }] };
      yield { choices: [], usage: { completion_tokens: 5, prompt_tokens: 10 } };
    }
    const create = vi.fn().mockResolvedValue(chunks());
    const provider = new WebLLMProvider({ engine: { chat: { completions: { create } } } });
    const deltas: string[] = [];
    const result = await provider.chatStream([{ role: 'user', content: 'go' }], [], (d) => deltas.push(d));
    expect(create.mock.calls[0][0].stream).toBe(true);
    expect(create.mock.calls[0][0].stream_options).toEqual({ include_usage: true });
    expect(result.usage).toEqual({ completionTokens: 5, promptTokens: 10 });
    expect(deltas).toEqual(['on', 'line']);
    expect(result.text).toBe('online');
  });
});

describe('provider factory', () => {
  it('creates each provider by id', () => {
    expect(createProvider('anthropic', { apiKey: 'k' }).name).toBe('anthropic');
    expect(createProvider('openai', { apiKey: 'k' }).name).toBe('openai');
    expect(createProvider('webllm', { engine: { chat: { completions: { create: vi.fn() } } } }).name).toBe('webllm');
  });

  it('does not silently select a cloud provider when WebGPU is unavailable', () => {
    expect(defaultProviderId()).toBe('webllm');
  });
});

describe('local model lifecycle', () => {
  const completion = { choices: [{ message: { content: 'result' }, finish_reason: 'stop' }] };

  it('retries initialization after a failed load', async () => {
    let attempts = 0;
    const provider = new WebLLMProvider({
      engineFactory: async () => {
        if (++attempts === 1) throw new Error('download failed');
        return { chat: { completions: { create: async () => completion } } };
      },
    });
    await expect(provider.preload()).rejects.toThrow('download failed');
    await provider.preload();
    expect(provider.isReady()).toBe(true);
    expect((await provider.chat([{ role: 'user', content: 'hello' }], [])).text).toBe('result');
  });

  it('is not ready merely because navigator.gpu exists', () => {
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: {} });
    try {
      expect(new WebLLMProvider().isReady()).toBe(false);
    } finally {
      Reflect.deleteProperty(navigator, 'gpu');
    }
  });

  it('does not generate if cancelled during initialization', async () => {
    let resolveLoad!: (engine: { chat: { completions: { create: () => Promise<typeof completion> } } }) => void;
    let generated = false;
    const provider = new WebLLMProvider({
      engineFactory: () =>
        new Promise((resolve) => {
          resolveLoad = resolve;
        }),
    });
    const abort = new AbortController();
    const request = provider.chat([{ role: 'user', content: 'hello' }], [], abort.signal);
    const rejected = expect(request).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(resolveLoad).toBeTypeOf('function'));
    abort.abort();
    resolveLoad({
      chat: {
        completions: {
          create: async () => {
            generated = true;
            return completion;
          },
        },
      },
    });
    await rejected;
    expect(generated).toBe(false);
  });

  it('serializes requests to a shared inference engine', async () => {
    let finishFirst!: () => void;
    let calls = 0;
    const provider = new WebLLMProvider({
      engine: {
        chat: {
          completions: {
            create: async () => {
              if (++calls === 1)
                await new Promise<void>((resolve) => {
                  finishFirst = resolve;
                });
              return completion;
            },
          },
        },
      },
    });
    const first = provider.chat([{ role: 'user', content: 'first' }], []);
    const second = provider.chat([{ role: 'user', content: 'second' }], []);
    await vi.waitFor(() => expect(calls).toBeGreaterThan(0));
    expect(calls).toBe(1);
    finishFirst();
    await Promise.all([first, second]);
    expect(calls).toBe(2);
  });

  it('unloads resources and refuses calls after disposal', async () => {
    let unloaded = false;
    const provider = new WebLLMProvider({
      engine: {
        chat: { completions: { create: async () => completion } },
        unload: async () => {
          unloaded = true;
        },
      },
    });
    await provider.dispose();
    expect(unloaded).toBe(true);
    expect(provider.isReady()).toBe(false);
    await expect(provider.preload()).rejects.toThrow('disposed');
  });

  it('defaults Qwen requests to chat without forwarding editor tools', async () => {
    let body: Record<string, unknown> = {};
    const provider = new WebLLMProvider({
      engine: {
        chat: {
          completions: {
            create: async (request) => {
              body = request;
              return completion;
            },
          },
        },
      },
    });
    await provider.chat(
      [{ role: 'user', content: '你好' }],
      [{ name: 'insert_text', description: 'write', inputSchema: {} }],
    );
    expect(body.tools).toBeUndefined();
    expect((body.messages as Array<{ role: string }>)[0].role).toBe('system');
    expect((body.messages as Array<{ content: string }>)[0].content).toContain('/no_think');
    expect(body.extra_body).toEqual({ enable_thinking: false });
  });

  it('settles an outstanding generation when the provider is disposed', async () => {
    let started = false;
    const provider = new WebLLMProvider({
      engine: {
        chat: {
          completions: {
            create: async () => {
              started = true;
              return new Promise(() => undefined);
            },
          },
        },
      },
    });
    const request = provider.chat([{ role: 'user', content: 'hello' }], []);
    const rejected = expect(request).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(started).toBe(true));
    await provider.dispose();
    await rejected;
  });

  it('rejects null adapters and missing shader-f16 before model initialization', async () => {
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: { requestAdapter: async () => null } });
    try {
      await expect(checkWebGPUSupport('Qwen3-1.7B-q4f16_1-MLC')).rejects.toThrow('adapter');
      Object.defineProperty(navigator, 'gpu', {
        configurable: true,
        value: { requestAdapter: async () => ({ features: new Set() }) },
      });
      await expect(checkWebGPUSupport('Qwen3-1.7B-q4f16_1-MLC')).rejects.toThrow('shader-f16');
      await expect(checkWebGPUSupport('custom-q4f32')).resolves.toBeUndefined();
    } finally {
      Reflect.deleteProperty(navigator, 'gpu');
    }
  });
});

it('drains the interrupted worker stream so the next request can acquire its model lock', async () => {
  const abort = new AbortController();
  let released = false;
  const create = vi.fn().mockImplementation(async () => {
    if (create.mock.calls.length > 1) {
      if (!released) throw new Error('Worker model lock still held');
      return { choices: [{ message: { content: 'next reply' }, finish_reason: 'stop' }] };
    }
    return (async function* () {
      yield { choices: [{ delta: { content: 'visible' } }] };
      abort.abort();
      yield { choices: [{ delta: { content: 'must stay hidden' } }] };
      yield { choices: [{ delta: {}, finish_reason: 'stop' }] };
      // Mirrors the remote worker tail: returning the local iterator does not run it.
      released = true;
    })();
  });
  const delta = vi.fn();
  const interruptGenerate = vi.fn();
  const provider = new WebLLMProvider({ engine: { chat: { completions: { create } }, interruptGenerate } });
  await expect(
    provider.chatStream([{ role: 'user', content: 'long reply' }], [], delta, abort.signal),
  ).rejects.toThrow();
  expect(interruptGenerate).toHaveBeenCalledOnce();
  expect(delta.mock.calls).toEqual([['visible']]);
  expect((await provider.chat([{ role: 'user', content: 'next' }], [])).text).toBe('next reply');
});

const gpuContextMessage =
  'Prompt tokens exceed context window size: number of prompt tokens: 4522; context window size: 4096\nConsider shortening the prompt, or increase `context_window_size`, or using sliding window via `sliding_window_size`.';
it.each(['json', 'stream'] as const)(
  'classifies actual SDK and Worker context failures for %s and keeps the engine usable',
  async (mode) => {
    const { WebLLMProvider } = await import('../../packages/agent-core/src/llm/webllm');
    for (const failure of [
      Object.assign(new Error(gpuContextMessage), { name: 'ContextWindowSizeExceededError' }),
      'ContextWindowSizeExceededError: ' + gpuContextMessage,
    ]) {
      const create = vi.fn(async () => {
        if (mode === 'stream')
          return (async function* () {
            yield* [];
            throw failure;
          })();
        throw failure;
      });
      const provider = new WebLLMProvider({ engine: { chat: { completions: { create: create as never } } } });
      const request = [{ role: 'user' as const, content: 'Long request' }];
      const delta = vi.fn();
      await expect(
        mode === 'json' ? provider.generateJSON(request, { type: 'object' }) : provider.chatStream(request, [], delta),
      ).rejects.toThrow('agentContextTooLong');
      expect(delta).not.toHaveBeenCalled();
      create.mockImplementationOnce(
        async () => ({ choices: [{ message: { content: 'hello' }, finish_reason: 'stop' }] }) as never,
      );
      expect((await provider.chat([{ role: 'user', content: 'Short request' }], [])).text).toBe('hello');
      expect(provider.isReady()).toBe(true);
      await provider.dispose();
    }
  },
);

it('keeps untyped look-alike errors and cancellation reasons unchanged', async () => {
  const { WebLLMProvider } = await import('../../packages/agent-core/src/llm/webllm');
  const plainError = new Error(gpuContextMessage);
  const provider = new WebLLMProvider({
    engine: {
      chat: {
        completions: {
          create: async () => {
            throw plainError;
          },
        },
      },
    },
  });
  await expect(provider.chat([{ role: 'user', content: 'Request' }], [])).rejects.toBe(plainError);
  const abort = new AbortController();
  const reason = 'ContextWindowSizeExceededError: ' + gpuContextMessage;
  abort.abort(reason);
  await expect(provider.chat([{ role: 'user', content: 'Request' }], [], abort.signal)).rejects.toBe(reason);
  await provider.dispose();
});

it('notifies readiness loss even when no request is waiting', async () => {
  const failure = new AbortController();
  const unavailable = vi.fn();
  const provider = new WebLLMProvider({
    onUnavailable: unavailable,
    engineFactory: async () => ({ failureSignal: failure.signal, chat: { completions: { create: vi.fn() } } }),
  });
  await provider.preload();
  expect(provider.isReady()).toBe(true);
  failure.abort(new Error('GPU resources lost'));
  expect(provider.isReady()).toBe(false);
  expect(unavailable).toHaveBeenCalledOnce();
});

it('does not notify readiness loss from a disposed engine', async () => {
  const failure = new AbortController();
  const unavailable = vi.fn();
  const provider = new WebLLMProvider({
    onUnavailable: unavailable,
    engine: { failureSignal: failure.signal, chat: { completions: { create: vi.fn() } } },
  });
  await provider.dispose();
  failure.abort(new Error('late unload'));
  expect(unavailable).not.toHaveBeenCalled();
});

it('keeps readiness and does not notify for an ordinary request failure', async () => {
  const unavailable = vi.fn();
  const provider = new WebLLMProvider({
    onUnavailable: unavailable,
    engine: { chat: { completions: { create: vi.fn().mockRejectedValue(new Error('request failed')) } } },
  });
  await expect(provider.chat([], [])).rejects.toThrow('request failed');
  expect(provider.isReady()).toBe(true);
  expect(unavailable).not.toHaveBeenCalled();
});
