import { describe, expect, it, vi } from 'vitest';
import { type AgentEvent, runAgent, toLLMToolDefs } from '@ranuts/agent-core/runtime';
import type { AgentTool } from '@ranuts/agent-core/types';
import type { LLMMessage, LLMProvider, LLMResponse } from '@ranuts/agent-core/llm/types';

const textResponse = (text: string): LLMResponse => ({
  text,
  toolCalls: [],
  stopReason: 'end_turn',
  assistant: { role: 'assistant', content: [{ type: 'text', text }] },
});

it('bounds model requests while returning complete archival history', async () => {
  const history: LLMMessage[] = [
    { role: 'user', content: 'old'.repeat(1000) },
    { role: 'assistant', content: 'answer'.repeat(1000) },
  ];
  const chat = vi.fn().mockResolvedValue(textResponse('new answer'));
  const trimmed = vi.fn();
  const result = await runAgent({ name: 'test', isReady: () => true, chat }, 'new request', {
    history,
    maxContextBytes: 400,
    onContextTrimmed: trimmed,
  });
  expect(chat.mock.calls[0][0]).toEqual([{ role: 'user', content: 'new request' }]);
  expect(result.messages).toHaveLength(4);
  expect(result.messages.slice(0, 2)).toEqual(history);
  expect(trimmed).toHaveBeenCalledTimes(1);
});
it('never dispatches a tool returned after cancellation', async () => {
  const abort = new AbortController();
  let finish!: (response: LLMResponse) => void;
  const execute = vi.fn();
  const pending = runAgent(
    {
      name: 'test',
      isReady: () => true,
      chat: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    },
    'write',
    {
      signal: abort.signal,
      tools: {
        insert_text: { name: 'insert_text', description: 'write', inputSchema: {}, readOnlyHint: false, execute },
      },
    },
  );
  abort.abort();
  finish(toolResponse('late', 'insert_text', { text: 'unwanted' }));
  expect((await pending).aborted).toBe(true);
  expect(execute).not.toHaveBeenCalled();
});
it('checks cancellation between tools and preserves result pairing for cancelled calls', async () => {
  const abort = new AbortController();
  const execute = vi.fn(async () => {
    abort.abort();
    return { done: true };
  });
  const response = toolResponse('one', 'write', {});
  response.toolCalls.push({ id: 'two', name: 'write', input: {} });
  const result = await runAgent({ name: 'test', isReady: () => true, chat: async () => response }, 'write', {
    signal: abort.signal,
    tools: { write: { name: 'write', description: 'write', inputSchema: {}, readOnlyHint: false, execute } },
  });
  expect(execute).toHaveBeenCalledTimes(1);
  expect(result.aborted).toBe(true);
  expect(result.messages.at(-1)?.content).toEqual(
    expect.arrayContaining([expect.objectContaining({ toolUseId: 'two', isError: true })]),
  );
});
it('supplies fresh scope only in model requests without contaminating saved or displayed text', async () => {
  const chat = vi.fn().mockResolvedValue(textResponse('answer'));
  const result = await runAgent({ name: 'test', isReady: () => true, chat }, 'question', {
    requestContext: '{"kind":"cell","range":"B2:B10"}',
  });
  expect(chat.mock.calls[0][0][0].content).toContain('B2:B10');
  expect(result.messages[0]).toEqual({ role: 'user', content: 'question' });
});

const toolResponse = (id: string, name: string, input: Record<string, unknown>): LLMResponse => ({
  text: '',
  toolCalls: [{ id, name, input }],
  stopReason: 'tool_use',
  assistant: { role: 'assistant', content: [{ type: 'tool_use', id, name, input }] },
});

/**
 * A provider that returns scripted responses (repeating the last one).
 * `snapshots[n]` is a copy of the messages array passed to the nth chat call —
 * the runtime mutates the live array, so we snapshot it at call time.
 */
function scripted(responses: LLMResponse[]): {
  provider: LLMProvider;
  chat: ReturnType<typeof vi.fn>;
  snapshots: LLMMessage[][];
} {
  let i = 0;
  const snapshots: LLMMessage[][] = [];
  const chat = vi.fn(async (messages: LLMMessage[]) => {
    snapshots.push([...messages]);
    return responses[Math.min(i++, responses.length - 1)];
  });
  return { provider: { name: 'test', isReady: () => true, chat }, chat, snapshots };
}

const makeTool = (name: string, execute: AgentTool['execute']): AgentTool => ({
  name,
  description: `${name} tool`,
  inputSchema: { type: 'object' },
  readOnlyHint: false,
  execute,
});

