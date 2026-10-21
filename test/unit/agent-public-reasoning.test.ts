import { describe, expect, it, vi } from 'vitest';
import { OpenAIProvider } from '../../packages/agent-core/src/llm/openai';
import { OllamaProvider } from '../../packages/agent-core/src/llm/ollama';
import { GeminiProvider } from '../../packages/agent-core/src/llm/gemini';
import { LoopbackProvider } from '../../packages/agent-core/src/llm/loopback';
import { AnthropicProvider, type AnthropicStream } from '../../packages/agent-core/src/llm/anthropic';
import { runAgent, type AgentEvent } from '../../packages/agent-core/src/runtime';
import type { LLMProvider, LLMResponse } from '../../packages/agent-core/src/llm/types';
import { AgentChatController } from '../../lib/agent-plugin/ui/controller';
import { generateReadAnswer } from '../../lib/agent-plugin/document-read-answer';

const answer = (text = 'answer'): LLMResponse => ({
  text,
  toolCalls: [],
  stopReason: 'stop',
  assistant: { role: 'assistant', content: text },
});
const sse = (value: unknown) => `data: ${JSON.stringify(value)}\n\n`;
const thought = 'Public summary: \u516c\u5f00\u6458\u8981 🧭';
const formats = [
  {
    name: 'OpenAI',
    create: (fetchImpl: typeof fetch) => new OpenAIProvider({ apiKey: 'test', fetchImpl }),
    type: 'text/event-stream',
    stream:
      sse({ choices: [{ delta: { reasoning_content: thought, reasoning: 'duplicate alias' } }] }) +
      sse({ choices: [{ delta: { content: 'answer' }, finish_reason: 'stop' }] }),
    json: { choices: [{ message: { content: 'answer', reasoning: thought }, finish_reason: 'stop' }] },
  },
  {
    name: 'Ollama',
    create: (fetchImpl: typeof fetch) => new OllamaProvider({ fetchImpl }),
    type: 'text/event-stream',
    stream:
      sse({ choices: [{ delta: { reasoning: thought } }] }) +
      sse({ choices: [{ delta: { content: 'answer' }, finish_reason: 'stop' }] }),
    json: { choices: [{ message: { content: 'answer', reasoning_content: thought }, finish_reason: 'stop' }] },
  },
  {
    name: 'Gemini',
    create: (fetchImpl: typeof fetch) => new GeminiProvider({ apiKey: 'test', fetchImpl }),
    type: 'text/event-stream',
    stream: sse({
      candidates: [
        {
          content: { parts: [{ thought: true, text: thought, thoughtSignature: 'secret' }, { text: 'answer' }] },
          finishReason: 'STOP',
        },
      ],
    }),
    json: {
      candidates: [
        { content: { parts: [{ thought: true, text: thought }, { text: 'answer' }] }, finishReason: 'STOP' },
      ],
    },
  },
  {
    name: 'Loopback',
    create: (fetchImpl: typeof fetch) => new LoopbackProvider({ model: 'local', fetchImpl }),
    type: 'application/x-ndjson',
    stream: JSON.stringify({ done: true, message: { thinking: thought, content: 'answer' } }) + '\n',
    json: { done: true, message: { thinking: thought, content: 'answer' } },
  },
];

describe.each(formats)('$name public reasoning', (format) => {
  it.each(['stream', 'json'] as const)(
    'separates %s returned reasoning from answer/history with no thinking request',
    async (mode) => {
      const bodies: unknown[] = [];
      const provider = format.create((async (url, init) => {
        if (String(url).endsWith('/tags')) return Response.json({ models: [{ name: 'local' }] });
        bodies.push(JSON.parse(init!.body as string));
        return mode === 'json'
          ? Response.json(format.json)
          : new Response(format.stream, { headers: { 'Content-Type': format.type } });
      }) as typeof fetch);
      if (provider instanceof LoopbackProvider) await provider.preload();
      const reasoning = vi.fn();
      const delta = vi.fn();
      const response = await provider.chatStream!([], [], delta, undefined, reasoning);
      expect(reasoning.mock.calls).toEqual([[thought]]);
      expect(delta.mock.calls).toEqual([['answer']]);
      expect(response.text).toBe('answer');
      expect(JSON.stringify(response)).not.toContain(thought);
      expect(JSON.stringify(bodies)).not.toMatch(/think|includeThoughts|reasoning_effort|thinkingConfig/);
      await provider.chatStream!([], [], () => {});
      expect(bodies[1]).toEqual(bodies[0]);
    },
  );
  it.each(['stream', 'json'] as const)(
    'stops answer emission when reasoning consumer cancels a %s response',
    async (mode) => {
      const provider = format.create((async (url) => {
        if (String(url).endsWith('/tags')) return Response.json({ models: [{ name: 'local' }] });
        return mode === 'json'
          ? Response.json(format.json)
          : new Response(format.stream, { headers: { 'Content-Type': format.type } });
      }) as typeof fetch);
      if (provider instanceof LoopbackProvider) await provider.preload();
      const abort = new AbortController();
      const delta = vi.fn();
      await expect(provider.chatStream!([], [], delta, abort.signal, () => abort.abort())).rejects.toMatchObject({
        name: 'AbortError',
      });
      expect(delta).not.toHaveBeenCalled();
    },
  );
  if (format.name !== 'Loopback')
    it('extracts reasoning on the existing complete JSON tool-bearing route', async () => {
      const provider = format.create((async () => Response.json(format.json)) as typeof fetch);
      const reasoning = vi.fn();
      const response = await provider.chatStream!(
        [],
        [{ name: 'read', description: 'read', inputSchema: {} }],
        () => {},
        undefined,
        reasoning,
      );
      expect(reasoning.mock.calls).toEqual([[thought]]);
      expect(JSON.stringify(response)).not.toContain(thought);
    });
});

