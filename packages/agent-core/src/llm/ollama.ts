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
import { fetchProviderJson, type ProviderHttpOptions } from './provider-http';
import type { LLMMessage, LLMProvider, LLMResponse, LLMToolDef } from './types';

const DEFAULT_MODEL = 'llama3.2';
const DEFAULT_BASE_URL = 'http://localhost:11434/v1';

export interface OllamaProviderOptions extends ProviderHttpOptions {
  /** Optional — only needed for a remote/proxied Ollama that requires auth. */
  ollamaApiKey?: string;
  ollamaModel?: string;
  systemPrompt?: string;
  ollamaBaseURL?: string;
}

export class OllamaProvider implements LLMProvider {
  readonly toolCallingMode = 'native' as const;
  readonly name = 'ollama';
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly systemPrompt: string;
  private readonly baseURL: string;
  private readonly requestOptions: ProviderHttpOptions;

  constructor(options: OllamaProviderOptions = {}) {
    this.apiKey = options.ollamaApiKey ?? getApiKey('ollama');
    this.model = options.ollamaModel ?? DEFAULT_MODEL;
    this.systemPrompt = options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
    this.baseURL = options.ollamaBaseURL ?? DEFAULT_BASE_URL;
    this.requestOptions = {
      fetchImpl: options.fetchImpl,
      timeoutMs: options.timeoutMs,
      maxResponseBytes: options.maxResponseBytes,
    };
  }

  /** Local server: ready without a key (the optional key is only for remote auth). */
  isReady(): boolean {
    return true;
  }

  async chat(messages: LLMMessage[], tools: LLMToolDef[], signal?: AbortSignal): Promise<LLMResponse> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }
    const completion = await fetchProviderJson<OpenAICompletion>(
      'Ollama',
      `${this.baseURL}/chat/completions`,
      {
        method: 'POST',
        ...(signal ? { signal } : {}),
        headers,
        body: JSON.stringify({
          model: this.model,
          messages: toOpenAIMessages(messages, this.systemPrompt),
          ...(tools.length ? { tools: toOpenAITools(tools), tool_choice: 'auto' } : {}),
        }),
      },
      this.requestOptions,
    );
    return parseOpenAIResponse(completion);
  }
}
