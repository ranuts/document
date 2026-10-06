/**
 * OpenAI chat-completions format conversion.
 *
 * Shared by the WebLLM provider (in-browser, OpenAI-compatible) and the OpenAI
 * cloud provider. Translates the neutral LLMMessage/LLMToolDef shapes to/from
 * OpenAI's `messages` / `tools` / completion shapes. Pure and unit-testable.
 */
import type { LLMContent, LLMMessage, LLMResponse, LLMToolDef } from './types';

export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}
export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}
export interface OpenAITimings {
  prompt_ms?: number;
  predicted_ms?: number;
  predicted_per_second?: number;
}

export interface OpenAICompletion {
  timings?: OpenAITimings | null;
  usage?: OpenAIUsage | null;
  choices: Array<{
    message: { content?: string | null; tool_calls?: OpenAIToolCall[] };
    finish_reason?: string;
  }>;
}

export interface OpenAIUsage {
  completion_tokens?: number;
  prompt_tokens?: number;
  extra?: { decode_tokens_per_s?: number; time_to_first_token_s?: number };
}

function safeParseArgs(args: string): Record<string, unknown> {
  try {
    return args ? (JSON.parse(args) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Convert neutral tool defs to OpenAI function-tool shape. */
export function toOpenAITools(tools: LLMToolDef[]): Record<string, unknown>[] {
  return tools.map((tool) => ({
    type: 'function',
    function: { name: tool.name, description: tool.description, parameters: tool.inputSchema },
  }));
}

/**
 * Convert neutral messages (+ optional system prompt) to OpenAI chat messages.
 * A falsy `systemPrompt` adds no system message — required for WebLLM's Hermes
 * function calling, which forbids a custom system prompt alongside tools.
 */
export function toOpenAIMessages(messages: LLMMessage[], systemPrompt?: string): OpenAIMessage[] {
  const out: OpenAIMessage[] = systemPrompt ? [{ role: 'system', content: systemPrompt }] : [];
  for (const message of messages) {
    if (typeof message.content === 'string') {
      out.push({ role: message.role, content: message.content });
      continue;
    }
    let text = '';
    const toolCalls: OpenAIToolCall[] = [];
    const toolResults: OpenAIMessage[] = [];
    for (const block of message.content) {
      if (block.type === 'text') {
        text += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          type: 'function',
          function: { name: block.name, arguments: JSON.stringify(block.input) },
        });
      } else if (block.type === 'tool_result') {
        toolResults.push({ role: 'tool', tool_call_id: block.toolUseId, content: block.content });
      }
    }
    if (message.role === 'assistant' && (text || toolCalls.length)) {
      const assistant: OpenAIMessage = { role: 'assistant', content: text || null };
      if (toolCalls.length) assistant.tool_calls = toolCalls;
      out.push(assistant);
    } else if (message.role === 'user' && text) {
      out.push({ role: 'user', content: text });
    }
    out.push(...toolResults);
  }
  return out;
}

/** A streamed chat-completions chunk (OpenAI `stream: true` / WebLLM delta). */
export interface OpenAIStreamChunk {
  timings?: OpenAITimings | null;
  usage?: OpenAIUsage | null;
  choices?: Array<{
    delta?: {
      content?: string | null;
      tool_calls?: Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }>;
    };
    finish_reason?: string | null;
  }>;
}

/**
 * Fold a stream of OpenAI-format chunks into a single {@link OpenAICompletion},
 * emitting each text fragment via `onDelta` as it arrives. Tool-call fragments
 * are reassembled by their `index` (id + name + concatenated argument string).
 * The result is fed back through {@link parseOpenAIResponse}, so streaming and
 * non-streaming share the exact same parse path.
 */
