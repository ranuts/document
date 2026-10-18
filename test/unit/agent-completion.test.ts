import { expect, it, vi } from 'vitest';
import { runAgent, type AgentEvent } from '@ranuts/agent-core/runtime';
import { parseGeminiResponse } from '@ranuts/agent-core/llm/gemini';
import { parseOpenAIResponse } from '@ranuts/agent-core/llm/openai-format';
import type { LLMMessage, LLMProvider } from '@ranuts/agent-core/llm/types';
import { t } from '@ranuts/shared/i18n';
import { AgentChatController, type ChatTurn } from '../../lib/agent-plugin/ui/controller';
import { RequestQueue } from '../../lib/agent-plugin/ui/request-queue';
import { historyToTurns } from '../../lib/agent-plugin/ui/storage';
import { ChatView } from '../../packages/chat-ui/src/chat-view';

const cases = [
  'length',
  'max_tokens',
  'content_filter',
  'MAX_TOKENS',
  'CONTINUATION',
  'SAFETY',
  'RECITATION',
  'BLOCKLIST',
  'PROHIBITED_CONTENT',
  'SPII',
  'LANGUAGE',
  'IMAGE_SAFETY',
  'IMAGE_PROHIBITED_CONTENT',
  'IMAGE_RECITATION',
  'ESCALATION',
  'PUP_LIMITED_DISABLED',
  'MALFORMED_FUNCTION_CALL',
  'UNEXPECTED_TOOL_CALL',
  'TOO_MANY_TOOL_CALLS',
  'MISSING_THOUGHT_SIGNATURE',
  'MALFORMED_RESPONSE',
  'OTHER',
  'IMAGE_OTHER',
  'NO_IMAGE',
  'FINISH_REASON_UNSPECIFIED',
  'FUTURE_TERMINATION',
] as const;
const expectedReason = (reason: string) =>
  ['length', 'max_tokens', 'MAX_TOKENS', 'CONTINUATION'].includes(reason)
    ? 'max_tokens'
    : [
          'content_filter',
          'SAFETY',
          'RECITATION',
          'BLOCKLIST',
          'PROHIBITED_CONTENT',
          'SPII',
          'LANGUAGE',
          'IMAGE_SAFETY',
          'IMAGE_PROHIBITED_CONTENT',
          'IMAGE_RECITATION',
          'ESCALATION',
          'PUP_LIMITED_DISABLED',
        ].includes(reason)
      ? 'content_filter'
      : 'provider';
function provider(stopReason: string, streaming: boolean, tool = false): LLMProvider {
  const response =
    stopReason === stopReason.toUpperCase()
      ? parseGeminiResponse({
          candidates: [
            {
              finishReason: stopReason,
              content: {
                parts: [
                  { text: 'Partial answer ending mid' },
                  ...(tool ? [{ functionCall: { name: 'write', args: { text: 'Unfinished request' } } }] : []),
                ],
              },
            },
          ],
        })
      : parseOpenAIResponse({
          choices: [
            {
              finish_reason: stopReason,
              message: {
                content: 'Partial answer ending mid',
                ...(tool
                  ? {
                      tool_calls: [
                        {
                          id: 'unfinished',
                          type: 'function' as const,
                          function: { name: 'write', arguments: '{"text":' },
                        },
                      ],
                    }
                  : {}),
              },
            },
          ],
        });
  return {
    name: 'test',
    isReady: () => true,
    chat: async () => response,
    ...(streaming
      ? {
          chatStream: async (_messages: unknown, _tools: unknown, delta: (text: string) => void) => {
            delta(response.text);
            return response;
          },
        }
      : {}),
  };
}

for (const streaming of [false, true]) {
  it.each(cases)(`preserves %s output as incomplete (${streaming ? 'stream' : 'chat'})`, async (reason) => {
    const events: AgentEvent[] = [];
    const result = await runAgent(provider(reason, streaming), 'question', { onEvent: (event) => events.push(event) });
    expect(result).toMatchObject({
      text: 'Partial answer ending mid',
      incompleteReason: expectedReason(reason),
      aborted: false,
    });
    expect(result.messages.at(-1)).toMatchObject({ interrupted: true });
    expect(events).toContainEqual({ type: 'assistant', text: result.text, streamed: streaming, interrupted: true });
  });
  it.each(cases)(
    `never executes incomplete tool arguments on %s (${streaming ? 'stream' : 'chat'})`,
    async (reason) => {
      const execute = vi.fn(async () => ({ changed: true }));
      const result = await runAgent(provider(reason, streaming, true), 'write', {
        tools: { write: { name: 'write', description: 'write', inputSchema: {}, readOnlyHint: false, execute } },
      });
      expect(execute).not.toHaveBeenCalled();
      expect(result.toolCallCount).toBe(0);
      expect(result.messages).toEqual([
        { role: 'user', content: 'write' },
        { role: 'assistant', content: 'Partial answer ending mid', interrupted: true },
      ]);
    },
  );
  it.each(cases)(
    `marks live and restored %s answers incomplete and pauses queued successors (${streaming ? 'stream' : 'chat'})`,
    async (reason) => {
      const turns: ChatTurn[] = [];
      let saved: LLMMessage[] = [];
      const view = new ChatView({ onSend: () => {}, onApplyMessage: async () => 'verified' });
      view.el.querySelector<HTMLElement>('.cui-messages')!.scrollTo = vi.fn();
      view.setRunning(true);
      const controller = new AgentChatController(
        provider(reason, streaming),
        (turn) => {
          turns.push(turn);
          view.append(turn);
        },
        {
          onAgentDelta: (delta) => view.appendDelta(delta),
          onAgentStreamEnd: () => view.endStream(),
          storage: {
            load: () => [],
            save: (messages) => {
              saved = structuredClone(messages);
            },
            clear: () => {},
          },
        },
      );
      const executed: string[] = [];
      const outcomes: string[] = [];
      const queue = new RequestQueue({
        execute: async (entry, accept) => {
          executed.push(entry.text);
          accept();
          const result = await controller.send(entry.text);
          outcomes.push(result.status);
          return result;
        },
        cancel: () => controller.stop(),
        revoke: () => {},
        changed: () => {},
      });
      queue.select('a');
      queue.enqueue('a', 'first', {});
      queue.enqueue('a', 'second', {});
      await vi.waitFor(() => expect(queue.busy).toBe(false));
      expect(outcomes).toEqual(['incomplete']);
      expect(executed).toEqual(['first']);
      expect(queue.state('a')).toMatchObject({ paused: true, entries: [{ text: 'second' }] });
      expect(turns.at(-1)).toEqual({ role: 'status', text: t('agentResponseIncomplete') });
      expect(historyToTurns(saved)).toContainEqual({
        role: 'agent',
        text: 'Partial answer ending mid',
        interrupted: true,
      });
      expect(view.getLastAnswer()).toBe('');
      expect(view.el.querySelector('[data-interrupted]')?.textContent).toContain('Partial answer ending mid');
      expect(view.el.querySelector('.cui-apply')).toBeNull();
      view.dispose();
    },
  );
}
