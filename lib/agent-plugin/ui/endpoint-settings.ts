import {
  CLOUD_ENDPOINT_KINDS,
  type WritingEndpoint,
  type WritingEndpointKind,
  validateWritingEndpoint,
} from '@ranuts/agent-core/llm/endpoint';
import type { WritingRoutePreference } from '@ranuts/agent-core/llm/writing-route';

/**
 * Where the assistant sends a writing request.
 *
 * Two destinations keep the document on this machine -- the in-page engines and
 * a loopback service the user runs -- and the cloud kinds do not. Only the
 * destination description is persisted here; an API key goes to its own origin
 * slot (see `setEndpointKey`) and never into this record.
 */
export const ENDPOINT_SETTINGS_VERSION = 1;
export const ENDPOINT_SETTINGS_KEY = 'agent-writing-endpoint';

export interface EndpointSettings {
  kind: WritingEndpointKind;
  /** Loopback origin or OpenAI-compatible API base; unused by the vendor kinds. */
  baseUrl: string;
  model: string;
  preference: WritingRoutePreference;
  /** Explicit opt-in to the experimental browser-local writing route. */
  localWritingConsent: boolean;
}

const EMPTY: EndpointSettings = {
  kind: 'loopback',
  baseUrl: '',
  model: '',
  preference: 'device-first',
  localWritingConsent: false,
};

export function isCloudEndpointKind(kind: WritingEndpointKind): boolean {
  return CLOUD_ENDPOINT_KINDS.includes(kind);
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** Unknown or malformed fields fall back to defaults rather than half-configuring an endpoint. */
export function readEndpointSettings(raw: string | null): EndpointSettings {
  try {
    const value = record(JSON.parse(raw ?? '{}'));
    if (value.version !== ENDPOINT_SETTINGS_VERSION) return { ...EMPTY };
    const kind = ['loopback', ...CLOUD_ENDPOINT_KINDS].includes(value.kind as WritingEndpointKind)
      ? (value.kind as WritingEndpointKind)
      : EMPTY.kind;
    return {
      kind,
      baseUrl: typeof value.baseUrl === 'string' ? value.baseUrl.trim() : '',
      model: typeof value.model === 'string' ? value.model.trim() : '',
      preference: value.preference === 'remote-first' ? 'remote-first' : 'device-first',
      localWritingConsent: value.localWritingConsent === true,
    };
  } catch {
    return { ...EMPTY };
  }
}

/** Throws on an invalid combination so a bad endpoint is never persisted. */
export function writeEndpointSettings(settings: EndpointSettings): string {
  if (!['loopback', ...CLOUD_ENDPOINT_KINDS].includes(settings.kind)) throw new Error('Unsupported writing endpoint');
  const baseUrl = settings.baseUrl.trim();
  if (baseUrl || settings.kind === 'openai-compatible' || settings.kind === 'loopback') {
    // Validate now: a stored origin must be one the route would accept.
    validateWritingEndpoint({
      kind: settings.kind,
      baseUrl: settings.kind === 'anthropic' || settings.kind === 'gemini' ? '' : baseUrl,
      model: settings.model.trim() || 'placeholder',
    });
  }
  return JSON.stringify({
    version: ENDPOINT_SETTINGS_VERSION,
    kind: settings.kind,
    baseUrl,
    model: settings.model.trim(),
    preference: settings.preference === 'remote-first' ? 'remote-first' : 'device-first',
    localWritingConsent: settings.localWritingConsent === true,
  });
}

/** The endpoint as configured, or null while it is incomplete or invalid. */
export function configuredEndpoint(settings: EndpointSettings): WritingEndpoint | null {
  if (!settings.model.trim()) return null;
  if (settings.kind === 'openai-compatible' && !settings.baseUrl.trim()) return null;
  try {
    return validateWritingEndpoint({
      kind: settings.kind,
      baseUrl: settings.kind === 'anthropic' || settings.kind === 'gemini' ? '' : settings.baseUrl,
      model: settings.model,
    });
  } catch {
    return null;
  }
}