export async function accumulateOpenAIStream(
  chunks: AsyncIterable<OpenAIStreamChunk>,
  onDelta: (textDelta: string) => void,
  signal?: AbortSignal,
  options: { drainOnAbort?: boolean } = {},
): Promise<OpenAICompletion> {
  let content = '';
  let finishReason: string | undefined;
  let usage: OpenAIUsage | undefined;
  let timings: OpenAITimings | undefined;
  const byIndex = new Map<number, { id: string; name: string; args: string }>();
  for await (const chunk of chunks) {
    if (signal?.aborted) {
      // WebLLM's remote generator releases its model lock only after its tail is consumed.
      // Interrupt generation separately, then discard the remaining chunks without displaying them.
      if (options.drainOnAbort) continue;
      break;
    }
    if (chunk.usage) usage = chunk.usage;
    if (chunk.timings) timings = { ...timings, ...chunk.timings };
    const choice = chunk.choices?.[0];
    if (!choice) continue;
    const piece = choice.delta?.content;
    if (piece) {
      content += piece;
      onDelta(piece);
    }
    for (const call of choice.delta?.tool_calls ?? []) {
      const index = call.index ?? 0;
      const acc = byIndex.get(index) ?? { id: '', name: '', args: '' };
      if (call.id) acc.id = call.id;
      if (call.function?.name) acc.name = call.function.name;
      if (call.function?.arguments) acc.args += call.function.arguments;
      byIndex.set(index, acc);
    }
    if (choice.finish_reason) finishReason = choice.finish_reason;
  }
  const tool_calls: OpenAIToolCall[] = [...byIndex.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, c]) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: c.args } }));
  const message: OpenAICompletion['choices'][number]['message'] = { content: content || null };
  if (tool_calls.length) message.tool_calls = tool_calls;
  return {
    choices: [{ message, finish_reason: finishReason ?? 'stop' }],
    ...(usage ? { usage } : {}),
    ...(timings ? { timings } : {}),
  };
}

/** Parse an OpenAI completion into the neutral {@link LLMResponse}. */
export function parseOpenAIResponse(completion: OpenAICompletion): LLMResponse {
  const choice = completion.choices?.[0];
  const message = choice?.message ?? {};
  const text = message.content ?? '';
  const toolCalls = (message.tool_calls ?? []).map((call) => ({
    id: call.id,
    name: call.function.name,
    input: safeParseArgs(call.function.arguments),
  }));
  const assistant: LLMContent[] = [];
  const usage: NonNullable<LLMResponse['usage']> = {};
  const validCount = (value: unknown): value is number =>
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
  const validRate = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0;
  const raw = completion.usage;
  if (validCount(raw?.completion_tokens)) usage.completionTokens = raw.completion_tokens;
  if (validCount(raw?.prompt_tokens)) usage.promptTokens = raw.prompt_tokens;
  if (validRate(raw?.extra?.decode_tokens_per_s)) usage.decodeTokensPerSecond = raw.extra.decode_tokens_per_s;
  if (validRate(raw?.extra?.time_to_first_token_s) && Number.isFinite(raw.extra.time_to_first_token_s * 1000))
    usage.timeToFirstTokenMs = raw.extra.time_to_first_token_s * 1000;
  if (validRate(completion.timings?.prompt_ms)) usage.promptProcessingDurationMs = completion.timings.prompt_ms;
  if (validRate(completion.timings?.predicted_ms)) usage.decodingDurationMs = completion.timings.predicted_ms;
  if (usage.decodeTokensPerSecond === undefined && validRate(completion.timings?.predicted_per_second))
    usage.decodeTokensPerSecond = completion.timings.predicted_per_second;
  if (text) assistant.push({ type: 'text', text });
  for (const call of toolCalls) {
    assistant.push({ type: 'tool_use', id: call.id, name: call.name, input: call.input });
  }
  return {
    ...(Object.keys(usage).length ? { usage } : {}),
    text,
    toolCalls,
    stopReason: choice?.finish_reason ?? 'stop',
    assistant: { role: 'assistant', content: assistant },
  };
}
