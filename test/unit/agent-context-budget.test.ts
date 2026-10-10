import { expect, it } from 'vitest';
import { budgetMessages } from '../../packages/agent-core/src/context-budget';
import type { LLMMessage } from '@ranuts/agent-core/llm/types';
it('retains a short legacy assistant-only prefix when it fits', () => {
  const messages: LLMMessage[] = [
    { role: 'assistant', content: 'old answer' },
    { role: 'user', content: 'followup' },
  ];
  expect(budgetMessages(messages, 400)).toEqual(messages);
});
it('drops older complete turns and leaves the source history untouched', () => {
  const messages: LLMMessage[] = [
    { role: 'user', content: 'x'.repeat(300) },
    { role: 'assistant', content: 'y'.repeat(300) },
    { role: 'user', content: 'new question' },
  ];
  expect(budgetMessages(messages, 400)).toEqual([messages[2]]);
  expect(messages).toHaveLength(3);
});
it('never separates a tool result from its call within a retained turn', () => {
  const messages: LLMMessage[] = [
    { role: 'user', content: 'x'.repeat(500) },
    { role: 'assistant', content: 'old' },
    { role: 'user', content: 'new' },
    { role: 'assistant', content: [{ type: 'tool_use', id: 't', name: 'sum_range', input: { range: 'A1:A3' } }] },
    { role: 'user', content: [{ type: 'tool_result', toolUseId: 't', content: '3' }] },
  ];
  expect(budgetMessages(messages, 400)).toEqual(messages.slice(2));
});
it('rejects an oversized current turn rather than changing the request or breaking protocol', () => {
  expect(() => budgetMessages([{ role: 'user', content: '中'.repeat(500) }], 400)).toThrow('agentContextTooLong');
});

it.each(['中文范围检查', '🧾📊🙂', 'a\n"\\b', 'e\u0301'])(
  'uses UTF-8 serialized bytes at the exact boundary without splitting %s',
  (content) => {
    const messages: LLMMessage[] = [{ role: 'user', content }];
    const bytes = new TextEncoder().encode(JSON.stringify(messages[0])).byteLength + 16;
    expect(budgetMessages(messages, bytes)).toEqual(messages);
    expect(() => budgetMessages(messages, bytes - 1)).toThrow('agentContextTooLong');
  },
);

it('budgets measured final requests with output reservation and complete tool turns', async () => {
  const { budgetMessagesByTokens } = await import('../../packages/agent-core/src/context-budget');
  const messages: LLMMessage[] = [
    { role: 'user', content: 'old' },
    { role: 'assistant', content: 'answer' },
    { role: 'user', content: 'current' },
    { role: 'assistant', content: [{ type: 'tool_use', id: 't', name: 'sum_range', input: {} }] },
    { role: 'user', content: [{ type: 'tool_result', toolUseId: 't', content: '3' }] },
  ];
  const archive = JSON.stringify(messages);
  const measured: LLMMessage[][] = [];
  const result = await budgetMessagesByTokens(
    messages,
    async (candidate) => {
      measured.push(candidate);
      return { promptTokens: candidate.length === 5 ? 90 : 60, contextTokens: 100 };
    },
    20,
  );
  expect(result.messages).toEqual(messages.slice(2));
  expect(result.trimmed).toBe(true);
  expect(measured).toEqual([messages, messages.slice(2)]);
  expect(JSON.stringify(messages)).toBe(archive);
});

it('rejects current-turn token overflow and propagates counter errors', async () => {
  const { budgetMessagesByTokens } = await import('../../packages/agent-core/src/context-budget');
  const messages: LLMMessage[] = [{ role: 'user', content: 'current' }];
  await expect(
    budgetMessagesByTokens(messages, async () => ({ promptTokens: 81, contextTokens: 100 }), 20),
  ).rejects.toThrow('agentContextTooLong');
  await expect(
    budgetMessagesByTokens(
      messages,
      async () => {
        throw Error('counter unavailable');
      },
      20,
    ),
  ).rejects.toThrow('counter unavailable');
});

it('checks cancellation on either side of native counting', async () => {
  const { budgetMessagesByTokens } = await import('../../packages/agent-core/src/context-budget');
  const controller = new AbortController();
  let calls = 0;
  const count = async () => {
    calls++;
    controller.abort();
    return { promptTokens: 1, contextTokens: 10 };
  };
  await expect(budgetMessagesByTokens([], count, 1, controller.signal)).rejects.toThrow();
  expect(calls).toBe(1);
  await expect(budgetMessagesByTokens([], count, 1, controller.signal)).rejects.toThrow();
  expect(calls).toBe(1);
});

it.each([NaN, -1, 1.5, Infinity])('rejects invalid prompt counts %s', async (promptTokens) => {
  const { budgetMessagesByTokens } = await import('../../packages/agent-core/src/context-budget');
  await expect(budgetMessagesByTokens([], async () => ({ promptTokens, contextTokens: 10 }), 1)).rejects.toThrow(
    'Invalid token count',
  );
});

it('accepts the exact reserved boundary and keeps short history intact', async () => {
  const { budgetMessagesByTokens } = await import('../../packages/agent-core/src/context-budget');
  const messages: LLMMessage[] = [
    { role: 'assistant', content: 'legacy' },
    { role: 'user', content: 'current' },
  ];
  const result = await budgetMessagesByTokens(messages, async () => ({ promptTokens: 80, contextTokens: 100 }), 20);
  expect(result).toEqual({ messages, trimmed: false, promptTokens: 80, contextTokens: 100 });
  expect(result.messages).not.toBe(messages);
});

it.each([0, -1, 1.5, NaN])('rejects invalid context capacity %s', async (contextTokens) => {
  const { budgetMessagesByTokens } = await import('../../packages/agent-core/src/context-budget');
  await expect(budgetMessagesByTokens([], async () => ({ promptTokens: 0, contextTokens }), 0)).rejects.toThrow(
    'Invalid token count',
  );
});
