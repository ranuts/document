import { type OpenAICompletion, type OpenAIStreamChunk, parseOpenAIResponse, openAIReasoning } from './openai-format';
import { assertStreamRecord, fetchProviderStream } from './provider-stream';
import type { ProviderHttpOptions } from './provider-http';
import type { LLMResponse } from './types';

/** Tool-free OpenAI-compatible answers; tool-bearing calls use complete JSON. */
export async function fetchOpenAIStream(
  provider: string,
  url: string,
  init: RequestInit,
  options: ProviderHttpOptions,
  onDelta: (text: string) => void,
  onReasoningDelta?: (text: string) => void,
): Promise<LLMResponse> {
  let text = '';
  let finish: string | undefined;
  let usage: OpenAICompletion['usage'];
  let fallback: LLMResponse | undefined;
  await fetchProviderStream(
    provider,
    url,
    init,
    options,
    'sse',
    (value) => {
      if (value === '[DONE]') {
        if (!finish) throw new Error(`Incomplete ${provider} stream`);
        return false;
      }
      assertStreamRecord(provider, value);
      const chunk = value as OpenAIStreamChunk;
      const choice = chunk.choices?.[0];
      if (choice?.delta?.tool_calls?.length || choice?.finish_reason === 'tool_calls')
        throw new Error(`Unexpected ${provider} tool response`);
      if (chunk.usage) usage = chunk.usage;
      const reasoning = openAIReasoning(choice?.delta);
      if (reasoning && !finish) onReasoningDelta?.(reasoning);
      init.signal?.throwIfAborted();
      if (choice?.delta?.content) {
        if (finish || typeof choice.delta.content !== 'string') throw new Error(`Invalid ${provider} stream`);
        text += choice.delta.content;
        onDelta(choice.delta.content);
      }
      if (choice?.finish_reason) finish = choice.finish_reason;
    },
    (value) => {
      assertStreamRecord(provider, value);
      const completion = value as unknown as OpenAICompletion;
      fallback = parseOpenAIResponse(completion);
      if (fallback.toolCalls.length) throw new Error(`Unexpected ${provider} tool response`);
      const reasoning = openAIReasoning(completion.choices?.[0]?.message);
      if (reasoning) onReasoningDelta?.(reasoning);
      init.signal?.throwIfAborted();
      if (fallback.text) onDelta(fallback.text);
    },
  );
  if (fallback) return fallback;
  if (!finish) throw new Error(`Incomplete ${provider} stream`);
  return parseOpenAIResponse({
    choices: [{ message: { content: text }, finish_reason: finish }],
    ...(usage ? { usage } : {}),
  });
}
