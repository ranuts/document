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
  /** Execute the tool. Throws on invalid input or when the editor isn't ready. */
  execute: (params: P, signal?: AbortSignal) => Promise<R>;
}
