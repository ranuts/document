/**
 * Anthropic (Claude) LLM provider — browser Direct Mode.
 *
 * Uses the official @anthropic-ai/sdk. The request goes straight from the browser
 * to the Anthropic API (`dangerouslyAllowBrowser: true`); the API key is read from
 * localStorage and never passes through any server of ours.
 *
 * The neutral LLMMessage/LLMToolDef shapes map almost 1:1 to Anthropic's block
 * model, so the translation here is thin. Conversion helpers are exported and
 * pure so they can be unit-tested without a live client.
 */
import Anthropic from '@anthropic-ai/sdk';
import { getApiKey } from './keys';
import { DEFAULT_SYSTEM_PROMPT } from './prompt';
import type { LLMContent, LLMMessage, LLMProvider, LLMResponse, LLMToolDef } from './types';

const DEFAULT_MODEL = 'claude-opus-4-8';
const DEFAULT_MAX_TOKENS = 16000;

interface AnthropicTextBlock {
  type: 'text';
  text: string;
}
interface AnthropicToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}
type AnthropicBlock =
  | AnthropicTextBlock
  | AnthropicToolUseBlock
  | Anthropic.ThinkingBlock
  | Anthropic.RedactedThinkingBlock
  | { type: string };

interface AnthropicResponse {
  content: AnthropicBlock[];
  stop_reason: string | null;
}

/** A streaming handle from `messages.stream()` (the bits this provider uses). */
export interface AnthropicStream {
  on(event: 'text' | 'thinking', listener: (textDelta: string) => void): unknown;
  finalMessage(): Promise<AnthropicResponse>;
  /** Optional SDK lifecycle methods; minimal injected clients need not implement them. */
  abort?(): void;
  off?(event: 'text' | 'thinking', listener: (textDelta: string) => void): unknown;
}

/** The slice of the Anthropic client this provider uses (eases test mocking). */
export interface AnthropicLike {
  messages: {
    create(body: Record<string, unknown>, options?: { signal?: AbortSignal }): Promise<AnthropicResponse>;
    stream?(body: Record<string, unknown>, options?: { signal?: AbortSignal }): AnthropicStream;
  };
}

/** Convert a neutral tool definition to Anthropic's `{name, description, input_schema}`. */
export function toAnthropicTool(tool: LLMToolDef): Record<string, unknown> {
  return { name: tool.name, description: tool.description, input_schema: tool.inputSchema };
}

/** Convert a neutral message to an Anthropic message param. */
export function toAnthropicMessage(message: LLMMessage): Record<string, unknown> {
  if (typeof message.content === 'string') {
    return { role: message.role, content: message.content };
  }
  const content = message.content.map((block) => {
    switch (block.type) {
      case 'text':
        return { type: 'text', text: block.text };
      case 'tool_use':
        return { type: 'tool_use', id: block.id, name: block.name, input: block.input };
      case 'tool_result':
        return {
          type: 'tool_result',
          tool_use_id: block.toolUseId,
          content: block.content,
          is_error: block.isError ?? false,
        };
    }
  });
  return { role: message.role, content };
}

/** Parse an Anthropic response into the neutral {@link LLMResponse}. */
export function parseAnthropicResponse(response: AnthropicResponse): LLMResponse {
  let text = '';
  const toolCalls: LLMResponse['toolCalls'] = [];
  const assistant: LLMContent[] = [];
  for (const block of response.content ?? []) {
    if (block.type === 'text') {
      const { text: t } = block as AnthropicTextBlock;
      text += t;
      assistant.push({ type: 'text', text: t });
    } else if (block.type === 'tool_use') {
      const { id, name, input } = block as AnthropicToolUseBlock;
      toolCalls.push({ id, name, input });
      assistant.push({ type: 'tool_use', id, name, input });
    }
  }
  return {
    text,
    toolCalls,
    stopReason: response.stop_reason ?? 'end_turn',
    assistant: { role: 'assistant', content: assistant },
  };
}

export interface AnthropicProviderOptions {
  apiKey?: string;
  model?: string;
  systemPrompt?: string;
  maxTokens?: number;
  /** Total request deadline, including SDK response consumption. Defaults to five minutes. */
  timeoutMs?: number;
  /** Inject a client (tests); otherwise one is built lazily from the API key. */
  client?: AnthropicLike;
}

export class AnthropicProvider implements LLMProvider {
  readonly toolCallingMode = 'native' as const;
  readonly name = 'anthropic';
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly systemPrompt: string;
  private readonly maxTokens: number;
  private readonly timeoutMs: number;
  private client?: AnthropicLike;

  constructor(options: AnthropicProviderOptions = {}) {
    this.apiKey = options.apiKey ?? getApiKey('anthropic');
    this.model = options.model ?? DEFAULT_MODEL;
    this.systemPrompt = options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
    this.maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.timeoutMs = options.timeoutMs ?? 300_000;
    this.client = options.client;
  }

