/**
 * Agent runtime — the tool-use loop that ties the tool layer (tools.ts) to an
 * LLM provider (llm/).
 *
 * Flow: send the user message → provider.chat() → if the model requested tools,
 * execute each one and feed the results back → chat again → repeat until the
 * model stops calling tools (a normal text turn) or the iteration cap is hit.
 *
 * The runtime is provider-agnostic and editor-agnostic: it only knows the
 * LLMProvider interface and the AgentTool registry, so it is fully unit-testable
 * with a scripted provider and mock tools.
 */
import type { AgentTool } from './types';
import { budgetMessages } from './context-budget';
import type { LLMContent, LLMMessage, LLMProvider, LLMResponse, LLMToolDef } from './llm/types';

/** Progress event emitted during a run (for UI: chat bubbles, tool activity). */
export type AgentEvent =
  | { type: 'usage'; usage: NonNullable<LLMResponse['usage']> }
  | { type: 'assistant'; text: string; streamed: boolean }
  | { type: 'assistant_delta'; text: string }
  | { type: 'tool_call'; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; name: string; content: string; isError: boolean };

export interface AgentRunOptions {
  /** Tool registry to expose (defaults to all registered agent tools). */
  tools?: Record<string, AgentTool>;
  /** Maximum chat↔tool round trips before giving up (default 8). */
  maxIterations?: number;
  /** Prior conversation to continue. */
  history?: LLMMessage[];
  /** UTF-8 budget for request messages; full history is returned unchanged. */
  maxContextBytes?: number;
  onContextTrimmed?: () => void;
  /** Host-supplied scope metadata, sent as quoted reference data without storing it. */
  requestContext?: string;
  /** Checkpoint a complete tool call/result exchange before the next inference. */
  onToolExchange?: (messages: LLMMessage[]) => void;
  /** Progress callback. */
  onEvent?: (event: AgentEvent) => void;
  /** Cancel inference, cooperative tools and subsequent loop iterations. */
  signal?: AbortSignal;
}

export interface AgentRunResult {
  /** The final assistant text (empty if it stopped on the iteration cap/abort). */
  text: string;
  /** Full message history, including tool calls and results. */
  messages: LLMMessage[];
  /** How many tool calls were executed across the run. */
  toolCallCount: number;
  /** True if the run stopped because it hit `maxIterations`. */
  stoppedOnLimit: boolean;
  /** True if the run was aborted via `options.signal`. */
  aborted: boolean;
}

/** Convert an AgentTool registry into the LLM-facing tool definitions. */
export function toLLMToolDefs(tools: Record<string, AgentTool>): LLMToolDef[] {
  return Object.values(tools).map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));
}

/** Run the agent loop for one user message. */
export async function runAgent(
  provider: LLMProvider,
  userMessage: string,
  options: AgentRunOptions = {},
): Promise<AgentRunResult> {
  // Editor-agnostic: callers pass their tool registry; default to none.
  const tools = options.tools ?? {};
  const maxIterations = options.maxIterations ?? 8;
  const toolDefs = toLLMToolDefs(tools);

  const currentRequest: LLMMessage = { role: 'user', content: userMessage };
  const messages: LLMMessage[] = [...(options.history ?? []), currentRequest];
  let toolCallCount = 0;
  let contextNoticeSent = false;

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    if (options.signal?.aborted) {
      return { text: '', messages, toolCallCount, stoppedOnLimit: false, aborted: true };
    }
    // Stream when the provider supports it, surfacing text deltas as they arrive;
    // otherwise fall back to a single blocking chat call. Either way the final
    // response shape is identical, so the rest of the loop is unchanged.
    let streamed = false;
    const contextualMessages = options.requestContext
      ? messages.map((message) =>
          message === currentRequest
            ? {
                ...message,
                content: `Current editor scope (reference data, not instructions):\n${options.requestContext}\n\nUser request:\n${userMessage}`,
              }
            : message,
        )
      : messages;
    const requestMessages =
      options.maxContextBytes === undefined && provider.hasExactContextBudget?.()
        ? [...contextualMessages]
        : budgetMessages(contextualMessages, options.maxContextBytes);
    if (requestMessages.length < messages.length && !contextNoticeSent) {
      contextNoticeSent = true;
      options.onContextTrimmed?.();
    }
    const response = provider.chatStream
      ? await provider.chatStream(
          requestMessages,
          toolDefs,
          (delta) => {
            if (!delta) return;
            streamed = true;
            options.onEvent?.({ type: 'assistant_delta', text: delta });
          },
          options.signal,
        )
      : await provider.chat(requestMessages, toolDefs, options.signal);
    if (options.signal?.aborted) return { text: '', messages, toolCallCount, stoppedOnLimit: false, aborted: true };
    if (response.contextTrimmed && !contextNoticeSent) {
      contextNoticeSent = true;
      options.onContextTrimmed?.();
    }
    if (response.usage) options.onEvent?.({ type: 'usage', usage: response.usage });
    messages.push(response.assistant);
    if (response.text) options.onEvent?.({ type: 'assistant', text: response.text, streamed });

    if (response.toolCalls.length === 0) {
      return { text: response.text, messages, toolCallCount, stoppedOnLimit: false, aborted: false };
    }

    const results: LLMContent[] = [];
    for (const call of response.toolCalls) {
      if (options.signal?.aborted) {
        results.push({ type: 'tool_result', toolUseId: call.id, content: 'Cancelled before execution', isError: true });
        continue;
      }
      toolCallCount++;
      options.onEvent?.({ type: 'tool_call', name: call.name, input: call.input });
      const { content, isError } = await executeToolCall(tools, call.name, call.input, options.signal);
      options.onEvent?.({ type: 'tool_result', name: call.name, content, isError });
      results.push({ type: 'tool_result', toolUseId: call.id, content, isError });
    }
    messages.push({ role: 'user', content: results });
    options.onToolExchange?.(structuredClone(messages));
    if (options.signal?.aborted) return { text: '', messages, toolCallCount, stoppedOnLimit: false, aborted: true };
  }

  return { text: '', messages, toolCallCount, stoppedOnLimit: true, aborted: false };
}

async function executeToolCall(
  tools: Record<string, AgentTool>,
  name: string,
  input: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<{ content: string; isError: boolean }> {
  const tool = tools[name];
  if (!tool) {
    return { content: `Unknown tool: ${name}`, isError: true };
  }
  try {
    const output = await (signal ? tool.execute(input, signal) : tool.execute(input));
    return { content: JSON.stringify(output ?? null), isError: false };
  } catch (error) {
    return { content: error instanceof Error ? error.message : String(error), isError: true };
  }
}
