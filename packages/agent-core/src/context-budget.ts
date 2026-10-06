import type { LLMMessage } from './llm/types';

/** A conservative UTF-8 byte budget, not an exact model-token count. */
export const DEFAULT_CONTEXT_BYTES = 6144;
export function budgetMessages(messages: LLMMessage[], maxBytes = DEFAULT_CONTEXT_BYTES): LLMMessage[] {
  if (!Number.isInteger(maxBytes) || maxBytes < 1) throw new Error('Invalid context budget');
  const encoder = new TextEncoder();
  const size = (message: LLMMessage) =>
    encoder.encode(JSON.stringify({ role: message.role, content: message.content })).byteLength + 16;
  if (messages.reduce((total, message) => total + size(message), 0) <= maxBytes) return [...messages];
  // Tool results use the user role but do not start a fresh user turn.
  const starts = messages.flatMap((message, index) =>
    message.role === 'user' &&
    (typeof message.content === 'string' || !message.content.some((block) => block.type === 'tool_result'))
      ? [index]
      : [],
  );
  const start = starts.at(-1) ?? 0;
  let bytes = messages.slice(start).reduce((total, message) => total + size(message), 0);
  if (bytes > maxBytes) throw new Error('agentContextTooLong');
  let first = start;
  for (let turn = starts.length - 2; turn >= 0; turn--) {
    const next = starts[turn];
    const extra = messages.slice(next, first).reduce((total, message) => total + size(message), 0);
    if (bytes + extra > maxBytes) break;
    bytes += extra;
    first = next;
  }
  return messages.slice(first);
}

/** Count the complete provider request, including its system prompt and template. */
export async function budgetMessagesByTokens(
  messages: LLMMessage[],
  count: (messages: LLMMessage[]) => Promise<{ promptTokens: number; contextTokens: number }>,
  reservedTokens: number,
  signal?: AbortSignal,
): Promise<{ messages: LLMMessage[]; trimmed: boolean; promptTokens: number; contextTokens: number }> {
  if (!Number.isSafeInteger(reservedTokens) || reservedTokens < 0) throw new Error('Invalid token reservation');
  const starts = messages.flatMap((message, index) =>
    message.role === 'user' &&
    (typeof message.content === 'string' || !message.content.some((block) => block.type === 'tool_result'))
      ? [index]
      : [],
  );
  let first = 0;
  for (;;) {
    signal?.throwIfAborted();
    const candidate = messages.slice(first);
    const { promptTokens, contextTokens } = await count(candidate);
    signal?.throwIfAborted();
    if (
      !Number.isSafeInteger(promptTokens) ||
      promptTokens < 0 ||
      !Number.isSafeInteger(contextTokens) ||
      contextTokens < 1
    ) {
      throw new Error('Invalid token count');
    }
    if (promptTokens <= contextTokens - reservedTokens) {
      return { messages: candidate, trimmed: first > 0, promptTokens, contextTokens };
    }
    const next = starts.find((start) => start > first);
    if (next === undefined) throw new Error('agentContextTooLong');
    first = next;
  }
}
