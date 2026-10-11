import { describe, expect, it, vi } from 'vitest';
import { t } from '@ranuts/shared/i18n';
import { historyToTurns } from '../../lib/agent-plugin/ui/storage';
import { ChatView } from '../../packages/chat-ui/src/chat-view';
import { AgentChatController, type ChatTurn } from '../../lib/agent-plugin/ui/controller';
import type { AgentTool } from '@ranuts/agent-core/types';
import type { LLMMessage, LLMProvider, LLMResponse } from '@ranuts/agent-core/llm/types';

const textResponse = (text: string): LLMResponse => ({
  text,
  toolCalls: [],
  stopReason: 'end_turn',
  assistant: { role: 'assistant', content: [{ type: 'text', text }] },
});

it('preserves visible interrupted prose and safe error guidance after a streaming failure', async () => {
  let saved: LLMMessage[] = [];
  const turns: ChatTurn[] = [];
  const provider: LLMProvider = {
    name: 'test',
    isReady: () => true,
    chat: async () => textResponse('unused'),
    chatStream: async (_messages, _tools, delta) => {
      delta('<think>private reasoning</think>visible fragment');
      throw new Error('network failed secret=private');
    },
  };
  const controller = new AgentChatController(provider, (turn) => turns.push(turn), {
    onAgentDelta: () => {},
    storage: {
      load: () => saved,
      save: (messages) => {
        saved = structuredClone(messages);
      },
      clear: () => {},
    },
  });
  await controller.send('question');
  expect(saved).toEqual([
    { role: 'user', content: 'question' },
    { role: 'assistant', content: 'visible fragment', interrupted: true },
    { role: 'assistant', content: t('agentRequestFailed'), hostGuidance: 'error' },
  ]);
  expect(historyToTurns(saved).slice(-2)).toEqual([
    { role: 'agent', text: 'visible fragment', interrupted: true },
    { role: 'error', text: t('agentRequestFailed') },
  ]);
  expect(turns.at(-1)).toEqual({ role: 'error', text: t('agentRequestFailed') });
  expect(JSON.stringify(saved)).not.toContain('private');
  const restored = new ChatView({ onSend: () => {}, onApplyMessage: async () => 'verified' });
  restored.el.querySelector<HTMLElement>('.cui-messages')!.scrollTo = vi.fn();
  for (const turn of historyToTurns(saved)) restored.append(turn);
  expect(restored.getLastAnswer()).toBe('');
  expect(restored.el.querySelector('[data-interrupted]')?.textContent).toContain('visible fragment');
  expect(restored.el.querySelector('.cui-apply')).toBeNull();
  expect(restored.el.querySelector('.cui-copy')).not.toBeNull();
});

it('does not duplicate host history after a model failure and retry', async () => {
  let reject!: (error: Error) => void;
  const save = vi.fn();
  let calls = 0;
  const provider: LLMProvider = {
    name: 'test',
    isReady: () => true,
    chat: async () =>
      ++calls === 1
        ? new Promise((_resolve, fail) => {
            reject = fail;
          })
        : textResponse('answer'),
  };
  const controller = new AgentChatController(provider, () => {}, {
    storage: { load: () => [], save, clear: () => {} },
  });
  const run = controller.send('question');
  await vi.waitFor(() => expect(reject).toBeTypeOf('function'));
  controller.recordExternalMessages([{ role: 'assistant', content: 'host operation' }]);
  reject(new Error('model failed'));
  await run;
  await controller.send('retry');
  expect(save.mock.calls.at(-1)![0].filter((message: LLMMessage) => message.content === 'host operation')).toHaveLength(
    1,
  );
});

it('preserves host-operation history arriving during a model turn', async () => {
  let resolve!: (response: LLMResponse) => void;
  const save = vi.fn();
  const provider: LLMProvider = {
    name: 'test',
    isReady: () => true,
    chat: () =>
      new Promise((done) => {
        resolve = done;
      }),
  };
  const controller = new AgentChatController(provider, () => {}, {
    storage: { load: () => [], save, clear: () => {} },
  });
  const run = controller.send('question');
  await vi.waitFor(() => expect(resolve).toBeTypeOf('function'));
  controller.recordExternalMessages([{ role: 'assistant', content: 'verified external operation' }]);
  resolve(textResponse('answer'));
  await run;
  expect(save.mock.calls.at(-1)![0]).toContainEqual({ role: 'assistant', content: 'verified external operation' });
});