  isReady(): boolean {
    return !!this.client || !!this.apiKey;
  }

  private getClient(): AnthropicLike {
    if (this.client) return this.client;
    if (!this.apiKey) {
      throw new Error('Anthropic API key is not configured');
    }
    this.client = new Anthropic({ apiKey: this.apiKey, dangerouslyAllowBrowser: true }) as unknown as AnthropicLike;
    return this.client;
  }

  private requestBody(messages: LLMMessage[], tools: LLMToolDef[]): Record<string, unknown> {
    return {
      model: this.model,
      max_tokens: this.maxTokens,
      system: this.systemPrompt,
      tools: tools.map(toAnthropicTool),
      messages: messages.map(toAnthropicMessage),
    };
  }

  private async request(
    messages: LLMMessage[],
    tools: LLMToolDef[],
    owner?: AbortSignal,
    onDelta?: (textDelta: string) => void,
    onReasoningDelta?: (text: string) => void,
  ): Promise<LLMResponse> {
    owner?.throwIfAborted();
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0 || this.timeoutMs > 2_147_483_647)
      throw new RangeError('Provider timeout must be a positive timer duration');
    const controller = new AbortController();
    const forwardAbort = () => controller.abort(owner?.reason);
    owner?.addEventListener('abort', forwardAbort, { once: true });
    let stream: AnthropicStream | undefined;
    let streamStopped = false;
    let active = true;
    const stopStream = () => {
      if (!stream || streamStopped) return;
      streamStopped = true;
      // Host clients may throw during cleanup; retain the initiating failure.
      try {
        stream.abort?.();
      } catch {}
    };
    let onAbort: () => void = () => {};
    const aborted = new Promise<never>((_resolve, reject) => {
      onAbort = () => {
        stopStream();
        reject(controller.signal.reason);
      };
      controller.signal.addEventListener('abort', onAbort, { once: true });
    });
    const timer = setTimeout(
      () => controller.abort(new DOMException('AI request timed out', 'TimeoutError')),
      this.timeoutMs,
    );
    let reasoningObserved = false;
    const reasoningListener = (delta: string) => {
      if (!active || controller.signal.aborted || !delta) return;
      try {
        reasoningObserved = true;
        onReasoningDelta?.(delta);
      } catch (error) {
        controller.abort(error);
      }
    };
    const listener = (delta: string) => {
      if (!active || controller.signal.aborted) return;
      try {
        onDelta!(delta);
      } catch (error) {
        controller.abort(error);
      }
    };
    try {
      const pending = (async () => {
        const client = this.getClient();
        const body = this.requestBody(messages, tools);
        if (!onDelta || !client.messages.stream) return client.messages.create(body, { signal: controller.signal });
        // The SDK's own timeout covers headers, not finalMessage() consumption.
        stream = client.messages.stream(body, { signal: controller.signal });
        if (controller.signal.aborted) stopStream();
        controller.signal.throwIfAborted();
        // Observe rejection before attaching callbacks: minimal host clients may
        // emit synchronously, and callbacks can stop or throw reentrantly.
        const final = stream.finalMessage();
        if (onReasoningDelta) stream.on('thinking', reasoningListener);
        stream.on('text', listener);
        return final;
      })();
      const response = await Promise.race([pending, aborted]);
      controller.signal.throwIfAborted();
      if (!reasoningObserved && onReasoningDelta) {
        for (const block of response.content ?? []) {
          if (block.type !== 'thinking') continue;
          const thinking = (block as { type: string; thinking?: unknown }).thinking;
          if (typeof thinking === 'string' && thinking) reasoningListener(thinking);
        }
      }
      controller.signal.throwIfAborted();
      return parseAnthropicResponse(response);
    } catch (error) {
      if (!controller.signal.aborted) controller.abort(error);
      throw controller.signal.reason;
    } finally {
      active = false;
      clearTimeout(timer);
      owner?.removeEventListener('abort', forwardAbort);
      controller.signal.removeEventListener('abort', onAbort);
      try {
        stream?.off?.('text', listener);
        if (onReasoningDelta) stream?.off?.('thinking', reasoningListener);
      } catch {}
    }
  }

  async chat(messages: LLMMessage[], tools: LLMToolDef[], signal?: AbortSignal): Promise<LLMResponse> {
    return this.request(messages, tools, signal);
  }

  async chatStream(
    messages: LLMMessage[],
    tools: LLMToolDef[],
    onDelta: (textDelta: string) => void,
    signal?: AbortSignal,
    onReasoningDelta?: (text: string) => void,
  ): Promise<LLMResponse> {
    return this.request(messages, tools, signal, onDelta, onReasoningDelta);
  }
}