it('forwards SDK thinking once, skips signature/redacted blocks, and detaches listeners', async () => {
  const listeners = new Map<string, (text: string) => void>();
  let finish!: (value: Awaited<ReturnType<AnthropicStream['finalMessage']>>) => void;
  const off = vi.fn();
  const stream = {
    on: (event: string, cb: (text: string) => void) => listeners.set(event, cb),
    off,
    finalMessage: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  } as AnthropicStream;
  const create = vi.fn();
  const provider = new AnthropicProvider({ client: { messages: { create, stream: () => stream } } });
  const reasoning = vi.fn();
  const pending = provider.chatStream([], [], () => {}, undefined, reasoning);
  listeners.get('thinking')?.(thought);
  finish({
    content: [
      { type: 'thinking', thinking: thought, signature: 'secret' },
      { type: 'redacted_thinking', data: 'secret' },
      { type: 'text', text: 'answer' },
    ],
    stop_reason: 'end_turn',
  });
  expect((await pending).text).toBe('answer');
  listeners.get('thinking')?.('late');
  expect(reasoning.mock.calls).toEqual([[thought]]);
  expect(off).toHaveBeenCalledWith('thinking', expect.any(Function));
});

it('extracts Anthropic complete response thinking when SDK streaming is unavailable', async () => {
  const create = vi.fn(async (_body: Record<string, unknown>) => ({
    content: [
      { type: 'thinking', thinking: thought, signature: 'secret' },
      { type: 'text', text: 'answer' },
    ],
    stop_reason: 'end_turn',
  }));
  const reasoning = vi.fn();
  const provider = new AnthropicProvider({ client: { messages: { create } } });
  const response = await provider.chatStream([], [], () => {}, undefined, reasoning);
  expect(reasoning.mock.calls).toEqual([[thought]]);
  expect(JSON.stringify(response)).not.toContain(thought);
  expect(create.mock.calls[0][0]).not.toHaveProperty('thinking');
});

it('ends reasoning before answers/tools, once per inference, and ignores settled inference callbacks', async () => {
  const events: AgentEvent[] = [];
  let priorReasoning!: (text: string) => void;
  let priorAnswer!: (text: string) => void;
  let calls = 0;
  const provider: LLMProvider = {
    name: 'test',
    isReady: () => true,
    chat: async () => answer(),
    chatStream: async (_messages, _tools, delta, _signal, reasoning) => {
      calls++;
      if (calls === 1) {
        priorReasoning = reasoning!;
        priorAnswer = delta;
        reasoning!(thought);
        return {
          ...answer(''),
          toolCalls: [{ id: '1', name: 'read', input: {} }],
          assistant: { role: 'assistant', content: [{ type: 'tool_use', id: '1', name: 'read', input: {} }] },
        };
      }
      priorReasoning('stale');
      priorAnswer('stale');
      reasoning!('second');
      delta('answer');
      reasoning!('after answer');
      return answer();
    },
  };
  const result = await runAgent(provider, 'question', {
    tools: {
      read: { name: 'read', description: '', inputSchema: {}, readOnlyHint: true, execute: async () => 'source' },
    },
    onEvent: (e) => events.push(e),
  });
  expect(events.filter((e) => e.type.startsWith('reasoning'))).toEqual([
    { type: 'reasoning_delta', text: thought },
    { type: 'reasoning_end' },
    { type: 'reasoning_delta', text: 'second' },
    { type: 'reasoning_end' },
  ]);
  expect(events.findIndex((e) => e.type === 'reasoning_end')).toBeLessThan(
    events.findIndex((e) => e.type === 'tool_call'),
  );
  expect(events.findLastIndex((e) => e.type === 'reasoning_end')).toBeLessThan(
    events.findIndex((e) => e.type === 'assistant_delta'),
  );
  expect(JSON.stringify(result)).not.toContain(thought);
  expect(JSON.stringify(result)).not.toMatch(/second|stale/);
  expect(JSON.stringify(events)).not.toMatch(/stale|after answer/);
});