const toolResponse = (id: string, name: string, input: Record<string, unknown>): LLMResponse => ({
  text: '',
  toolCalls: [{ id, name, input }],
  stopReason: 'tool_use',
  assistant: { role: 'assistant', content: [{ type: 'tool_use', id, name, input }] },
});

function scripted(responses: LLMResponse[]): LLMProvider {
  let i = 0;
  return {
    name: 'test',
    isReady: () => true,
    chat: vi.fn(async () => responses[Math.min(i++, responses.length - 1)]),
  };
}

/** Like scripted, but snapshots each chat's messages array (runAgent mutates it). */
function scriptedWithSnapshots(responses: LLMResponse[]): {
  provider: LLMProvider;
  snapshots: Array<Array<{ role: string; content: unknown }>>;
} {
  let i = 0;
  const snapshots: Array<Array<{ role: string; content: unknown }>> = [];
  const provider: LLMProvider = {
    name: 'test',
    isReady: () => true,
    chat: vi.fn(async (messages: LLMMessage[]) => {
      snapshots.push(messages.map((m) => ({ role: m.role, content: m.content })));
      return responses[Math.min(i++, responses.length - 1)];
    }),
  };
  return { provider, snapshots };
}

const makeTool = (name: string, execute: AgentTool['execute']): AgentTool => ({
  name,
  description: `${name} tool`,
  inputSchema: { type: 'object' },
  readOnlyHint: false,
  execute,
});

function collect(provider: LLMProvider, options = {}) {
  const turns: ChatTurn[] = [];
  const controller = new AgentChatController(provider, (t) => turns.push(t), options);
  return { controller, turns };
}

