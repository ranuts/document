/**
 * OpenAI cloud LLM provider — browser Direct Mode.
 *
 * Calls the OpenAI chat-completions endpoint directly from the browser with a
 * key from localStorage (never through a server of ours). Reuses the shared
 * OpenAI-format converters. Uses fetch (injectable) rather than a vendor SDK to
 * avoid another dependency; the request shape is small and stable.
 */
import {
  type OpenAICompletion,
  parseOpenAIResponse,
  openAIReasoning,
  toOpenAIMessages,
  toOpenAITools,
} from './openai-format';
import { fetchOpenAIStream } from './openai-stream';
import { getApiKey } from './keys';
import { DEFAULT_SYSTEM_PROMPT } from './prompt';
import { fetchProviderJson, type ProviderHttpOptions } from './provider-http';
import type { LLMMessage, LLMProvider, LLMResponse, LLMToolDef } from './types';

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

export interface OpenAIProviderOptions extends ProviderHttpOptions {
  apiKey?: string;
  model?: string;
  systemPrompt?: string;
  baseURL?: string;
}

export class OpenAIProvider implements LLMProvider {
  readonly toolCallingMode = 'native' as const;
  readonly name = 'openai';
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly systemPrompt: string;
  private readonly baseURL: string;
  private readonly requestOptions: ProviderHttpOptions;

  constructor(options: OpenAIProviderOptions = {}) {
    this.apiKey = options.apiKey ?? getApiKey('openai');
    this.model = options.model ?? DEFAULT_MODEL;
    this.systemPrompt = options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
    this.baseURL = (options.baseURL ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.requestOptions = {
      fetchImpl: options.fetchImpl,
      timeoutMs: options.timeoutMs,
      maxResponseBytes: options.maxResponseBytes,
    };
  }

  isReady(): boolean {
    return !!this.apiKey;
  }

  async chatStream(
    messages: LLMMessage[],
    tools: LLMToolDef[],
    onDelta: (text: string) => void,
    signal?: AbortSignal,
    onReasoningDelta?: (text: string) => void,
  ): Promise<LLMResponse> {
    if (tools.length) return this.request(messages, tools, signal, onReasoningDelta);
    signal?.throwIfAborted();
    if (!this.apiKey) throw new Error('OpenAI API key is not configured');
    return fetchOpenAIStream(
      'OpenAI',
      `${this.baseURL}/chat/completions`,
      {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          model: this.model,
          messages: toOpenAIMessages(messages, this.systemPrompt),
          stream: true,
          stream_options: { include_usage: true },
        }),
      },
      this.requestOptions,
      onDelta,
      onReasoningDelta,
    );
  }

  chat(messages: LLMMessage[], tools: LLMToolDef[], signal?: AbortSignal): Promise<LLMResponse> {
    return this.request(messages, tools, signal);
  }

  private async request(
    messages: LLMMessage[],
    tools: LLMToolDef[],
    signal?: AbortSignal,
    onReasoningDelta?: (text: string) => void,
  ): Promise<LLMResponse> {
    signal?.throwIfAborted();
    if (!this.apiKey) {
      throw new Error('OpenAI API key is not configured');
    }
    const completion = await fetchProviderJson<OpenAICompletion>(
      'OpenAI',
      `${this.baseURL}/chat/completions`,
      {
        method: 'POST',
        ...(signal ? { signal } : {}),
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          model: this.model,
          messages: toOpenAIMessages(messages, this.systemPrompt),
          ...(tools.length ? { tools: toOpenAITools(tools), tool_choice: 'auto' } : {}),
        }),
      },
      this.requestOptions,
    );
    signal?.throwIfAborted();
    const reasoning = openAIReasoning(completion.choices?.[0]?.message);
    if (reasoning) onReasoningDelta?.(reasoning);
    signal?.throwIfAborted();
    return parseOpenAIResponse(completion);
  }
}
