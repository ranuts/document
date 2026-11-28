import { AnthropicProvider } from './anthropic';
import { GEMINI_DEFAULT_BASE_URL, GeminiProvider } from './gemini';
import { LoopbackProvider, validateLoopbackUrl } from './loopback';
import { OpenAIProvider } from './openai';
import { fetchProviderJson, type ProviderHttpOptions } from './provider-http';
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

/** Validate where an endpoint lives, independent of which model it will run. */
function validateEndpointAddress(kind: WritingEndpointKind, baseUrl: string): string {
  if (kind === 'loopback') return validateLoopbackUrl(baseUrl.trim() || DEFAULT_LOOPBACK_ENDPOINT);
  if (!CLOUD_ENDPOINT_KINDS.includes(kind)) throw new Error('Unsupported writing endpoint');
  if (kind === 'openai-compatible' && !baseUrl.trim())
    throw new Error('An OpenAI-compatible endpoint requires a base URL');
  return baseUrl.trim() ? validateRemoteEndpointUrl(baseUrl) : '';
}

/** Normalise and validate an endpoint; invalid input throws rather than silently falling back. */
export function validateWritingEndpoint(endpoint: WritingEndpoint): WritingEndpoint {
  const model = endpoint.model.trim();
  if (!model) throw new Error('A writing endpoint requires a model name');
  return { kind: endpoint.kind, baseUrl: validateEndpointAddress(endpoint.kind, endpoint.baseUrl), model };
}

const ANTHROPIC_MODELS_URL = 'https://api.anthropic.com/v1/models';

/** Model names an endpoint reports. Uses the same address rules and key as a connection; never persists anything. */
export async function listEndpointModels(
  endpoint: Pick<WritingEndpoint, 'kind' | 'baseUrl'>,
  apiKey?: string,
  options: ProviderHttpOptions & { signal?: AbortSignal } = {},
): Promise<string[]> {
  const base = validateEndpointAddress(endpoint.kind, endpoint.baseUrl);
  const { signal, ...http } = options;
  const request = (url: string, headers: Record<string, string>) =>
    fetchProviderJson<unknown>(
      'Model list',
      url,
      { credentials: 'omit', redirect: 'error', signal, headers },
      {
        timeoutMs: 30_000,
        ...http,
      },
    );
  const names = (items: unknown, field: string): string[] =>
    Array.isArray(items)
      ? items
          .map((item) => (item && typeof item === 'object' ? (item as Record<string, unknown>)[field] : undefined))
          .filter((name): name is string => typeof name === 'string' && name.trim() !== '')
      : [];
  let models: string[];
  switch (endpoint.kind) {
    case 'loopback':
      models = names(((await request(base + '/api/tags', {})) as { models?: unknown } | null)?.models, 'name');
      break;
    case 'openai-compatible':
      models = names(
        (
          (await request(base + '/models', apiKey ? { Authorization: `Bearer ${apiKey}` } : {})) as {
            data?: unknown;
          } | null
        )?.data,
        'id',
      );
      break;
    case 'anthropic':
      models = names(
        (
          (await request(ANTHROPIC_MODELS_URL + '?limit=1000', {
            'x-api-key': apiKey ?? '',
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          })) as { data?: unknown } | null
        )?.data,
        'id',
      );
      break;
    default: {
      const result = (await request(`${base || GEMINI_DEFAULT_BASE_URL}/models?pageSize=1000`, {
        'x-goog-api-key': apiKey ?? '',
      })) as { models?: Array<{ name?: unknown; supportedGenerationMethods?: unknown }> } | null;
      // Embedding and other non-chat models cannot answer a writing request.
      const chat = (result?.models ?? []).filter(
        (model) =>
          !Array.isArray(model?.supportedGenerationMethods) ||
          model.supportedGenerationMethods.includes('generateContent'),
      );
      models = names(chat, 'name').map((name) => name.replace(/^models\//, ''));
    }
  }
  return [...new Set(models)].sort((a, b) => a.localeCompare(b));
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