describe('AgentChatController', () => {
  it('disposes pending requests without clearing persisted history or saving late results', async () => {
    let finish!: (response: LLMResponse) => void;
    const provider: LLMProvider = {
      name: 'test',
      isReady: () => true,
      chat: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    };
    const storage = { load: () => [], save: vi.fn(), clear: vi.fn() };
    const { controller, turns } = collect(provider, { tools: {}, storage });
    const pending = controller.send('old request');
    await Promise.resolve();
    controller.dispose();
    finish(textResponse('late answer'));
    await pending;
    expect(turns).toHaveLength(1);
    expect(storage.save).toHaveBeenCalledExactlyOnceWith([{ role: 'user', content: 'old request' }]);
    expect(storage.clear).not.toHaveBeenCalled();
  });
  it('does not restore cleared history or display late output when reset during a pending request', async () => {
    let finish!: (response: LLMResponse) => void;
    const provider: LLMProvider = {
      name: 'test',
      isReady: () => true,
      chat: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    };
    const storage = { load: () => [], save: vi.fn(), clear: vi.fn() };
    const { controller, turns } = collect(provider, { tools: {}, storage });
    const pending = controller.send('old request');
    await Promise.resolve();
    controller.reset();
    const count = turns.length;
    finish(textResponse('late answer'));
    await pending;
    expect(turns).toHaveLength(count);
    expect(storage.save).toHaveBeenCalledTimes(1);
    expect(storage.clear).toHaveBeenCalledTimes(1);
  });
  it('ignores empty input', async () => {
    const { controller, turns } = collect(scripted([textResponse('x')]), { tools: {} });
    await controller.send('   ');
    expect(turns).toEqual([]);
    expect(controller.isRunning()).toBe(false);
  });

  it('emits a user turn then an agent turn for a plain reply', async () => {
    const { controller, turns } = collect(scripted([textResponse('done editing')]), { tools: {} });
    await controller.send('do something');
    expect(turns).toEqual([
      { role: 'user', text: 'do something' },
      { role: 'agent', text: 'done editing' },
    ]);
  });
  it('offers recovery rather than leaving a blank answer when the model only emits protocol text', async () => {
    const { controller, turns } = collect(scripted([textResponse('[{"name":"get_selection","arguments":{}}]')]), {
      tools: {},
    });
    await controller.send('hello');
    expect(turns).toEqual([
      { role: 'user', text: 'hello' },
      { role: 'error', text: t('agentRequestFailed') },
    ]);
  });

  it('emits a tool turn when the agent calls a tool', async () => {
    const tools = { insert_text: makeTool('insert_text', async () => ({ inserted: true })) };
    const provider = scripted([toolResponse('t1', 'insert_text', { text: 'hi' }), textResponse('inserted')]);
    const { controller, turns } = collect(provider, { tools });
    await controller.send('insert hi');
    expect(turns).toEqual([
      { role: 'user', text: 'insert hi' },
      { role: 'tool', text: t('agentUpdateDocument') },
      { role: 'agent', text: 'inserted' },
    ]);
  });

  it('emits an error turn when a tool fails', async () => {
    const tools = {
      boom: makeTool('boom', async () => {
        throw new Error('editor not ready');
      }),
    };
    const provider = scripted([toolResponse('t1', 'boom', {}), textResponse('recovered')]);
    const { turns, controller } = collect(provider, { tools });
    await controller.send('go');
    expect(turns).toContainEqual({ role: 'error', text: t('agentRequestFailed') });
  });

  it('emits an error turn when the iteration cap is hit', async () => {
    const tools = { loop: makeTool('loop', async () => ({})) };
    const provider = scripted([toolResponse('t', 'loop', {})]);
    const { controller, turns } = collect(provider, { tools, maxIterations: 2 });
    await controller.send('go');
    expect(turns).toContainEqual({ role: 'error', text: t('agentMaxSteps') });
  });

  it('emits an error turn when the provider throws', async () => {
    const provider: LLMProvider = {
      name: 'test',
      isReady: () => true,
      chat: vi.fn(async () => {
        throw new Error('401 unauthorized');
      }),
    };
    const { controller, turns } = collect(provider, { tools: {} });
    await controller.send('go');
    expect(turns).toContainEqual({ role: 'error', text: t('agentRequestFailed') });
    expect(controller.isRunning()).toBe(false);
  });

  it('accumulates history across sends', async () => {
    const { provider, snapshots } = scriptedWithSnapshots([textResponse('first'), textResponse('second')]);
    const { controller } = collect(provider, { tools: {} });
    await controller.send('one');
    await controller.send('two');
    // Second send's history must include the first exchange + the new user message.
    const secondCallMessages = snapshots[1];
    expect(secondCallMessages.length).toBeGreaterThanOrEqual(3);
    expect(secondCallMessages[secondCallMessages.length - 1]).toEqual({ role: 'user', content: 'two' });
  });

  it('stop() aborts the run and emits a stopped turn', async () => {
    let resolveChat: () => void = () => {};
    const provider: LLMProvider = {
      name: 'test',
      isReady: () => true,
      chat: vi.fn(
        () =>
          new Promise<LLMResponse>((resolve) => {
            resolveChat = () => resolve(toolResponse('t1', 'loop', {}));
          }),
      ),
    };
    const tools = { loop: makeTool('loop', async () => ({})) };
    const { controller, turns } = collect(provider, { tools });

    const pending = controller.send('go');
    await Promise.resolve(); // let send() reach the awaited chat()
    controller.stop();
    resolveChat(); // first chat returns a tool call; next iteration sees the abort
    await pending;

    expect(turns).toContainEqual({ role: 'status', text: t('agentStopped') });
    expect(controller.isRunning()).toBe(false);
  });

  it('streams deltas via onAgentDelta and finalizes without a duplicate agent turn', async () => {
    const streamingProvider: LLMProvider = {
      name: 'test',
      isReady: () => true,
      chat: vi.fn(),
      chatStream: vi.fn(async (_messages, _tools, onDelta: (d: string) => void) => {
        onDelta('Hel');
        onDelta('lo');
        return textResponse('Hello');
      }),
    };
    const turns: ChatTurn[] = [];
    const deltas: string[] = [];
    let ended = 0;
    const controller = new AgentChatController(streamingProvider, (t) => turns.push(t), {
      tools: {},
      onAgentDelta: (d) => deltas.push(d),
      onAgentStreamEnd: () => ended++,
    });

    await controller.send('go');

    expect(deltas).toEqual(['Hel', 'lo']);
    expect(ended).toBe(1);
    // The streamed text was shown via deltas, so no separate agent turn is emitted.
    expect(turns).toEqual([{ role: 'user', text: 'go' }]);
  });

  it('falls back to an agent turn for a streamed reply when no delta handler is wired', async () => {
    const streamingProvider: LLMProvider = {
      name: 'test',
      isReady: () => true,
      chat: vi.fn(),
      chatStream: vi.fn(async (_messages, _tools, onDelta: (d: string) => void) => {
        onDelta('Hi');
        return textResponse('Hi');
      }),
    };
    const { controller, turns } = collect(streamingProvider, { tools: {} });
    await controller.send('go');
    expect(turns).toContainEqual({ role: 'agent', text: 'Hi' });
  });

  it('reset clears history', async () => {
    const { provider, snapshots } = scriptedWithSnapshots([textResponse('first'), textResponse('second')]);
    const { controller } = collect(provider, { tools: {} });
    await controller.send('one');
    controller.reset();
    await controller.send('two');
    expect(snapshots[1]).toEqual([{ role: 'user', content: 'two' }]);
  });

  it('persists history to storage after a send and clears it on reset', async () => {
    let saved: LLMMessage[] | null = [];
    const storage = {
      load: () => saved ?? [],
      save: (m: LLMMessage[]) => {
        saved = m;
      },
      clear: () => {
        saved = [];
      },
    };
    const turns: ChatTurn[] = [];
    const controller = new AgentChatController(scripted([textResponse('hi')]), (t) => turns.push(t), {
      tools: {},
      storage,
    });
    await controller.send('hello');
    expect(saved).toEqual([
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: [{ type: 'text', text: 'hi' }] },
    ]);
    controller.reset();
    expect(saved).toEqual([]);
  });

  it('restores prior history from storage on construction', async () => {
    const prior: LLMMessage[] = [
      { role: 'user', content: 'earlier' },
      { role: 'assistant', content: [{ type: 'text', text: 'sure' }] },
    ];
    const storage = { load: () => prior, save: () => {}, clear: () => {} };
    const { provider, snapshots } = scriptedWithSnapshots([textResponse('ok')]);
    const controller = new AgentChatController(provider, () => {}, { tools: {}, storage });
    await controller.send('next');
    // The restored history precedes the new user message in what the model sees.
    expect(snapshots[0]).toEqual([...prior, { role: 'user', content: 'next' }]);
  });
});

