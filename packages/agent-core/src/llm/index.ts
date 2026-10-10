/**
 * LLM provider layer — public API.
 *
 * Editor-agnostic and provider-agnostic: neutral message/tool/response shapes
 * ({@link LLMProvider}) with concrete providers behind a factory. This layer has
 * zero dependency on the OnlyOffice editor, so it can be reused on its own.
 */
export type {
  LLMContent,
  LLMMessage,
  LLMProvider,
  LocalLLMProvider,
  LLMResponse,
  LLMToolCall,
  LLMToolDef,
} from './types';
export { createProvider, defaultProviderId, type ProviderId, type ProviderOptions } from './factory';
export { getApiKey, setApiKey, getEndpointKey, setEndpointKey, clearEndpointKey } from './keys';
export { DEFAULT_SYSTEM_PROMPT } from './prompt';
export {
  DEFAULT_WEBLLM_MODEL,
  isModelCached,
  isWebGPUAvailable,
  WEBLLM_MODELS,
  WebLLMProvider,
  type WebLLMProviderOptions,
} from './webllm';
export { AnthropicProvider, type AnthropicProviderOptions } from './anthropic';
export { OpenAIProvider, type OpenAIProviderOptions } from './openai';
export { OllamaProvider, type OllamaProviderOptions } from './ollama';
export { LoopbackProvider, validateLoopbackUrl, type LoopbackProviderOptions } from './loopback';
export { GeminiProvider, type GeminiProviderOptions } from './gemini';

export { WllamaProvider, type WllamaProviderOptions } from './wllama';
export { normalizeGenerationOptions, type GenerationOptions, type GenerationSettings } from './generation';
export { LocalInferenceProvider, detectGPUAdapter, DEFAULT_CPU_MODEL_URL, type LocalInferenceOptions } from './local';
export {
  resolveTaskModel,
  type ModelTask,
  type TaskModelBinding,
  type TaskModelRequest,
  type TaskModelPreferences,
  type ResolvedTaskModel,
} from './task-model';
export { resolveWritingRoute, type WritingRoute, type WritingRouteInput } from './writing-route';
export {
  CLOUD_ENDPOINT_KINDS,
  DEFAULT_LOOPBACK_ENDPOINT,
  createEndpointProvider,
  validateRemoteEndpointUrl,
  validateWritingEndpoint,
  writingEndpointDataPath,
  type WritingEndpoint,
  type WritingEndpointKind,
} from './endpoint';
export { deleteCachedModel } from './model-cache';