describe('toLLMToolDefs', () => {
  it('maps a registry to name/description/inputSchema', () => {
    const tools = { a: makeTool('a', async () => null), b: makeTool('b', async () => null) };
    expect(toLLMToolDefs(tools)).toEqual([
      { name: 'a', description: 'a tool', inputSchema: { type: 'object' } },
      { name: 'b', description: 'b tool', inputSchema: { type: 'object' } },
    ]);
  });
});

describe('runAgent', () => {
  it('returns the text when the model makes no tool calls', async () => {
    const { provider, chat } = scripted([textResponse('all done')]);
    const result = await runAgent(provider, 'hi', { tools: {} });
    expect(result.text).toBe('all done');
    expect(result.toolCallCount).toBe(0);
    expect(result.stoppedOnLimit).toBe(false);
    expect(chat).toHaveBeenCalledTimes(1);
  });

  it('executes a tool call, feeds the result back, then finishes', async () => {
    const exec = vi.fn(async () => ({ inserted: true }));
    const tools = { insert_text: makeTool('insert_text', exec) };
    const { provider, chat, snapshots } = scripted([
      toolResponse('t1', 'insert_text', { text: 'hello' }),
      textResponse('inserted it'),
    ]);

    const result = await runAgent(provider, 'insert hello', { tools });

    expect(exec).toHaveBeenCalledWith({ text: 'hello' });
    expect(result.text).toBe('inserted it');
    expect(result.toolCallCount).toBe(1);
    expect(chat).toHaveBeenCalledTimes(2);
    // Second chat must include the tool_result we fed back.
    const secondTurnMessages = snapshots[1];
    const last = secondTurnMessages[secondTurnMessages.length - 1];
    expect(last).toEqual({
      role: 'user',
      content: [{ type: 'tool_result', toolUseId: 't1', content: JSON.stringify({ inserted: true }), isError: false }],
    });
  });

  it('reports an error tool_result for an unknown tool', async () => {
    const { provider, snapshots } = scripted([toolResponse('t1', 'nope', {}), textResponse('handled')]);
    await runAgent(provider, 'go', { tools: {} });
    const secondTurnMessages = snapshots[1];
    const last = secondTurnMessages[secondTurnMessages.length - 1];
    expect(last.content).toEqual([
      { type: 'tool_result', toolUseId: 't1', content: 'Unknown tool: nope', isError: true },
    ]);
  });

  it('captures a thrown tool error as an error tool_result', async () => {
    const tools = {
      boom: makeTool('boom', async () => {
        throw new Error('editor not ready');
      }),
    };
    const { provider, snapshots } = scripted([toolResponse('t1', 'boom', {}), textResponse('ok')]);
    await runAgent(provider, 'go', { tools });
    const secondTurnMessages = snapshots[1];
    const last = secondTurnMessages[secondTurnMessages.length - 1];
    expect(last.content).toEqual([
      { type: 'tool_result', toolUseId: 't1', content: 'editor not ready', isError: true },
    ]);
  });

  it('stops on the iteration cap when the model keeps calling tools', async () => {
    const tools = { loop: makeTool('loop', async () => ({})) };
    const { provider, chat } = scripted([toolResponse('t', 'loop', {})]); // always a tool call
    const result = await runAgent(provider, 'go', { tools, maxIterations: 3 });
    expect(result.stoppedOnLimit).toBe(true);
    expect(result.text).toBe('');
    expect(chat).toHaveBeenCalledTimes(3);
    expect(result.toolCallCount).toBe(3);
  });

  it('returns aborted without calling chat when the signal is already aborted', async () => {
    const { provider, chat } = scripted([textResponse('x')]);
    const ac = new AbortController();
    ac.abort();
    const result = await runAgent(provider, 'go', { tools: {}, signal: ac.signal });
    expect(result.aborted).toBe(true);
    expect(chat).not.toHaveBeenCalled();
  });

  it('prepends prior history before the new user message', async () => {
    const { provider, snapshots } = scripted([textResponse('ok')]);
    const history: LLMMessage[] = [
      { role: 'user', content: 'earlier' },
      { role: 'assistant', content: 'sure' },
    ];
    await runAgent(provider, 'now this', { tools: {}, history });
    const firstTurnMessages = snapshots[0];
    expect(firstTurnMessages).toEqual([...history, { role: 'user', content: 'now this' }]);
  });

  it('emits progress events for assistant text, tool calls, and tool results', async () => {
    const tools = { do_x: makeTool('do_x', async () => ({ ok: 1 })) };
    const { provider } = scripted([toolResponse('t1', 'do_x', { a: 1 }), textResponse('finished')]);
    const events: string[] = [];
    await runAgent(provider, 'go', {
      tools,
      onEvent: (e) => events.push(e.type),
    });
    expect(events).toEqual(['tool_call', 'tool_result', 'assistant']);
  });

  it('uses chatStream when present, emitting deltas then a streamed assistant event', async () => {
    const chatStream = vi.fn(async (_messages: LLMMessage[], _tools, onDelta: (d: string) => void) => {
      onDelta('Hel');
      onDelta('lo');
      return textResponse('Hello');
    });
    const chat = vi.fn();
    const provider: LLMProvider = { name: 'test', isReady: () => true, chat, chatStream };
    const events: AgentEvent[] = [];

    const result = await runAgent(provider, 'go', { tools: {}, onEvent: (e) => events.push(e) });

    expect(chatStream).toHaveBeenCalledTimes(1);
    expect(chat).not.toHaveBeenCalled();
    expect(events.filter((e) => e.type === 'assistant_delta').map((e) => (e as { text: string }).text)).toEqual([
      'Hel',
      'lo',
    ]);
    expect(events.find((e) => e.type === 'assistant')).toMatchObject({ text: 'Hello', streamed: true });
    expect(result.text).toBe('Hello');
  });
});

