import { AnthropicProvider } from './anthropic';
import { GeminiProvider } from './gemini';
import { LoopbackProvider, validateLoopbackUrl } from './loopback';
import { OpenAIProvider } from './openai';
import type { LLMProvider } from './types';

/**
 * Where a writing request is actually sent.
 *
 * `loopback` runs on the user's own machine and keeps the file on the device.
 * The cloud kinds send the selected text to a third party using the user's own
 * key. {@link writingEndpointDataPath} reports which of the two applies, so the
 * host can state the destination instead of implying every route is private.
 */
export type WritingEndpointKind = 'loopback' | 'openai-compatible' | 'anthropic' | 'gemini';
export interface WritingEndpoint {
  kind: WritingEndpointKind;
  /** Loopback origin, or the OpenAI-compatible API base. Empty for a vendor default. */
  baseUrl: string;
  model: string;
}
export const CLOUD_ENDPOINT_KINDS: readonly WritingEndpointKind[] = ['openai-compatible', 'anthropic', 'gemini'];
export const DEFAULT_LOOPBACK_ENDPOINT = 'http://localhost:11434';

/**
 * A remote endpoint must be HTTPS. Plain HTTP to anything but loopback puts the
 * API key and the selected document text on the wire in clear text, and a URL
 * carrying credentials would smuggle a secret past the key field.
 */
export function validateRemoteEndpointUrl(value: string): string {
  const url = new URL(value.trim());
  if (url.protocol !== 'https:') throw new Error('A remote endpoint must use https');
  if (url.username || url.password || url.search || url.hash)
    throw new Error('A remote endpoint must not carry credentials, a query or a fragment');
  return url.origin + url.pathname.replace(/\/+$/, '');
}

/** Normalise and validate an endpoint; invalid input throws rather than silently falling back. */
export function validateWritingEndpoint(endpoint: WritingEndpoint): WritingEndpoint {
  const model = endpoint.model.trim();
  if (!model) throw new Error('A writing endpoint requires a model name');
  if (endpoint.kind === 'loopback')
    return {
      kind: 'loopback',
      baseUrl: validateLoopbackUrl(endpoint.baseUrl.trim() || DEFAULT_LOOPBACK_ENDPOINT),
      model,
    };
  if (!CLOUD_ENDPOINT_KINDS.includes(endpoint.kind)) throw new Error('Unsupported writing endpoint');
  if (endpoint.kind === 'openai-compatible' && !endpoint.baseUrl.trim())
    throw new Error('An OpenAI-compatible endpoint requires a base URL');
  return {
    kind: endpoint.kind,
    baseUrl: endpoint.baseUrl.trim() ? validateRemoteEndpointUrl(endpoint.baseUrl) : '',
    model,
  };
}

/** `device` keeps the document on this machine; `remote` sends the selection to a third party. */
export function writingEndpointDataPath(endpoint: WritingEndpoint): 'device' | 'remote' {
  return endpoint.kind === 'loopback' ? 'device' : 'remote';
}

/** Build the provider for an endpoint. The key is only ever used by the cloud kinds. */
export function createEndpointProvider(endpoint: WritingEndpoint, apiKey?: string): LLMProvider {
  const validated = validateWritingEndpoint(endpoint);
  switch (validated.kind) {
    case 'loopback':
      return new LoopbackProvider({ model: validated.model, baseUrl: validated.baseUrl });
    case 'openai-compatible':
      return new OpenAIProvider({ model: validated.model, baseURL: validated.baseUrl, apiKey });
    case 'anthropic':
      return new AnthropicProvider({ model: validated.model, apiKey });
    default:
      return new GeminiProvider({
        geminiModel: validated.model,
        apiKey,
        ...(validated.baseUrl ? { geminiBaseURL: validated.baseUrl } : {}),
      });
  }
}