it('forwards backend statistics without persisting them as conversation messages', async () => {
  const usage = { completionTokens: 7, decodeTokensPerSecond: 12.5, timeToFirstTokenMs: 200 };
  const stats = vi.fn(),
    save = vi.fn();
  const provider: LLMProvider = {
    name: 'test',
    isReady: () => true,
    chat: async () => ({ ...textResponse('answer'), usage }),
  };
  const controller = new AgentChatController(provider, () => {}, {
    onUsage: stats,
    storage: { load: () => [], save, clear: () => {} },
  });
  await controller.send('question');
  expect(stats).toHaveBeenCalledWith(usage);
  expect(JSON.stringify(save.mock.calls)).not.toContain('decodeTokensPerSecond');
});

it('ignores statistics from a backend completion arriving after Stop', async () => {
  let finish!: (response: LLMResponse) => void;
  const stats = vi.fn();
  const provider: LLMProvider = {
    name: 'test',
    isReady: () => true,
    chat: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  };
  const controller = new AgentChatController(provider, () => {}, { onUsage: stats });
  const pending = controller.send('question');
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
  controller.stop();
  finish({ ...textResponse('late answer'), usage: { completionTokens: 7, decodeTokensPerSecond: 12.5 } });
  await pending;
  expect(stats).not.toHaveBeenCalled();
});

