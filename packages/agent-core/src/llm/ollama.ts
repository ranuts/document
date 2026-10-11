/**
 * Ollama local LLM provider.
 *
 * Ollama exposes an OpenAI-compatible chat-completions endpoint on
 * `http://localhost:11434/v1`, so this reuses the shared OpenAI-format
 * converters wholesale — the only differences from {@link OpenAIProvider} are:
 * it runs against a local server, needs no API key (ready as soon as a model is
 * configured), and defaults to a small local model. A key is still accepted for
 * remote/proxied Ollama deployments that require auth.
 */
import { type OpenAICompletion, parseOpenAIResponse, toOpenAIMessages, toOpenAITools } from './openai-format';
import { getApiKey } from './keys';
import { DEFAULT_SYSTEM_PROMPT } from './prompt';
import type { LLMMessage, LLMProvider, LLMResponse, LLMToolDef } from './types';

const DEFAULT_MODEL = 'llama3.2';
const DEFAULT_BASE_URL = 'http://localhost:11434/v1';

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface OllamaProviderOptions {
  /** Optional — only needed for a remote/proxied Ollama that requires auth. */
  ollamaApiKey?: string;
  ollamaModel?: string;
  systemPrompt?: string;
  ollamaBaseURL?: string;
  /** Inject a fetch implementation (tests). */
  fetchImpl?: FetchLike;
}

export class OllamaProvider implements LLMProvider {
  readonly toolCallingMode = 'native' as const;
  readonly name = 'ollama';
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly systemPrompt: string;
  private readonly baseURL: string;
  private readonly fetchImpl?: FetchLike;

  constructor(options: OllamaProviderOptions = {}) {
    this.apiKey = options.ollamaApiKey ?? getApiKey('ollama');
    this.model = options.ollamaModel ?? DEFAULT_MODEL;
    this.systemPrompt = options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
    this.baseURL = options.ollamaBaseURL ?? DEFAULT_BASE_URL;
    this.fetchImpl = options.fetchImpl;
  }

  /** Local server: ready without a key (the optional key is only for remote auth). */
  isReady(): boolean {
    return true;
  }

  async chat(messages: LLMMessage[], tools: LLMToolDef[]): Promise<LLMResponse> {
    const doFetch = this.fetchImpl ?? (globalThis.fetch.bind(globalThis) as FetchLike);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }
    const response = await doFetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.model,
        messages: toOpenAIMessages(messages, this.systemPrompt),
        tools: toOpenAITools(tools),
        tool_choice: 'auto',
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Ollama request failed: ${response.status} ${detail}`.trim());
    }
    const completion = (await response.json()) as OpenAICompletion;
    return parseOpenAIResponse(completion);
  }
}
