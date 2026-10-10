import { expect, it, vi } from 'vitest';
import { WllamaProvider, type WllamaEngine } from '../../packages/agent-core/src/llm/wllama';

it('requires explicit loading and releases the engine on disposal', async () => {
  const engine = {
    isModelLoaded: vi.fn(() => true),
    createChatCompletion: vi.fn(async (_body: Record<string, unknown>) => ({
      choices: [{ message: { content: '你好' }, finish_reason: 'stop' }],
    })),
    exit: vi.fn(async () => {}),
  };
  const factory = vi.fn(async () => engine);
  const provider = new WllamaProvider({ modelUrl: 'https://example.com/model.gguf', engineFactory: factory });
  expect(provider.isReady()).toBe(false);
  await expect(provider.chat([{ role: 'user', content: '你好' }], [])).rejects.toThrow(/load/i);
  expect(factory).not.toHaveBeenCalled();
  await provider.preload();
  expect(provider.isReady()).toBe(true);
  expect((await provider.chat([{ role: 'user', content: '你好' }], [])).text).toBe('你好');
  expect(engine.createChatCompletion.mock.calls[0]?.[0]).not.toHaveProperty('tools');
  await provider.dispose();
  expect(engine.exit).toHaveBeenCalledOnce();
  expect(provider.isReady()).toBe(false);
});

it('streams multilingual text and forwards cancellation without enabling tools', async () => {
  let body: Record<string, unknown> = {};
  const engine = {
    isModelLoaded: () => true,
    createChatCompletion: async (request: Record<string, unknown>) => {
      body = request;
      return (async function* () {
        yield { choices: [{ delta: { content: '你好 ' } }] };
        yield { choices: [{ delta: { content: 'Hallo' }, finish_reason: 'stop' }] };
      })();
    },
    exit: async () => {},
  };
  const provider = new WllamaProvider({ modelUrl: 'test', engineFactory: async () => engine });
  await provider.preload();
  const abort = new AbortController();
  const delta = vi.fn();
  const result = await provider.chatStream(
    [{ role: 'user', content: '翻译' }],
    [{ name: 'edit', description: 'edit', inputSchema: {} }],
    delta,
    abort.signal,
  );
  expect(result.text).toBe('你好 Hallo');
  expect(result.usage).not.toHaveProperty('endToEndTokensPerSecond');
  expect(result.usage).toHaveProperty('timeToFirstTextMs');
  expect(delta.mock.calls.map(([text]) => text)).toEqual(['你好 ', 'Hallo']);
  expect(body).not.toHaveProperty('tools');
  expect(body.abortSignal).toBeInstanceOf(AbortSignal);
  expect(body.stream_options).toEqual({ include_usage: true });
  abort.abort();
  await expect(provider.chat([], [], abort.signal)).rejects.toMatchObject({ name: 'AbortError' });
  await provider.dispose();
});

it('retries failed initialization and cleans up an engine that resolves after disposal', async () => {
  const engine = { isModelLoaded: () => true, createChatCompletion: vi.fn(), exit: vi.fn(async () => {}) };
  const factory = vi.fn().mockRejectedValueOnce(new Error('download failed')).mockResolvedValueOnce(engine);
  const provider = new WllamaProvider({ modelUrl: 'test', engineFactory: factory });
  await expect(provider.preload()).rejects.toThrow('download failed');
  await provider.preload();
  expect(provider.isReady()).toBe(true);
  await provider.dispose();
  let resolve!: (value: typeof engine) => void;
  const late = new WllamaProvider({
    modelUrl: 'test',
    engineFactory: () =>
      new Promise((r) => {
        resolve = r;
      }),
  });
  const loading = late.preload();
  const rejected = expect(loading).rejects.toMatchObject({ name: 'AbortError' });
  await late.dispose();
  resolve(engine);
  await rejected;
  expect(engine.exit).toHaveBeenCalledTimes(2);
  expect(late.isReady()).toBe(false);
});

