import { afterEach, expect, it, vi } from 'vitest';
import { runAgent } from '@ranuts/agent-core/runtime';
import type { LLMMessage, LLMProvider, LLMResponse } from '@ranuts/agent-core/llm/types';
import { createDocumentAgentTools } from '../../lib/agent-plugin/document-agent-tools';
import type { DocumentToolTarget } from '../../lib/agent-plugin/document-tool-action';
import { agentTools } from '../../lib/agent-plugin/tools';

const target = (): DocumentToolTarget => ({
  context: { kind: 'word' },
  label: 'Word',
  selectedText: '',
  isCurrent: () => true,
});
afterEach(() => vi.restoreAllMocks());
it('returns actual read and reviewed write results to subsequent inference', async () => {
  const read = vi.spyOn(agentTools.get_document_text, 'execute').mockResolvedValue({ text: 'Actual body' });
  const write = vi.spyOn(agentTools.insert_text, 'execute').mockResolvedValue({ verified: true });
  const review = vi.fn(async (action) => ({ status: await action.apply(), action })),
    receipt = vi.fn();
  const snapshots: LLMMessage[][] = [];
  const responses = [
    { id: 'read', name: 'get_document_text', input: {} },
    { id: 'write', name: 'insert_text', input: { text: 'Edited body' } },
  ];
  const provider: LLMProvider = {
    name: 'scripted',
    isReady: () => true,
    chat: async (messages): Promise<LLMResponse> => {
      snapshots.push(structuredClone(messages));
      const call = responses.shift();
      if (!call)
        return {
          text: 'done',
          toolCalls: [],
          stopReason: 'end_turn',
          assistant: { role: 'assistant', content: 'done' },
        };
      return {
        text: '',
        toolCalls: [call],
        stopReason: 'tool_use',
        assistant: { role: 'assistant', content: [{ type: 'tool_use', ...call }] },
      };
    },
  };
  const result = await runAgent(provider, 'Read and propose an edit', {
    tools: createDocumentAgentTools({ target: target(), readonly: false, review, receipt }),
  });
  expect(read).toHaveBeenCalledOnce();
  expect(JSON.stringify(snapshots[1])).toContain('Actual body');
  expect(review).toHaveBeenCalledOnce();
  expect(write).toHaveBeenCalledOnce();
  expect(JSON.stringify(snapshots[2])).toContain('verified');
  expect(result.text).toBe('done');
  expect(result.stoppedOnLimit).toBe(false);
});
it('excludes mutations from read-only tools and scopes the registry to the current editor', () => {
  const tools = createDocumentAgentTools({ target: target(), readonly: true, review: vi.fn(), receipt: vi.fn() });
  expect(tools.get_document_text).toBeDefined();
  expect(tools.insert_text).toBeUndefined();
  expect(tools.set_cell).toBeUndefined();
});
it('refuses stale targets and cancelled reads before editor dispatch', async () => {
  const read = vi.spyOn(agentTools.get_document_text, 'execute');
  const current = target();
  const tools = createDocumentAgentTools({ target: current, readonly: false, review: vi.fn(), receipt: vi.fn() });
  current.isCurrent = () => false;
  await expect(tools.get_document_text.execute({})).rejects.toThrow('agentPlanExpired');
  current.isCurrent = () => true;
  const abort = new AbortController();
  abort.abort();
  await expect(tools.get_document_text.execute({}, abort.signal)).rejects.toThrow();
  expect(read).not.toHaveBeenCalled();
});
it('rejects invalid native arguments before review or execution', async () => {
  const review = vi.fn();
  const tools = createDocumentAgentTools({ target: target(), readonly: false, review, receipt: vi.fn() });
  await expect(tools.insert_text.execute({ text: 12 })).rejects.toThrow();
  expect(review).not.toHaveBeenCalled();
});

