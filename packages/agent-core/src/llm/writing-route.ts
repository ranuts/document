import { type WritingEndpoint, validateWritingEndpoint, writingEndpointDataPath } from './endpoint';

/** The in-page engines. They never passed writing quality acceptance. */
export type BrowserLocalBackend = 'webllm' | 'wllama';
export interface BrowserLocalBinding {
  backend: BrowserLocalBackend;
  model: string;
}

/**
 * Which destination wins when both a loopback service and a cloud endpoint are
 * connected. The user picks this; it is never inferred from what happens to be
 * loaded, and the host reports the destination that was actually chosen.
 */
export type WritingRoutePreference = 'device-first' | 'remote-first';

/**
 * Which provider serves the free-text writing route (rewrite / summarize / translate).
 *
 * The browser-local engines (WebLLM, wllama) never reached seven-language factual
 * writing acceptance: the recorded evaluations show changed dates and names, dropped
 * actors and reversed negations across every candidate. Writing into a document is
 * high-stakes, so a browser-local engine is no longer the silent default. It takes an
 * explicit opt-in, and the route reports itself as experimental when it is used.
 *
 * A loopback service keeps the `device` data path while running a model large enough
 * to be useful. A cloud endpoint is the user's own key and their explicit choice, and
 * reports `remote` so the host can say where the selected text went.
 */
export interface WritingRouteInput {
  /** A connected loopback service, which keeps the selected text on this machine. */
  loopback?: WritingEndpoint | null;
  /** A connected cloud endpoint, which sends the selected text to a third party. */
  remote?: WritingEndpoint | null;
  preference: WritingRoutePreference;
  /** Explicit opt-in to the experimental browser-local writing route. */
  localWritingConsent: boolean;
  /** The browser-local binding to fall back to when consent is given. */
  local: BrowserLocalBinding;
}
export type WritingRoute =
  | { kind: 'endpoint'; endpoint: WritingEndpoint; dataPath: 'device' | 'remote'; experimental: false }
  | { kind: 'local'; binding: BrowserLocalBinding; dataPath: 'device'; experimental: true }
  | { kind: 'blocked'; reason: 'local-writing-disabled' };

export function resolveWritingRoute(input: WritingRouteInput): WritingRoute {
  const loopback = input.loopback ? validateWritingEndpoint(input.loopback) : null;
  const remote = input.remote ? validateWritingEndpoint(input.remote) : null;
  if (loopback && loopback.kind !== 'loopback') throw new Error('Invalid loopback writing endpoint');
  if (remote && remote.kind === 'loopback') throw new Error('Invalid remote writing endpoint');
  const preferred = input.preference === 'remote-first' ? [remote, loopback] : [loopback, remote];
  const chosen = preferred.find((endpoint): endpoint is WritingEndpoint => endpoint !== null);
  if (chosen)
    return {
      kind: 'endpoint',
      endpoint: chosen,
      dataPath: writingEndpointDataPath(chosen),
      experimental: false,
    };
  if (!input.localWritingConsent) return { kind: 'blocked', reason: 'local-writing-disabled' };
  const binding = input.local;
  if (!['webllm', 'wllama'].includes(binding.backend) || !binding.model.trim())
    throw new Error('Invalid browser-local writing binding');
  return {
    kind: 'local',
    binding: { backend: binding.backend, model: binding.model.trim() },
    dataPath: 'device',
    experimental: true,
  };
}