it('stops an active stream and allows the next request', async () => {
  const abort = new AbortController();
  let calls = 0;
  const engine = {
    isModelLoaded: () => true,
    createChatCompletion: async () =>
      (async function* () {
        calls++;
        yield { choices: [{ delta: { content: 'first' } }] };
        yield { choices: [{ delta: { content: 'second' }, finish_reason: 'stop' }] };
      })(),
    exit: async () => {},
  };
  const provider = new WllamaProvider({ engineFactory: async () => engine });
  await provider.preload();
  await expect(provider.chatStream([], [], () => abort.abort(), abort.signal)).rejects.toMatchObject({
    name: 'AbortError',
  });
  const delta = vi.fn();
  await provider.preload();
  expect((await provider.chatStream([], [], delta)).text).toBe('firstsecond');
  expect(calls).toBe(2);
  await provider.dispose();
});

it('accepts the shared writing system prompt for reproducible evaluation', async () => {
  const completion = vi.fn(async (_body: Record<string, unknown>) => ({ choices: [{ message: { content: 'ok' } }] }));
  const provider = new WllamaProvider({
    systemPrompt: 'Preserve all dates.',
    engineFactory: async () => ({ isModelLoaded: () => true, createChatCompletion: completion, exit: async () => {} }),
  });
  await provider.preload();
  await provider.chat([{ role: 'user', content: 'rewrite' }], []);
  expect(completion.mock.calls[0][0].messages).toEqual([
    { role: 'system', content: 'Preserve all dates.' },
    { role: 'user', content: 'rewrite' },
  ]);
  await provider.dispose();
});

it('measures first visible text and overall response rate using actual backend token usage', async () => {
  let time = 100;
  const clock = vi.spyOn(performance, 'now').mockImplementation(() => time);
  try {
    const provider = new WllamaProvider({
      engineFactory: async () => ({
        isModelLoaded: () => true,
        exit: async () => {},
        createChatCompletion: async () =>
          (async function* () {
            time = 200;
            yield { choices: [{ delta: { content: '' } }] };
            time = 350;
            yield { choices: [{ delta: { content: 'hello' } }] };
            time = 600;
            yield { choices: [], usage: { completion_tokens: 8, prompt_tokens: 20 } };
          })(),
      }),
    });
    await provider.preload();
    const result = await provider.chatStream([], [], () => {});
    expect(result.usage).toMatchObject({
      completionTokens: 8,
      timeToFirstTextMs: 250,
      responseDurationMs: 500,
      endToEndTokensPerSecond: 16,
    });
    expect(result.usage).not.toHaveProperty('decodeTokensPerSecond');
    await provider.dispose();
  } finally {
    clock.mockRestore();
  }
});

it('terminates an unresponsive prefill on abort and requires a fresh explicitly loaded engine', async () => {
  const stalled = {
    isModelLoaded: () => true,
    createChatCompletion: vi.fn(() => new Promise<never>(() => {})),
    exit: vi.fn(async () => {}),
  };
  const fresh = {
    isModelLoaded: () => true,
    createChatCompletion: vi.fn(async () => ({ choices: [{ message: { content: 'recovered' } }] })),
    exit: vi.fn(async () => {}),
  };
  const factory = vi.fn().mockResolvedValueOnce(stalled).mockResolvedValueOnce(fresh);
  const provider = new WllamaProvider({ engineFactory: factory });
  await provider.preload();
  const abort = new AbortController();
  const request = provider.chat([], [], abort.signal);
  const rejected = expect(request).rejects.toMatchObject({ name: 'AbortError' });
  await vi.waitFor(() => expect(stalled.createChatCompletion).toHaveBeenCalledOnce());
  abort.abort();
  await rejected;
  expect(stalled.exit).toHaveBeenCalledOnce();
  expect(provider.isReady()).toBe(false);
  await provider.preload();
  expect((await provider.chat([], [])).text).toBe('recovered');
  await provider.dispose();
  expect(stalled.exit).toHaveBeenCalledOnce();
  expect(fresh.exit).toHaveBeenCalledOnce();
}, 1000);

