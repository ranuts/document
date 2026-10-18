/**
 * Shared types for the agent tool layer.
 *
 * Tools are transport-agnostic: each wraps an editor capability behind a typed
 * `execute` + a JSON Schema, so the same definitions can be bound to WebLLM,
 * a cloud LLM (OpenAI tool-use format), or an MCP server without change.
 */

/** A JSON-Schema-shaped object describing a tool's parameters. */
export type JsonSchema = Record<string, unknown>;

export interface AgentTool<P = Record<string, unknown>, R = unknown> {
  /** Stable machine name, e.g. `insert_text`. */
  name: string;
  /** Natural-language description shown to the LLM. */
  description: string;
  /** JSON Schema for the tool's input parameters. */
  inputSchema: JsonSchema;
  /**
   * True when the tool does not modify the document (a getter). Lets the runtime
   * skip review-mode wrapping and surfaces intent to the model.
   */
  readOnlyHint: boolean;
  /** Host policy evaluated after execution. A boolean retains the successful-result policy. */
  concludesTurn?: boolean | ((result: { content: string; isError: boolean }) => boolean);
  /** Optional structured excerpt policy. The runtime supplies the exact serialized
   * result budget; tools without this capability are never truncated. */
  fitResult?: {
    /** Smallest valid result, with the same scope and explicit partial-read flags. */
    minimum(result: unknown): unknown;
    fit(result: unknown, fits: (candidate: unknown) => boolean): unknown;
  };
  /** Execute the tool. Throws on invalid input or when the editor isn't ready. */
  execute: (params: P, signal?: AbortSignal) => Promise<R>;
}