it('labels a rejected cancelled request as stopped rather than a model failure', async () => {
  let calls = 0;
  const provider: LLMProvider = {
    name: 'test',
    isReady: () => true,
    chat: (_messages, _tools, signal) =>
      ++calls === 1
        ? new Promise((_resolve, reject) =>
            signal?.addEventListener('abort', () => reject(signal.reason), { once: true }),
          )
        : Promise.resolve(textResponse('Recovered')),
  };
  const { controller, turns } = collect(provider);
  const pending = controller.send('go');
  await Promise.resolve();
  controller.stop();
  await pending;
  expect(turns).toContainEqual({ role: 'status', text: t('agentStopped') });
  expect(controller.isRunning()).toBe(false);
  await controller.send('Try again');
  expect(turns.at(-1)).toEqual({ role: 'agent', text: 'Recovered' });
  expect(turns.some((turn) => turn.role === 'error')).toBe(false);
});

it('preserves a completed tool exchange when the following model call fails', async () => {
  let saved: LLMMessage[] = [];
  let call = 0;
  const requests: LLMMessage[][] = [];
  const execute = vi.fn(async () => ({ applied: true }));
  const provider: LLMProvider = {
    name: 'test',
    isReady: () => true,
    chat: async (messages) => {
      requests.push(structuredClone(messages));
      if (++call === 1) return toolResponse('write-once', 'write', { text: '中文🧾' });
      if (call === 2) throw new Error('model failed after document update');
      return textResponse('already applied');
    },
  };
  const storage = {
    load: () => saved,
    save: (messages: LLMMessage[]) => {
      saved = structuredClone(messages);
    },
    clear: () => {},
  };
  const controller = new AgentChatController(provider, () => {}, {
    storage,
    tools: { write: makeTool('write', execute) },
  });
  await controller.send('write it');
  expect(saved).toEqual([
    { role: 'user', content: 'write it' },
    toolResponse('write-once', 'write', { text: '中文🧾' }).assistant,
    {
      role: 'user',
      content: [{ type: 'tool_result', toolUseId: 'write-once', content: '{"applied":true}', isError: false }],
    },
  ]);
  await controller.send('what happened?');
  expect(requests[2].slice(0, 3)).toEqual(saved.slice(0, 3));
  expect(execute).toHaveBeenCalledTimes(1);
});