it('retains current document scope and two complete tool exchanges after trimming old history', async () => {
  const history: LLMMessage[] = [
    { role: 'user', content: '旧文档范围🧾'.repeat(400) },
    { role: 'assistant', content: '旧结果'.repeat(400) },
  ];
  const original = structuredClone(history);
  const { provider, snapshots } = scripted([
    toolResponse('read-one', 'read', { range: 'B2' }),
    toolResponse('read-two', 'read', { range: 'C2' }),
    textResponse('完成'),
  ]);
  const execute = vi.fn(async ({ range }) => ({ range, value: '中文🧾' }));
  const trimmed = vi.fn();
  const result = await runAgent(provider, '检查这两个单元格', {
    history,
    requestContext: '{"kind":"cell","range":"B2:C2"}',
    maxContextBytes: 1600,
    tools: { read: makeTool('read', execute) },
    onContextTrimmed: trimmed,
  });
  expect(snapshots).toHaveLength(3);
  for (const request of snapshots) {
    expect(request[0].content).toContain('B2:C2');
    expect(request[0].content).toContain('检查这两个单元格');
    expect(JSON.stringify(request)).not.toContain('旧文档');
  }
  expect(snapshots[2].slice(1)).toEqual([
    toolResponse('read-one', 'read', { range: 'B2' }).assistant,
    {
      role: 'user',
      content: [
        { type: 'tool_result', toolUseId: 'read-one', content: '{"range":"B2","value":"中文🧾"}', isError: false },
      ],
    },
    toolResponse('read-two', 'read', { range: 'C2' }).assistant,
    {
      role: 'user',
      content: [
        { type: 'tool_result', toolUseId: 'read-two', content: '{"range":"C2","value":"中文🧾"}', isError: false },
      ],
    },
  ]);
  expect(trimmed).toHaveBeenCalledTimes(1);
  expect(execute).toHaveBeenCalledTimes(2);
  expect(history).toEqual(original);
  expect(result.messages.slice(0, 2)).toEqual(original);
  expect(result.messages[2]).toEqual({ role: 'user', content: '检查这两个单元格' });
  expect(result.messages).toHaveLength(8);
});

it('stops before another inference when the current tool exchange exceeds the context budget', async () => {
  const { provider, chat } = scripted([toolResponse('large', 'read', {})]);
  const execute = vi.fn(async () => '中文🧾'.repeat(500));
  await expect(
    runAgent(provider, '读取', {
      tools: { read: makeTool('read', execute) },
      maxContextBytes: 400,
    }),
  ).rejects.toThrow('agentContextTooLong');
  expect(chat).toHaveBeenCalledTimes(1);
  expect(execute).toHaveBeenCalledTimes(1);
});

it('surfaces provider token trimming while preserving archival messages', async () => {
  const history: LLMMessage[] = [
    { role: 'user', content: 'old' },
    { role: 'assistant', content: 'answer' },
  ];
  const trimmed = vi.fn();
  const chat = vi.fn().mockResolvedValue({ ...textResponse('new answer'), contextTrimmed: true });
  const result = await runAgent({ name: 'test', isReady: () => true, chat }, 'new request', {
    history,
    onContextTrimmed: trimmed,
  });
  expect(trimmed).toHaveBeenCalledOnce();
  expect(result.messages.slice(0, 2)).toEqual(history);
  expect(result.messages).toHaveLength(4);
});

it('passes long input intact to a provider that budgets the final request by tokens', async () => {
  const chat = vi.fn().mockResolvedValue(textResponse('answer'));
  const provider = { name: 'measured', isReady: () => true, hasExactContextBudget: () => true, chat };
  const request = 'a'.repeat(10000);
  await runAgent(provider, request);
  expect(chat.mock.calls[0][0]).toEqual([{ role: 'user', content: request }]);
  await expect(runAgent(provider, request, { maxContextBytes: 400 })).rejects.toThrow('agentContextTooLong');
});
