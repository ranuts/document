/**
 * Provider factory + default selection.
 *
 * Constructs providers by id. Local mode is the default; cloud is opt-in.
 */
import { AnthropicProvider, type AnthropicProviderOptions } from './anthropic';
import { OpenAIProvider, type OpenAIProviderOptions } from './openai';
import { OllamaProvider, type OllamaProviderOptions } from './ollama';
import { GeminiProvider, type GeminiProviderOptions } from './gemini';
import type { LLMProvider } from './types';
import { WllamaProvider, type WllamaProviderOptions } from './wllama';
import { WebLLMProvider, type WebLLMProviderOptions } from './webllm';

export type ProviderId = 'anthropic' | 'openai' | 'webllm' | 'ollama' | 'gemini' | 'wllama';

export type ProviderOptions = AnthropicProviderOptions &
  OpenAIProviderOptions &
  OllamaProviderOptions &
  GeminiProviderOptions &
  WebLLMProviderOptions &
  WllamaProviderOptions;

export function createProvider(id: ProviderId, options: ProviderOptions = {}): LLMProvider {
  switch (id) {
    case 'wllama':
      return new WllamaProvider(options);
    case 'webllm':
      return new WebLLMProvider(options);
    case 'openai':
      return new OpenAIProvider(options);
    case 'ollama':
      return new OllamaProvider(options);
    case 'gemini':
      return new GeminiProvider(options);
    default:
      return new AnthropicProvider(options);
  }
}

/** Local first; unsupported devices get an explanation, not an implicit cloud request. */
export function defaultProviderId(): ProviderId {
  return 'webllm';
}
