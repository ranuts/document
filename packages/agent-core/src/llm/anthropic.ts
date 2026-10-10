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
type AnthropicBlock = AnthropicTextBlock | AnthropicToolUseBlock | { type: string };

interface AnthropicResponse {
  content: AnthropicBlock[];
  stop_reason: string | null;
}

/** A streaming handle from `messages.stream()` (the bits this provider uses). */
export interface AnthropicStream {
  on(event: 'text', listener: (textDelta: string) => void): unknown;
  finalMessage(): Promise<AnthropicResponse>;
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
  /** Inject a client (tests); otherwise one is built lazily from the API key. */
  client?: AnthropicLike;
}

export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly systemPrompt: string;
  private readonly maxTokens: number;
  private client?: AnthropicLike;

  constructor(options: AnthropicProviderOptions = {}) {
    this.apiKey = options.apiKey ?? getApiKey('anthropic');
    this.model = options.model ?? DEFAULT_MODEL;
    this.systemPrompt = options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
    this.maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
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

  async chat(messages: LLMMessage[], tools: LLMToolDef[], signal?: AbortSignal): Promise<LLMResponse> {
    signal?.throwIfAborted();
    const response = await this.getClient()
      .messages.create(this.requestBody(messages, tools), signal ? { signal } : undefined)
      .catch((error: unknown) => {
        signal?.throwIfAborted();
        throw error;
      });
    signal?.throwIfAborted();
    return parseAnthropicResponse(response);
  }

  async chatStream(
    messages: LLMMessage[],
    tools: LLMToolDef[],
    onDelta: (textDelta: string) => void,
    signal?: AbortSignal,
  ): Promise<LLMResponse> {
    signal?.throwIfAborted();
    const client = this.getClient();
    // The SDK's messages.stream() emits incremental "text" events and resolves
    // the full message via finalMessage(), which parses exactly like create().
    if (!client.messages.stream) {
      return this.chat(messages, tools, signal);
    }
    const stream = client.messages.stream(this.requestBody(messages, tools), signal ? { signal } : undefined);
    stream.on('text', (delta) => {
      if (!signal?.aborted) onDelta(delta);
    });
    const response = await stream.finalMessage().catch((error: unknown) => {
      signal?.throwIfAborted();
      throw error;
    });
    signal?.throwIfAborted();
    return parseAnthropicResponse(response);
  }
}
