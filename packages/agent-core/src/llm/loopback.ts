import type { LLMMessage, LLMResponse, LLMToolDef, LocalLLMProvider } from './types';

export function validateLoopbackUrl(value: string): string {
  const url = new URL(value);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  )
    throw new Error('Invalid loopback service origin');
  return url.origin;
}
export interface LoopbackProviderOptions {
  model: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: (url: string, init: RequestInit) => Promise<Response>;
}
/** Explicit opt-in native service. Never downloads models or follows redirects. */
export class LoopbackProvider implements LocalLLMProvider {
  readonly name = 'loopback';
  private readonly origin: string;
  private readonly lifetime = new AbortController();
  private ready = false;
  private loading?: Promise<void>;
  constructor(private readonly options: LoopbackProviderOptions) {
    this.origin = validateLoopbackUrl(options.baseUrl ?? 'http://localhost:11434');
    if (!options.model.trim()) throw new Error('A local model name is required');
  }
  isReady(): boolean {
    return this.ready && !this.lifetime.signal.aborted;
  }
  preload(): Promise<void> {
    if (this.lifetime.signal.aborted) return Promise.reject(this.lifetime.signal.reason);
    if (this.isReady()) return Promise.resolve();
    return (this.loading ??= this.check().finally(() => {
      this.loading = undefined;
    }));
  }
  private async request(path: string, body?: object, signal?: AbortSignal): Promise<unknown> {
    const timeout = AbortSignal.timeout(this.options.timeoutMs ?? 300000);
    const combined = AbortSignal.any([this.lifetime.signal, timeout, ...(signal ? [signal] : [])]);
    combined.throwIfAborted();
    const response = await (this.options.fetchImpl ?? fetch)(this.origin + '/api/' + path, {
      method: body ? 'POST' : 'GET',
      credentials: 'omit',
      redirect: 'error',
      signal: combined,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    combined.throwIfAborted();
    if (!response.ok) throw new Error('Local service request failed');
    const result: unknown = await response.json();
    combined.throwIfAborted();
    return result;
  }
  private async check(): Promise<void> {
    const result = (await this.request('tags')) as { models?: Array<{ name?: string }> } | null;
    if (!Array.isArray(result?.models) || !result.models.some((model) => model?.name === this.options.model))
      throw new Error('Local model is not installed');
    this.lifetime.signal.throwIfAborted();
    this.ready = true;
  }
  async dispose(): Promise<void> {
    this.ready = false;
    this.lifetime.abort(new DOMException('Local service disconnected', 'AbortError'));
  }
  chat(messages: LLMMessage[], tools: LLMToolDef[], signal?: AbortSignal): Promise<LLMResponse> {
    if (tools.length) return Promise.reject(new Error('Local service cannot execute editor tools'));
    return this.generate(messages, undefined, signal);
  }
  generateJSON(messages: LLMMessage[], schema: Record<string, unknown>, signal?: AbortSignal): Promise<LLMResponse> {
    return this.generate(messages, schema, signal);
  }
  private async generate(
    messages: LLMMessage[],
    schema?: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<LLMResponse> {
    if (!this.isReady()) throw new Error('Connect the local model first');
    // Translate completed host tool exchanges to Ollama's documented chat history.
    const names = new Map<string, string>();
    const nativeMessages: Array<Record<string, unknown>> = [];
    for (const message of messages) {
      if (typeof message.content === 'string') {
        nativeMessages.push({ role: message.role, content: message.content });
        continue;
      }
      const text = message.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n');
      const calls = message.content.filter((block) => block.type === 'tool_use');
      if (calls.length) {
        for (const call of calls) names.set(call.id, call.name);
        nativeMessages.push({
          role: 'assistant',
          content: text,
          tool_calls: calls.map((call, index) => ({
            type: 'function',
            function: { index, name: call.name, arguments: call.input },
          })),
        });
      } else if (text) nativeMessages.push({ role: message.role, content: text });
      for (const block of message.content) {
        if (block.type !== 'tool_result') continue;
        const name = names.get(block.toolUseId);
        if (!name) throw new Error('Unmatched local service tool result');
        nativeMessages.push({ role: 'tool', tool_name: name, content: block.content });
      }
    }
    const result = (await this.request(
      'chat',
      {
        model: this.options.model,
        messages: nativeMessages,
        stream: false,
        ...(schema ? { format: schema } : {}),
      },
      signal,
    )) as {
      done?: boolean;
      done_reason?: string;
      message?: { content?: string; tool_calls?: unknown[] };
      error?: unknown;
    } | null;
    if (
      result?.error ||
      result?.done !== true ||
      typeof result.message?.content !== 'string' ||
      result.message.tool_calls?.length
    )
      throw new Error('Incomplete local service response');
    return {
      text: result.message.content,
      toolCalls: [],
      stopReason: result.done_reason ?? 'stop',
      assistant: { role: 'assistant', content: result.message.content },
    };
  }
}
