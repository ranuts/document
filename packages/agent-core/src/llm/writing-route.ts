import type { TaskModelBinding } from './task-model';

/**
 * Which provider serves the free-text writing route (rewrite / summarize / translate).
 *
 * The browser-local engines (WebLLM, wllama) never reached seven-language factual
 * writing acceptance: the recorded evaluations show changed dates and names, dropped
 * actors and reversed negations across every candidate. Writing into a document is
 * high-stakes, so a browser-local engine is no longer the silent default. It takes an
 * explicit opt-in, and the route reports itself as experimental when it is used.
 *
 * A connected loopback service (native Ollama on the user's own machine) keeps the
 * same "files never leave the device" property while running a model large enough to
 * be useful, so it wins whenever it is configured.
 */
export interface WritingRouteInput {
  /** The connected loopback service binding, or null/absent when none is connected. */
  loopback?: TaskModelBinding | null;
  /** Explicit opt-in to the experimental browser-local writing route. */
  localWritingConsent: boolean;
  /** The browser-local binding to fall back to when consent is given. */
  local: TaskModelBinding;
}
export type WritingRoute =
  | { kind: 'loopback'; binding: TaskModelBinding; experimental: false }
  | { kind: 'local'; binding: TaskModelBinding; experimental: true }
  | { kind: 'blocked'; reason: 'local-writing-disabled' };

export function resolveWritingRoute(input: WritingRouteInput): WritingRoute {
  const loopback = input.loopback;
  if (loopback) {
    if (loopback.backend !== 'loopback' || !loopback.model.trim()) throw new Error('Invalid loopback writing binding');
    return { kind: 'loopback', binding: { backend: 'loopback', model: loopback.model }, experimental: false };
  }
  if (!input.localWritingConsent) return { kind: 'blocked', reason: 'local-writing-disabled' };
  if (!['webllm', 'wllama'].includes(input.local.backend) || !input.local.model.trim())
    throw new Error('Invalid browser-local writing binding');
  return { kind: 'local', binding: { backend: input.local.backend, model: input.local.model }, experimental: true };
}