it.each(['stop', 'dispose', 'supersede'] as const)(
  'controller keeps reasoning ephemeral and rejects callbacks after %s',
  async (action) => {
    let emit!: (text: string) => void;
    let resolve!: (value: LLMResponse) => void;
    const reasoning = vi.fn();
    const end = vi.fn();
    const save = vi.fn();
    const turns = vi.fn();
    const provider: LLMProvider = {
      name: 'test',
      isReady: () => true,
      chat: async () => answer(),
      chatStream: async (_m, _t, _d, _s, cb) => {
        emit = cb!;
        return new Promise((r) => {
          resolve = r;
        });
      },
    };
    let valid = true;
    const controller = new AgentChatController(provider, turns, {
      onReasoningDelta: reasoning,
      onReasoningEnd: end,
      assertCurrent: () => {
        if (!valid) throw new Error('superseded');
      },
      storage: { load: () => [], save, clear: () => {} },
    });
    const pending = controller.send('question');
    await vi.waitFor(() => expect(emit).toBeTypeOf('function'));
    emit(thought);
    if (action === 'supersede') valid = false;
    else controller[action]();
    try {
      emit('late');
    } catch {}
    resolve(answer());
    await pending;
    try {
      emit('settled');
    } catch {}
    expect(reasoning.mock.calls).toEqual([[thought]]);
    expect(JSON.stringify(save.mock.calls)).not.toContain(thought);
    expect(JSON.stringify(turns.mock.calls)).not.toContain(thought);
  },
);

it('controller forwards a successful reasoning end before answer delivery', async () => {
  const visible: string[] = [];
  const provider: LLMProvider = {
    name: 'test',
    isReady: () => true,
    chat: async () => answer(),
    chatStream: async (_m, _t, delta, _s, cb) => {
      cb!(thought);
      delta('answer');
      return answer();
    },
  };
  await new AgentChatController(provider, () => {}, {
    onReasoningDelta: (t) => visible.push(t),
    onReasoningEnd: () => visible.push('end'),
    onAgentDelta: (t) => visible.push(t),
  }).send('question');
  expect(visible).toEqual([thought, 'end', 'answer']);
});

it('document answer forwards reasoning separately and ignores callbacks after settlement', async () => {
  let emit!: (text: string) => void;
  const provider: LLMProvider = {
    name: 'test',
    isReady: () => true,
    chat: async () => answer(),
    chatStream: async (_m, _t, delta, _s, cb) => {
      emit = cb!;
      cb!(thought);
      delta('answer');
      return answer();
    },
  };
  const reasoning = vi.fn();
  const delta = vi.fn();
  const result = await generateReadAnswer(
    provider,
    'question',
    {} as never,
    [],
    new AbortController().signal,
    delta,
    undefined,
    { onReasoningDelta: reasoning },
  );
  emit('late');
  expect(result).toBe('answer');
  expect(reasoning.mock.calls).toEqual([[thought]]);
  expect(delta.mock.calls).toEqual([['answer']]);
});

it('ends a reasoning-only failed inference before rejecting and ignores later callbacks', async () => {
  const events: AgentEvent[] = [];
  let emit!: (text: string) => void;
  const provider: LLMProvider = {
    name: 'test',
    isReady: () => true,
    chat: async () => answer(),
    chatStream: async (_m, _t, _d, _s, cb) => {
      emit = cb!;
      cb!(thought);
      throw new Error('failed');
    },
  };
  await expect(runAgent(provider, 'question', { onEvent: (e) => events.push(e) })).rejects.toThrow('failed');
  emit('late');
  expect(events).toEqual([{ type: 'reasoning_delta', text: thought }, { type: 'reasoning_end' }]);
});

it('does not invent reasoning or an end event for answer-only providers', async () => {
  const events: AgentEvent[] = [];
  await runAgent({ name: 'test', isReady: () => true, chat: async () => answer() }, 'question', {
    onEvent: (e) => events.push(e),
  });
  expect(events.some((e) => e.type.startsWith('reasoning'))).toBe(false);
});

it.each(['fallback', 'tools'] as const)(
  'stops Gemini reasoning callbacks between thought parts on the JSON %s route',
  async (route) => {
    const provider = new GeminiProvider({
      apiKey: 'test',
      fetchImpl: async () =>
        Response.json({
          candidates: [
            {
              content: {
                parts: [{ thought: true, text: thought }, { thought: true, text: 'late thought' }, { text: 'answer' }],
              },
              finishReason: 'STOP',
            },
          ],
        }),
    });
    const abort = new AbortController();
    const reasoning = vi.fn(() => abort.abort());
    const delta = vi.fn();
    await expect(
      provider.chatStream(
        [],
        route === 'tools' ? [{ name: 'read', description: 'read', inputSchema: {} }] : [],
        delta,
        abort.signal,
        reasoning,
      ),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(reasoning.mock.calls).toEqual([[thought]]);
    expect(delta).not.toHaveBeenCalled();
  },
);
