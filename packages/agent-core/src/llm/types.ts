/**
 * Provider-agnostic LLM types.
 *
 * The agent runtime talks to LLMs through {@link LLMProvider}, never to a vendor
 * SDK directly. Messages and tools use a neutral shape (close to Anthropic's
 * block model) that each provider translates to/from its own format, so the same
 * runtime and tool definitions drive Anthropic, a cloud OpenAI-compatible API, or
 * an offline WebLLM engine without change.
 */

/** A tool the model may call — mirrors AgentTool's schema-facing fields. */
export interface LLMToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/** A content block within a message. */
export type LLMContent =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; toolUseId: string; content: string; isError?: boolean };

/** A conversation message. `content` is plain text or a list of blocks. */
export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string | LLMContent[];
  /** Visible partial prose preserved after cancellation; never a complete answer. */
  interrupted?: true;
  /** Host-created document body; never inferred from generic assistant prose. */
  documentArtifact?: true;
}

/** A tool call the model requested. */
export interface LLMToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/** A normalised model response. */
export interface LLMResponse {
  /** Provider removed complete old turns to fit the measured context. */
  contextTrimmed?: boolean;
  /** Actual backend statistics, absent when unsupported; never estimated from chunks. */
  usage?: {
    /** Backend-measured prompt processing and decoding durations, when available. */
    promptProcessingDurationMs?: number;
    decodingDurationMs?: number;
    completionTokens?: number;
    promptTokens?: number;
    decodeTokensPerSecond?: number;
    timeToFirstTokenMs?: number;
    /** Provider wall clock from execution start, excluding queue/model load. */
    responseDurationMs?: number;
    /** First nonempty text delta; distinct from the backend's first token time. */
    timeToFirstTextMs?: number;
    /** Actual completion token count divided by total response time, including prefill. */
    endToEndTokensPerSecond?: number;
  };
  /** Concatenated assistant text (may be empty when the turn is only tool calls). */
  text: string;
  /** Tool calls the model wants executed (empty when none). */
  toolCalls: LLMToolCall[];
  /** Why generation stopped, e.g. "end_turn" | "tool_use" | "max_tokens". */
  stopReason: string;
  /** The assistant message to append to history before the next turn. */
  assistant: LLMMessage;
}

/** A pluggable LLM backend. Implementations are stateless across `chat` calls. */
export interface LLMProvider {
  /** Stable provider id, e.g. "anthropic". */
  readonly name: string;
  /** True when the provider can make a request (e.g. an API key is present). */
  isReady(): boolean;
  /** Native tool protocol supported by this transport; not a model-quality certification. */
  readonly toolCallingMode?: 'native' | 'schema';
  /** True when the ready engine budgets the complete request using actual tokens. */
  hasExactContextBudget?(): boolean;
  /**
   * Run one model turn over the conversation with the given tools available.
   * `signal` (optional) aborts the in-flight request so Stop works mid-call.
   */
  /** Optional schema-constrained, tool-free generation for bounded tasks. */
  generateJSON?(messages: LLMMessage[], schema: Record<string, unknown>, signal?: AbortSignal): Promise<LLMResponse>;
  chat(messages: LLMMessage[], tools: LLMToolDef[], signal?: AbortSignal): Promise<LLMResponse>;
  /**
   * Optional streaming variant: emit assistant text deltas via `onDelta` as they
   * arrive, then resolve with the same full {@link LLMResponse} as {@link chat}.
   * Providers that omit it transparently fall back to `chat` in the runtime.
   * `signal` (optional) aborts the in-flight stream.
   */
  chatStream?(
    messages: LLMMessage[],
    tools: LLMToolDef[],
    onDelta: (textDelta: string) => void,
    signal?: AbortSignal,
  ): Promise<LLMResponse>;
}

/** Explicit lifecycle shared by browser-local inference backends. */
export interface LocalLLMProvider extends LLMProvider {
  /** Adjust future requests without reloading model weights. */
  setGenerationOptions?(options: import('./generation').GenerationOptions): void;
  /** Load weights/runtime only when the host requests it. */
  preload(): Promise<void>;
  /** Abort work and release runtime resources. */
  dispose(): Promise<void>;
}
