/**
 * Service-worker update policy.
 *
 * Each deploy ships a sw.js with a fresh CACHE_VERSION. The new worker
 * installs and then WAITS (sw.js no longer calls skipWaiting() on install):
 * activating it deletes the previous build's caches, and a page that keeps
 * running the old build with a document open would from then on lazy-load
 * pieces of the new build (sdk-all.js, x2t.wasm.gz, fonts) into an old
 * session -- a mixed-version editor. So the page promotes a waiting worker
 * only when no document is open, and reloads once it takes control.
 */

export type SwLike = {
  state: string;
  postMessage: (msg: unknown) => unknown;
  addEventListener: (t: 'statechange', cb: () => void) => void;
};
export type RegistrationLike = {
  waiting: SwLike | null;
  installing: SwLike | null;
  addEventListener: (t: 'updatefound', cb: () => void) => void;
};

export const SKIP_WAITING_MESSAGE = { type: 'SKIP_WAITING' } as const;

/** Tell a waiting worker to take over -- only if nothing is open. Returns whether it did. */
export function promoteWaitingWorker(reg: RegistrationLike, hasOpenDocument: () => boolean): boolean {
  if (!reg.waiting || hasOpenDocument()) return false;
  reg.waiting.postMessage(SKIP_WAITING_MESSAGE);
  return true;
}

/**
 * Wire a registration: promote an already-waiting worker now, and promote
 * future ones as soon as they finish installing (both gated on "no document
 * open"). A worker that stays waiting because a document is open activates on
 * the next visit, when the landing page calls this again.
 */
export function wireServiceWorkerUpdates(reg: RegistrationLike, hasOpenDocument: () => boolean): void {
  promoteWaitingWorker(reg, hasOpenDocument);
  reg.addEventListener('updatefound', () => {
    const installing = reg.installing;
    if (!installing) return;
    installing.addEventListener('statechange', () => {
      if (installing.state === 'installed') promoteWaitingWorker(reg, hasOpenDocument);
    });
  });
}

/**
 * Whether a controllerchange should reload the page: only when a worker was
 * already in control at startup (so this is an update, not the first
 * install), only once, and never with a document open (unsaved edits).
 */
export function shouldReloadOnControllerChange(state: {
  hadController: boolean;
  alreadyReloading: boolean;
  hasOpenDocument: boolean;
}): boolean {
  return state.hadController && !state.alreadyReloading && !state.hasOpenDocument;
}
