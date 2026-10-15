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

/** Count the complete provider request, including its system prompt and template.
 * Exponential bracketing and refinement reduce native calls. Counts need not be
 * monotonic: return the most context among measured fits, never an inferred fit
 * or a promise of the globally longest suffix. Every overflow checks the latest turn.
 */
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
  const boundaries = [0, ...starts.filter((start) => start > 0)];
  type Measurement = { messages: LLMMessage[]; trimmed: boolean; promptTokens: number; contextTokens: number };
  const measured = new Map<number, Measurement>();
  const best: { index: number; value?: Measurement } = { index: Infinity };
  const measure = async (index: number): Promise<boolean> => {
    signal?.throwIfAborted();
    const cached = measured.get(index);
    if (cached) return cached.promptTokens <= cached.contextTokens - reservedTokens;
    const first = boundaries[index];
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
    const value = { messages: candidate, trimmed: first > 0, promptTokens, contextTokens };
    measured.set(index, value);
    const fits = promptTokens <= contextTokens - reservedTokens;
    if (fits && index < best.index) {
      best.index = index;
      best.value = value;
    }
    return fits;
  };
  if (await measure(0)) {
    signal?.throwIfAborted();
    return best.value!;
  }
  const latest = boundaries.length - 1;
  let lower = 0;
  let upper = Math.min(1, latest);
  while (upper > lower) {
    if (await measure(upper)) break;
    lower = upper;
    upper = Math.min(latest, upper * 2);
  }
  if (!best.value) {
    // This exact check also covers assistant-only histories with no turn boundary.
    if (await measure(latest)) {
      signal?.throwIfAborted();
      return best.value!;
    }
    signal?.throwIfAborted();
    throw new Error('agentContextTooLong');
  }
  while (upper - lower > 1) {
    const middle = Math.floor((lower + upper) / 2);
    if (await measure(middle)) upper = middle;
    else lower = middle;
  }
  signal?.throwIfAborted();
  return best.value;
}
