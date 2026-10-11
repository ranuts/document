import { describe, expect, it, vi } from 'vitest';
import type { LLMProvider, LLMResponse } from '@ranuts/agent-core/llm/types';
import { generateReadAnswer } from '../../lib/agent-plugin/document-read-answer';

const response = (text: string): LLMResponse => ({
  text,
  toolCalls: [],
  stopReason: 'stop',
  assistant: { role: 'assistant', content: text },
});
describe('grounded document read answers', () => {
  it.each(['word', 'cell', 'slide', 'pdf'] as const)(
    'answers the original question from %s tool receipts without enabling writes',
    async (kind) => {
      const chat = vi.fn(async () => response('120'));
      const provider: LLMProvider = { name: 'test', isReady: () => true, chat };
      const exchange = [
        { role: 'assistant' as const, content: [{ type: 'tool_use' as const, id: 'read-1', name: 'read', input: {} }] },
        {
          role: 'user' as const,
          content: [{ type: 'tool_result' as const, toolUseId: 'read-1', content: '{"text":"Budget is 120"}' }],
        },
      ];
      expect(
        await generateReadAnswer(
          provider,
          'What is the budget? Only the amount.',
          { kind, page: 1 },
          exchange,
          new AbortController().signal,
        ),
      ).toBe('120');
      const [messages, tools] = chat.mock.calls[0] as unknown as [unknown[], unknown[]];
      expect(tools).toEqual([]);
      expect(JSON.stringify(messages)).toContain('What is the budget? Only the amount.');
      expect(JSON.stringify(messages)).toContain('Budget is 120');
      expect(JSON.stringify(messages)).toContain(kind);
      expect(messages.slice(-2)).toEqual(exchange);
    },
  );
  it('does not publish a response after Stop even when the provider ignores abort', async () => {
    const abort = new AbortController();
    const provider: LLMProvider = {
      name: 'test',
      isReady: () => true,
      chat: async () => {
        abort.abort();
        return response('120');
      },
    };
    await expect(generateReadAnswer(provider, 'Budget?', { kind: 'pdf' }, [], abort.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
  it.each(['', 'partial'])('rejects empty or truncated completion %s', async (text) => {
    const provider: LLMProvider = {
      name: 'test',
      isReady: () => true,
      chat: async () => ({ ...response(text), stopReason: text ? 'max_tokens' : 'stop' }),
    };
    await expect(
      generateReadAnswer(provider, 'Budget?', { kind: 'word' }, [], new AbortController().signal),
    ).rejects.toThrow();
  });
  it('rejects tool calls without executing them', async () => {
    const provider: LLMProvider = {
      name: 'test',
      isReady: () => true,
      chat: async () => ({ ...response('Done'), toolCalls: [{ id: 'write', name: 'clear_document', input: {} }] }),
    };
    await expect(
      generateReadAnswer(provider, 'Budget?', { kind: 'word' }, [], new AbortController().signal),
    ).rejects.toThrow();
  });
});