it('settles stalled inference on disposal and releases the worker only once', async () => {
  const engine = {
    isModelLoaded: () => true,
    createChatCompletion: vi.fn(() => new Promise<never>(() => {})),
    exit: vi.fn(async () => {}),
  };
  const provider = new WllamaProvider({ engineFactory: async () => engine });
  await provider.preload();
  const request = provider.chat([], []);
  const rejected = expect(request).rejects.toMatchObject({ name: 'AbortError' });
  await vi.waitFor(() => expect(engine.createChatCompletion).toHaveBeenCalledOnce());
  await provider.dispose();
  await rejected;
  expect(engine.exit).toHaveBeenCalledOnce();
  expect(provider.isReady()).toBe(false);
});

it('constrains JSON tasks without applying their schema to subsequent chat', async () => {
  const createChatCompletion = vi.fn(async (_body: Record<string, unknown>) => ({
    choices: [{ message: { content: '{"text":"hello"}' }, finish_reason: 'stop' }],
  }));
  const provider = new WllamaProvider({
    modelUrl: 'test',
    generation: { temperature: 1.1, topP: 0.6, maxTokens: 128 },
    engineFactory: async () => ({
      isModelLoaded: () => true,
      createChatCompletion,
      exit: async () => {},
    }),
  });
  await provider.preload();
  const schema = {
    type: 'object',
    properties: { text: { type: 'string' } },
    required: ['text'],
    additionalProperties: false,
  };
  await provider.generateJSON([{ role: 'user', content: 'Say hello' }], schema);
  expect(createChatCompletion.mock.calls[0][0]).toMatchObject({
    stream: false,
    temperature: 0,
    top_p: 0.6,
    max_tokens: 128,
    response_format: { type: 'json_schema', json_schema: { name: 'local_task', schema, strict: true } },
  });
  await provider.chat([{ role: 'user', content: 'Chat' }], []);
  expect(createChatCompletion.mock.calls[1][0]).not.toHaveProperty('response_format');
  expect(createChatCompletion.mock.calls[1][0]).toMatchObject({ temperature: 1.1, top_p: 0.6, max_tokens: 128 });
  await provider.dispose();
});

it.each(['RuntimeError', 'WllamaRuntimeError'])(
  'retires a %s engine with safe reload guidance and no replay',
  async (name) => {
    const failure = new WebAssembly.RuntimeError('Length out of range of buffer');
    failure.name = name;
    const broken = {
      isModelLoaded: () => true,
      createChatCompletion: vi.fn().mockRejectedValue(failure),
      exit: vi.fn().mockResolvedValue(undefined),
    };
    const fresh = {
      isModelLoaded: () => true,
      createChatCompletion: vi
        .fn()
        .mockResolvedValue({ choices: [{ message: { content: 'hello' }, finish_reason: 'stop' }] }),
      exit: vi.fn().mockResolvedValue(undefined),
    };
    const factory = vi.fn().mockResolvedValueOnce(broken).mockResolvedValueOnce(fresh);
    const provider = new WllamaProvider({ modelUrl: 'test', engineFactory: factory });
    await provider.preload();
    await expect(provider.chat([{ role: 'user', content: 'Failed request' }], [])).rejects.toMatchObject({
      message: 'Local model worker failed. Reload the model to retry.',
      cause: failure,
    });
    expect(provider.isReady()).toBe(false);
    await expect(provider.chat([{ role: 'user', content: 'Before reload' }], [])).rejects.toThrow(/load/i);
    await provider.preload();
    expect(broken.exit).toHaveBeenCalledOnce();
    expect(broken.createChatCompletion).toHaveBeenCalledOnce();
    expect(fresh.createChatCompletion).not.toHaveBeenCalled();
    expect((await provider.chat([{ role: 'user', content: 'New request' }], [])).text).toBe('hello');
    await provider.dispose();
    expect(broken.exit).toHaveBeenCalledOnce();
  },
);

