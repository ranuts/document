/**
 * OpenAI cloud LLM provider — browser Direct Mode.
 *
 * Calls the OpenAI chat-completions endpoint directly from the browser with a
 * key from localStorage (never through a server of ours). Reuses the shared
 * OpenAI-format converters. Uses fetch (injectable) rather than a vendor SDK to
 * avoid another dependency; the request shape is small and stable.
 */
import { type OpenAICompletion, parseOpenAIResponse, toOpenAIMessages, toOpenAITools } from './openai-format';
import { getApiKey } from './keys';
import { DEFAULT_SYSTEM_PROMPT } from './prompt';
import type { LLMMessage, LLMProvider, LLMResponse, LLMToolDef } from './types';

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface OpenAIProviderOptions {
  apiKey?: string;
  model?: string;
  systemPrompt?: string;
  baseURL?: string;
  /** Inject a fetch implementation (tests). */
  fetchImpl?: FetchLike;
}

export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai';
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly systemPrompt: string;
  private readonly baseURL: string;
  private readonly fetchImpl?: FetchLike;

  constructor(options: OpenAIProviderOptions = {}) {
    this.apiKey = options.apiKey ?? getApiKey('openai');
    this.model = options.model ?? DEFAULT_MODEL;
    this.systemPrompt = options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
    this.baseURL = (options.baseURL ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.fetchImpl = options.fetchImpl;
  }

  isReady(): boolean {
    return !!this.apiKey;
  }

  async chat(messages: LLMMessage[], tools: LLMToolDef[], signal?: AbortSignal): Promise<LLMResponse> {
    signal?.throwIfAborted();
    if (!this.apiKey) {
      throw new Error('OpenAI API key is not configured');
    }
    const doFetch = this.fetchImpl ?? (globalThis.fetch.bind(globalThis) as FetchLike);
    const response = await doFetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      ...(signal ? { signal } : {}),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        messages: toOpenAIMessages(messages, this.systemPrompt),
        tools: toOpenAITools(tools),
        tool_choice: 'auto',
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`OpenAI request failed: ${response.status} ${detail}`.trim());
    }
    const completion = (await response.json()) as OpenAICompletion;
    signal?.throwIfAborted();
    return parseOpenAIResponse(completion);
  }
}