it.each(['cancelled', 'expired', 'failed', 'sent'] as const)(
  'stops after a reviewed %s outcome without dispatching remaining calls',
  async (status) => {
    const write = vi.spyOn(agentTools.insert_text, 'execute');
    const review = vi.fn(async (action) =>
      status === 'failed' ? { status, action, error: new Error('Native failure') } : { status, action },
    );
    const chat = vi.fn(async (): Promise<LLMResponse> => {
      const calls = [
        { id: 'first', name: 'insert_text', input: { text: 'first' } },
        { id: 'second', name: 'insert_text', input: { text: 'second' } },
      ];
      return {
        text: '',
        toolCalls: calls,
        stopReason: 'tool_use',
        assistant: { role: 'assistant', content: calls.map((call) => ({ type: 'tool_use', ...call })) },
      };
    });
    const result = await runAgent({ name: 'scripted', isReady: () => true, chat }, 'write twice', {
      tools: createDocumentAgentTools({ target: target(), readonly: false, review, receipt: vi.fn() }),
    });
    expect(review).toHaveBeenCalledOnce();
    expect(write).not.toHaveBeenCalled();
    expect(chat).toHaveBeenCalledOnce();
    expect(JSON.stringify(result.messages)).toContain(status);
    expect(result.messages.at(-1)?.content).toEqual(
      expect.arrayContaining([expect.objectContaining({ toolUseId: 'second', isError: true })]),
    );
  },
);

it('advertises slide parameters with the same conditional boundary as execution', async () => {
  const { validateToolInput } = await import('@ranuts/agent-core/runtime');
  const tools = createDocumentAgentTools({
    target: { ...target(), context: { kind: 'slide', page: 1 } },
    readonly: false,
    review: vi.fn(),
    receipt: vi.fn(),
  });
  expect(validateToolInput(tools.slide_action, { action: 'add', page: 1 })).toBeDefined();
  expect(validateToolInput(tools.slide_action, { action: 'duplicate', page: 2 })).toBeDefined();
  expect(validateToolInput(tools.slide_action, { action: 'navigate' })).toBeDefined();
  expect(validateToolInput(tools.slide_action, { action: 'add' })).toBeUndefined();
  expect(validateToolInput(tools.slide_action, { action: 'navigate', page: 2 })).toBeUndefined();
});

it.each([
  ['slide_action', { action: 'navigate', page: 1 }, 'slide'],
  ['sum_range', { range: 'A1:A2' }, 'cell'],
] as const)('continues after the input-specific read %s without claiming a mutation', async (name, input, kind) => {
  vi.spyOn(agentTools[name], 'execute').mockResolvedValue({ verified: true });
  const review = vi.fn();
  const tools = createDocumentAgentTools({
    target: { ...target(), context: { kind } },
    readonly: false,
    review,
    receipt: vi.fn(),
  });
  const outcome = await tools[name].execute(input);
  expect(outcome).toMatchObject({ status: 'completed' });
  const concludesTurn = tools[name].concludesTurn;
  expect(typeof concludesTurn).toBe('function');
  if (typeof concludesTurn !== 'function') throw new Error('Expected a result-dependent turn boundary');
  expect(concludesTurn({ content: JSON.stringify(outcome), isError: false })).toBe(false);
  expect(review).not.toHaveBeenCalled();
});

it('avoids duplicating unchanged write content in the tool result while retaining user revisions', async () => {
  vi.spyOn(agentTools.insert_text, 'execute').mockResolvedValue({ verified: true });
  const tools = createDocumentAgentTools({
    target: target(),
    readonly: false,
    review: async (action) => ({ status: await action.apply(), action }),
    receipt: vi.fn(),
  });
  const result = await tools.insert_text.execute({ text: '内容'.repeat(600) });
  expect(result).toMatchObject({ status: 'verified' });
  expect(result).not.toHaveProperty('input');
  const edited = createDocumentAgentTools({
    target: target(),
    readonly: false,
    review: async (action) => {
      const revised = action.revise('User revision');
      return { status: await revised.apply(), action: revised };
    },
    receipt: vi.fn(),
  });
  expect(await edited.insert_text.execute({ text: 'Original' })).toHaveProperty('input', { text: 'User revision' });
});
it('binds a write target before exposing its review even without a promotion adapter', async () => {
  const next = vi.fn();
  const review = vi.fn(async (action) => {
    expect(next).toHaveBeenCalledExactlyOnceWith(action.target);
    return { status: 'cancelled' as const, action };
  });
  const tools = createDocumentAgentTools({
    target: target(),
    readonly: false,
    review,
    receipt: vi.fn(),
    onTargetChanged: next,
  });
  await tools.insert_text.execute({ text: 'Draft' });
  expect(review).toHaveBeenCalledOnce();
});