it('retires a stream that fails after a delta and rejects queued requests without replay', async () => {
  const failure = new WebAssembly.RuntimeError('Private native runtime detail');
  let failStream!: () => void;
  const blocked = new Promise<void>((resolve) => {
    failStream = resolve;
  });
  let sawDelta!: () => void;
  const streamed = new Promise<void>((resolve) => {
    sawDelta = resolve;
  });
  const broken = {
    isModelLoaded: () => true,
    createChatCompletion: vi.fn(async () =>
      (async function* () {
        yield { choices: [{ delta: { content: 'Partial' } }] };
        await blocked;
        throw failure;
      })(),
    ),
    exit: vi.fn(async () => {}),
  };
  const fresh = {
    isModelLoaded: () => true,
    createChatCompletion: vi.fn(async () => ({ choices: [{ message: { content: 'Recovered' } }] })),
    exit: vi.fn(async () => {}),
  };
  const factory = vi.fn().mockResolvedValueOnce(broken).mockResolvedValueOnce(fresh);
  const provider = new WllamaProvider({ engineFactory: factory });
  await provider.preload();
  const deltas: string[] = [];
  const running = provider.chatStream([], [], (text) => {
    deltas.push(text);
    sawDelta();
  });
  await streamed;
  const queued = provider.chat([{ role: 'user', content: 'Queued request' }], []);
  // Attach rejection observers before releasing the failing stream.
  const results = Promise.allSettled([running, queued]);
  failStream();
  expect(await results).toMatchObject([
    {
      status: 'rejected',
      reason: { message: 'Local model worker failed. Reload the model to retry.', cause: failure },
    },
    { status: 'rejected', reason: { message: 'Load the local model before sending' } },
  ]);
  expect(deltas).toEqual(['Partial']);
  expect(provider.isReady()).toBe(false);
  expect(broken.createChatCompletion).toHaveBeenCalledOnce();
  expect(factory).toHaveBeenCalledOnce();
  await provider.preload();
  expect(broken.exit).toHaveBeenCalledOnce();
  expect(fresh.createChatCompletion).not.toHaveBeenCalled();
  expect((await provider.chat([], [])).text).toBe('Recovered');
  await provider.dispose();
  expect(broken.exit).toHaveBeenCalledOnce();
});

it('keeps the loaded engine for ordinary request errors', async () => {
  const exit = vi.fn().mockResolvedValue(undefined);
  const provider = new WllamaProvider({
    modelUrl: 'test',
    engineFactory: async () => ({
      isModelLoaded: () => true,
      createChatCompletion: async () => {
        throw new Error('Invalid request parameter');
      },
      exit,
    }),
  });
  await provider.preload();
  await expect(provider.chat([], [])).rejects.toThrow('Invalid request parameter');
  expect(provider.isReady()).toBe(true);
  expect(exit).not.toHaveBeenCalled();
  await provider.dispose();
});

it.each(['json', 'stream'] as const)('turns native context overflow into actionable guidance for %s', async (mode) => {
  const nativeError = Object.assign(
    new Error('request (3419 tokens) exceeds the available context size (2048 tokens), try increasing it'),
    { type: 'inference_error' },
  );
  const completion = vi.fn<WllamaEngine['createChatCompletion']>(async () => {
    if (mode === 'stream')
      return (async function* () {
        yield* [];
        throw nativeError;
      })();
    throw nativeError;
  });
  const engine = { isModelLoaded: () => true, createChatCompletion: completion, exit: vi.fn(async () => {}) };
  const provider = new WllamaProvider({ engineFactory: async () => engine });
  await provider.preload();
  const delta = vi.fn();
  const request = [{ role: 'user' as const, content: 'Long request' }];
  await expect(
    mode === 'json' ? provider.generateJSON(request, { type: 'object' }) : provider.chatStream(request, [], delta),
  ).rejects.toThrow('agentContextTooLong');
  expect(delta).not.toHaveBeenCalled();
  expect(provider.isReady()).toBe(true);
  expect(engine.exit).not.toHaveBeenCalled();
  completion.mockImplementationOnce(async () => ({
    choices: [{ message: { content: 'hello' }, finish_reason: 'stop' }],
  }));
  expect((await provider.chat([{ role: 'user', content: 'Short request' }], [])).text).toBe('hello');
  await provider.dispose();
});

