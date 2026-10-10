import { validateLoopbackUrl } from '@ranuts/agent-core/llm/loopback';
import type { TaskModelBinding } from '@ranuts/agent-core/llm/task-model';

/**
 * Settings for a native model service the user runs on their own machine
 * (Ollama by default). The page only ever talks to a loopback origin, so the
 * "files never leave the device" property still holds while the model runs at a
 * size the browser cannot host.
 *
 * Nothing here is a credential: a loopback origin is rejected if it carries
 * user info or query data, and only the origin and a model name are persisted.
 */
export const DEFAULT_LOOPBACK_URL = 'http://localhost:11434';
export const LOOPBACK_SETTINGS_VERSION = 1;

export interface LoopbackSettings {
  /** Validated loopback origin, or '' when no service is configured. */
  url: string;
  /** Model the service must already have installed; never downloaded by us. */
  model: string;
  /** Explicit opt-in to the experimental browser-local writing route. */
  localWritingConsent: boolean;
}

const EMPTY: LoopbackSettings = { url: '', model: '', localWritingConsent: false };

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** Invalid origins are dropped on read rather than surfaced as a half-configured service. */
export function readLoopbackSettings(raw: string | null): LoopbackSettings {
  try {
    const value = record(JSON.parse(raw ?? '{}'));
    if (value.version !== LOOPBACK_SETTINGS_VERSION) return { ...EMPTY };
    let url = '';
    if (typeof value.url === 'string' && value.url.trim()) {
      try {
        url = validateLoopbackUrl(value.url.trim());
      } catch {
        url = '';
      }
    }
    return {
      url,
      model: typeof value.model === 'string' ? value.model.trim() : '',
      localWritingConsent: value.localWritingConsent === true,
    };
  } catch {
    return { ...EMPTY };
  }
}

export function writeLoopbackSettings(settings: LoopbackSettings): string {
  const url = settings.url.trim() ? validateLoopbackUrl(settings.url.trim()) : '';
  return JSON.stringify({
    version: LOOPBACK_SETTINGS_VERSION,
    url,
    model: settings.model.trim(),
    localWritingConsent: settings.localWritingConsent === true,
  });
}

/** The writing route's loopback binding, or null while the service is not fully configured. */
export function loopbackBinding(settings: LoopbackSettings): TaskModelBinding | null {
  if (!settings.url.trim() || !settings.model.trim()) return null;
  return { backend: 'loopback', model: settings.model.trim() };
}