it('does not restore a completed tool checkpoint into a reset conversation', async () => {
  let finish!: (result: unknown) => void;
  const save = vi.fn();
  const clear = vi.fn();
  const execute = vi.fn(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const controller = new AgentChatController(
    { name: 'test', isReady: () => true, chat: async () => toolResponse('pending', 'write', {}) },
    () => {},
    {
      storage: { load: () => [], save, clear },
      tools: { write: makeTool('write', execute) },
    },
  );
  const run = controller.send('write');
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
  controller.reset();
  finish({ applied: true });
  await run;
  expect(save).toHaveBeenCalledTimes(1);
  expect(clear).toHaveBeenCalledTimes(1);
});

it('saves the executed and cancelled results of a multi-tool batch after Stop', async () => {
  let saved: LLMMessage[] = [];
  let controller: AgentChatController;
  const response = toolResponse('first', 'write', { text: 'first' });
  response.toolCalls.push({ id: 'second', name: 'write', input: { text: 'second' } });
  response.assistant.content = response.toolCalls.map((call) => ({ type: 'tool_use', ...call }));
  const execute = vi.fn(async () => {
    controller.stop();
    return { applied: true };
  });
  const provider = scripted([response]);
  controller = new AgentChatController(provider, () => {}, {
    tools: { write: makeTool('write', execute) },
    storage: {
      load: () => saved,
      save: (messages) => {
        saved = structuredClone(messages);
      },
      clear: () => {},
    },
  });
  await controller.send('do both');
  expect(execute).toHaveBeenCalledTimes(1);
  expect(provider.chat).toHaveBeenCalledTimes(1);
  expect(saved).toEqual([
    { role: 'user', content: 'do both' },
    response.assistant,
    {
      role: 'user',
      content: [
        { type: 'tool_result', toolUseId: 'first', content: '{"applied":true}', isError: false },
        { type: 'tool_result', toolUseId: 'second', content: 'Cancelled before execution', isError: true },
      ],
    },
    { role: 'assistant', content: t('agentStopped'), hostGuidance: 'status' },
  ]);
});

it('keeps a concurrent host operation exactly once after a checkpoint and inference failure', async () => {
  let saved: LLMMessage[] = [];
  let reject!: (error: Error) => void;
  let calls = 0;
  const provider: LLMProvider = {
    name: 'test',
    isReady: () => true,
    chat: async () =>
      ++calls === 1
        ? toolResponse('done', 'write', {})
        : new Promise((_resolve, fail) => {
            reject = fail;
          }),
  };
  const controller = new AgentChatController(provider, () => {}, {
    tools: { write: makeTool('write', async () => ({ applied: true })) },
    storage: {
      load: () => saved,
      save: (messages) => {
        saved = structuredClone(messages);
      },
      clear: () => {},
    },
  });
  const run = controller.send('write');
  await vi.waitFor(() => expect(reject).toBeTypeOf('function'));
  const host: LLMMessage = { role: 'assistant', content: 'host operation complete' };
  controller.recordExternalMessages([host]);
  reject(new Error('model failed'));
  await run;
  expect(saved).toHaveLength(4);
  expect(saved.at(-1)).toEqual(host);
  expect(saved[2].content).toEqual([
    { type: 'tool_result', toolUseId: 'done', content: '{"applied":true}', isError: false },
  ]);
});

it.each(['reject', 'resolve'] as const)(
  'persists visible interrupted prose after %s cancellation and supplies it to the next turn',
  async (mode) => {
    let saved: LLMMessage[] = [{ role: 'user', content: 'earlier' }, textResponse('previous').assistant];
    let finish!: () => void;
    const requests: LLMMessage[][] = [];
    let calls = 0;
    const provider: LLMProvider = {
      name: 'test',
      isReady: () => true,
      chat: async () => textResponse('unused'),
      chatStream: (messages, _tools, delta, signal) => {
        requests.push(structuredClone(messages));
        if (++calls > 1) return Promise.resolve(textResponse('next'));
        delta('<think>private reasoning</think>visible partial');
        return new Promise((resolve, reject) => {
          finish = () => (mode === 'reject' ? reject(signal?.reason) : resolve(textResponse('late answer')));
        });
      },
    };
    const deltas: string[] = [];
    const storage = {
      load: () => saved,
      save: (messages: LLMMessage[]) => {
        saved = structuredClone(messages);
      },
      clear: () => {},
    };
    const controller = new AgentChatController(provider, () => {}, {
      storage,
      onAgentDelta: (delta) => deltas.push(delta),
    });
    const pending = controller.send('interrupted');
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    controller.stop();
    finish();
    await pending;
    expect(deltas.join('')).toBe('visible partial');
    expect(saved.slice(0, 2)).toEqual([{ role: 'user', content: 'earlier' }, textResponse('previous').assistant]);
    expect(saved.slice(-2)).toEqual([
      { role: 'assistant', content: 'visible partial', interrupted: true },
      { role: 'assistant', content: t('agentStopped'), hostGuidance: 'status' },
    ]);
    expect(historyToTurns(saved).slice(-2)).toEqual([
      { role: 'agent', text: 'visible partial', interrupted: true },
      { role: 'status', text: t('agentStopped') },
    ]);
    const reopened = new AgentChatController(provider, () => {}, { storage });
    await reopened.send('new request');
    expect(requests[1].slice(-3)).toEqual([
      { role: 'assistant', content: 'visible partial', interrupted: true },
      { role: 'assistant', content: t('agentStopped'), hostGuidance: 'status' },
      { role: 'user', content: 'new request' },
    ]);
    expect(JSON.stringify(saved)).not.toContain('private reasoning');
    expect(JSON.stringify(saved)).not.toContain('late answer');
  },
);

it.each(['<think>private unfinished', '{"name":"insert_text","arguments":'])(
  'does not reveal held content when stopped: %s',
  async (hidden) => {
    let saved: LLMMessage[] = [];
    let fail!: () => void;
    const delta = vi.fn();
    const provider: LLMProvider = {
      name: 'test',
      isReady: () => true,
      chat: async () => textResponse('unused'),
      chatStream: (_messages, _tools, emit, signal) => {
        emit(hidden);
        return new Promise((_resolve, reject) => {
          fail = () => {
            emit('late');
            reject(signal?.reason);
          };
        });
      },
    };
    const controller = new AgentChatController(provider, () => {}, {
      onAgentDelta: delta,
      storage: {
        load: () => [],
        save: (messages) => {
          saved = structuredClone(messages);
        },
        clear: () => {},
      },
    });
    const pending = controller.send('go');
    await vi.waitFor(() => expect(fail).toBeTypeOf('function'));
    controller.stop();
    fail();
    await pending;
    expect(delta).not.toHaveBeenCalled();
    expect(saved).toEqual([
      { role: 'user', content: 'go' },
      { role: 'assistant', content: t('agentStopped'), hostGuidance: 'status' },
    ]);
  },
);

it.each(['cancel', 'failure'] as const)(
  'preserves the completed tool exchange exactly once before %s',
  async (mode) => {
    let saved: LLMMessage[] = [];
    let fail!: () => void;
    let calls = 0;
    const first = toolResponse('read', 'read_document', {});
    first.text = 'Reading';
    first.assistant.content = [
      { type: 'text', text: 'Reading' },
      { type: 'tool_use', id: 'read', name: 'read_document', input: {} },
    ];
    const execute = vi.fn(async () => ({ text: 'verified source' }));
    const provider: LLMProvider = {
      name: 'test',
      isReady: () => true,
      chat: async () => textResponse('unused'),
      chatStream: (_messages, _tools, emit, signal) => {
        if (++calls === 1) {
          emit('Reading');
          return Promise.resolve(first);
        }
        emit('Partial follow-up');
        return new Promise((_resolve, reject) => {
          fail = () => reject(mode === 'cancel' ? signal?.reason : new Error('private provider failure'));
        });
      },
    };
    const controller = new AgentChatController(provider, () => {}, {
      onAgentDelta: () => {},
      tools: { read_document: makeTool('read_document', execute) },
      storage: {
        load: () => [],
        save: (messages) => {
          saved = structuredClone(messages);
        },
        clear: () => {},
      },
    });
    const pending = controller.send('read');
    await vi.waitFor(() => expect(fail).toBeTypeOf('function'));
    if (mode === 'cancel') controller.stop();
    fail();
    await pending;
    expect(execute).toHaveBeenCalledTimes(1);
    expect(saved[1]).toEqual(first.assistant);
    expect(saved[2]).toEqual({
      role: 'user',
      content: [{ type: 'tool_result', toolUseId: 'read', content: '{"text":"verified source"}', isError: false }],
    });
    // Tool-bearing partial streams are unclassified and never shown or archived
    // as an answer. The completed read exchange remains paired and durable.
    expect(saved.slice(3)).toEqual(
      mode === 'cancel' ? [{ role: 'assistant', content: t('agentStopped'), hostGuidance: 'status' }] : [],
    );
  },
);

it('does not display or archive unclassified follow-up after a tool response', async () => {
  let saved: LLMMessage[] = [];
  let fail!: () => void;
  let calls = 0;
  const deltas: string[] = [];
  const provider: LLMProvider = {
    name: 'test',
    isReady: () => true,
    chat: async () => textResponse('unused'),
    chatStream: (_messages, _tools, emit, signal) => {
      if (++calls === 1) {
        emit('{"name":"read_document","arguments":');
        return Promise.resolve(toolResponse('read', 'read_document', {}));
      }
      emit('Visible follow-up');
      return new Promise((_resolve, reject) => {
        fail = () => reject(signal?.reason);
      });
    },
  };
  const controller = new AgentChatController(provider, () => {}, {
    onAgentDelta: (text) => deltas.push(text),
    tools: { read_document: makeTool('read_document', async () => ({ text: 'source' })) },
    storage: {
      load: () => [],
      save: (messages) => {
        saved = structuredClone(messages);
      },
      clear: () => {},
    },
  });
  const pending = controller.send('read');
  await vi.waitFor(() => expect(fail).toBeTypeOf('function'));
  controller.stop();
  fail();
  await pending;
  expect(deltas).toEqual([]);
  expect(saved.at(-1)).toEqual({ role: 'assistant', content: t('agentStopped'), hostGuidance: 'status' });
  expect(saved).not.toContainEqual(expect.objectContaining({ content: 'Visible follow-up' }));
});