it.each([
  new Error('request (3419 tokens) exceeds the available context size (2048 tokens), try increasing it'),
  Object.assign(new Error('Unknown inference error'), { type: 'inference_error' }),
  Object.assign(
    new Error('request (3419 tokens) exceeds the available context size (2048 tokens), try increasing it'),
    { type: 'inference_error', name: 'AbortError' },
  ),
])('preserves unrelated errors and cancellation instead of reclassifying them', async (failure) => {
  const provider = new WllamaProvider({
    engineFactory: async () => ({
      isModelLoaded: () => true,
      createChatCompletion: async () => {
        throw failure;
      },
      exit: async () => {},
    }),
  });
  await provider.preload();
  await expect(provider.chat([{ role: 'user', content: 'Request' }], [])).rejects.toBe(failure);
  await provider.dispose();
});

it('counts final schema requests and reserves output before generation', async () => {
  const countChatTokens = vi.fn(async (body: Record<string, unknown>) => ({
    promptTokens: (body.messages as unknown[]).length > 2 ? 90 : 60,
    contextTokens: 100,
  }));
  const createChatCompletion = vi.fn(async (_body: Record<string, unknown>) => ({
    choices: [{ message: { content: '{}' }, finish_reason: 'stop' }],
  }));
  const provider = new WllamaProvider({
    systemPrompt: 'Custom system',
    generation: { maxTokens: 32 },
    engineFactory: async () => ({
      isModelLoaded: () => true,
      countChatTokens,
      createChatCompletion,
      exit: async () => {},
    }),
  });
  await provider.preload();
  const messages = [
    { role: 'user' as const, content: 'old' },
    { role: 'assistant' as const, content: 'answer' },
    { role: 'user' as const, content: 'current' },
  ];
  const result = await provider.generateJSON(messages, { type: 'object' });
  expect(countChatTokens).toHaveBeenCalledTimes(2);
  expect(createChatCompletion.mock.calls[0][0]).toEqual(countChatTokens.mock.calls[1][0]);
  expect(createChatCompletion.mock.calls[0][0]).toMatchObject({
    messages: [
      { role: 'system', content: 'Custom system' },
      { role: 'user', content: 'current' },
    ],
    max_tokens: 32,
    response_format: { type: 'json_schema' },
  });
  expect(result).toHaveProperty('contextTrimmed', true);
  expect(messages).toHaveLength(3);
  await provider.dispose();
});

it('does not generate when the final current request exceeds the reserved capacity', async () => {
  const createChatCompletion = vi.fn();
  const provider = new WllamaProvider({
    engineFactory: async () => ({
      isModelLoaded: () => true,
      countChatTokens: async () => ({ promptTokens: 1800, contextTokens: 2048 }),
      createChatCompletion,
      exit: async () => {},
    }),
  });
  await provider.preload();
  await expect(provider.chat([{ role: 'user', content: 'current' }], [])).rejects.toThrow('agentContextTooLong');
  expect(createChatCompletion).not.toHaveBeenCalled();
  await provider.dispose();
});

it('retires the engine when counting is cancelled before generation', async () => {
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const engine = {
    isModelLoaded: () => true,
    countChatTokens: vi.fn(() => {
      entered();
      return new Promise<{ promptTokens: number; contextTokens: number }>(() => {});
    }),
    createChatCompletion: vi.fn(),
    exit: vi.fn(async () => {}),
  };
  const provider = new WllamaProvider({ engineFactory: async () => engine });
  await provider.preload();
  const abort = new AbortController();
  const result = provider.chat([{ role: 'user', content: 'current' }], [], abort.signal);
  const rejected = expect(result).rejects.toMatchObject({ name: 'AbortError' });
  await started;
  abort.abort();
  await rejected;
  expect(engine.createChatCompletion).not.toHaveBeenCalled();
  expect(engine.exit).toHaveBeenCalledOnce();
  expect(provider.isReady()).toBe(false);
  await provider.dispose();
});

it('advertises exact budgeting only while a count-capable engine is ready', async () => {
  const provider = new WllamaProvider({
    engineFactory: async () => ({
      isModelLoaded: () => true,
      countChatTokens: async () => ({ promptTokens: 1, contextTokens: 2048 }),
      createChatCompletion: vi.fn(),
      exit: async () => {},
    }),
  });
  expect(provider.hasExactContextBudget()).toBe(false);
  await provider.preload();
  expect(provider.hasExactContextBudget()).toBe(true);
  await provider.dispose();
  expect(provider.hasExactContextBudget()).toBe(false);
});
