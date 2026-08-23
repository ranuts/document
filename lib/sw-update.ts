/**
 * Service-worker update policy.
 *
 * Each deploy ships a sw.js with a fresh CACHE_VERSION. The new worker
 * installs and then either takes over at once or WAITS, and sw.js decides
 * which: it calls skipWaiting() on install unless activating would discard
 * vendor assets an open page of the outgoing build still needs (a runtime
 * cache from a different vendor version -- see wouldDiscardVendorAssets in
 * public/sw.js). When it waits, activating it later deletes the previous
 * build's caches, and a page that keeps running the old build with a document
 * open would from then on lazy-load pieces of the new build (sdk-all.js,
 * x2t.wasm.gz, fonts) into an old session -- a mixed-version editor. So the
 * page promotes a waiting worker only when no document is open, and reloads
 * once it takes control.
 */

export type SwLike = {
  state: string;
  scriptURL?: string;
  postMessage: (msg: unknown) => unknown;
  addEventListener: (t: 'statechange', cb: () => void) => void;
};
export type RegistrationLike = {
  active?: SwLike | null;
  waiting: SwLike | null;
  installing: SwLike | null;
  addEventListener: (t: 'updatefound', cb: () => void) => void;
};

/**
 * Is this waiting worker a new build of OURS?
 *
 * It is not a rhetorical question. The vendored editor registers its own
 * worker -- `/document_editor_service_worker.js`, a stub we ship empty -- into
 * the same scope from inside the editor iframe, so on the editor route
 * `registration.waiting` is usually THAT, not a new deploy. Telling it to
 * skipWaiting hands the whole origin to an empty worker: the vendor tree stops
 * being served cache-first and the editor can fail to load outright. And
 * announcing it as "a new version is ready" is simply false.
 *
 * The script URL we registered is the reference. `registration.active` is the
 * fallback, but only that: right after a reload it can still be null, and
 * "nothing to compare with" must not mean "assume it is ours" -- that is how
 * the notice came back on every reload of the editor.
 */
export function isOwnWorker(reg: RegistrationLike, worker: SwLike, ownScriptURL?: string): boolean {
  const mine = ownScriptURL ?? reg.active?.scriptURL;
  if (!mine || !worker.scriptURL) return true; // nothing to compare: old behaviour
  return worker.scriptURL === mine;
}

export const SKIP_WAITING_MESSAGE = { type: 'SKIP_WAITING' } as const;

/**
 * Is this page going to have a document in it?
 *
 * `hasOpenDocument()` reads the store, which is empty until the editor
 * instance exists -- a few hundred milliseconds after `register()` resolves.
 * Asking it that early answers "nothing open" about a page whose whole purpose
 * is to open something, and the promotion that follows lands in the middle of
 * the editor booting.
 *
 * The URL knows sooner. Every route that mounts a document says so in its
 * query string, and embed mode says the host may push one at any moment --
 * which is also why an embedded editor must never promote: the reload that
 * follows would throw away a document the host page owns.
 *
 * On these routes a waiting worker simply stays waiting. That is not a lost
 * update: it is the ordinary case the silent heal exists for, and unlike this
 * path the heal checks that the waiting worker is genuinely a different build
 * before it swaps -- which matters, because the vendored editor registers a
 * worker of its own into this scope from inside the iframe, so ours is left
 * `waiting` on almost every editor load with no new build in sight.
 */
export function documentIsExpected(search: string): boolean {
  const params = new URLSearchParams(search);
  return ['new', 'file', 'src', 'open', 'saved', 'embed', 'embedded'].some((key) => params.has(key));
}

/** Tell a waiting worker to take over -- only if nothing is open. Returns whether it did. */
export function promoteWaitingWorker(
  reg: RegistrationLike,
  hasOpenDocument: () => boolean,
  ownScriptURL?: string,
): boolean {
  if (!reg.waiting || hasOpenDocument()) return false;
  if (!isOwnWorker(reg, reg.waiting, ownScriptURL)) return false;
  reg.waiting.postMessage(SKIP_WAITING_MESSAGE);
  return true;
}

/**
 * Wire a registration: promote an already-waiting worker now, and promote
 * future ones as soon as they finish installing (both gated on "no document
 * open"). A worker that stays waiting because a document is open activates on
 * the next visit, when the landing page calls this again.
 */
export function wireServiceWorkerUpdates(
  reg: RegistrationLike,
  hasOpenDocument: () => boolean,
  ownScriptURL?: string,
): void {
  const promote = (): void => {
    promoteWaitingWorker(reg, hasOpenDocument, ownScriptURL);
  };
  promote();
  reg.addEventListener('updatefound', () => {
    const installing = reg.installing;
    if (!installing) return;
    installing.addEventListener('statechange', () => {
      if (installing.state === 'installed') promote();
    });
  });
}

/**
 * Call back with a worker that is installed and waiting -- now, or as soon as
 * one arrives. Three ways it can show up and all three matter: it is already
 * waiting when the page loads, it is mid-install (`installing`), or an
 * `updatefound` fires later. Missing the third is how a whole page lifetime
 * can pass with nobody offering the new build.
 */
export function onWaitingWorker(
  reg: RegistrationLike,
  onWaiting: (worker: SwLike) => void,
  ownScriptURL?: string,
): void {
  const report = (worker: SwLike): void => {
    if (isOwnWorker(reg, worker, ownScriptURL)) onWaiting(worker);
  };
  const watch = (worker: SwLike | null): void => {
    if (!worker) return;
    if (worker.state === 'installed') {
      report(worker);
      return;
    }
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed') report(worker);
    });
  };
  if (reg.waiting) report(reg.waiting);
  else watch(reg.installing);
  reg.addEventListener('updatefound', () => watch(reg.installing));
}

/**
 * Whether a controllerchange should reload the page.
 *
 * Two conditions, and the history of getting them wrong is the reason both are
 * spelled out here.
 *
 * **It has to be a different build.** A controller changing is routine: the
 * vendored editor registers a worker of its own into this scope from inside
 * its iframe, so ours is re-installed and left waiting on ordinary loads, and
 * the browser activates it by itself at the next navigation -- same build,
 * same caches, nothing to tell anyone. Reloading on every swap is a reload on
 * every second page view (measured: 80ms into the load, on a plain reload of
 * a fresh profile). The evidence for "different" is the runtime cache, named
 * after the vendor tree's content: see isUnseenBuild.
 *
 * **And it must not throw away unsaved work.** Nothing else is a reason to
 * refuse. It used to be "not while a document is open", which sounds careful
 * and is not: activating a worker terminates the outgoing one and every
 * request it still had in flight fails -- on this route the vendored iframe's
 * own document, which nothing retries. By the time this event arrives the page
 * may already be torn in half, and refusing does not undo the swap; it only
 * leaves the reader on a blank editor with no way out but a manual reload.
 *
 * Who asked for the swap is deliberately not a condition. Three things do it
 * and only one is us: sw.js promotes itself on install, another tab promotes
 * through the landing page, and the browser activates a waiting worker on its
 * own.
 */
export function shouldReloadOnControllerChange(state: {
  hadController: boolean;
  alreadyReloading: boolean;
  /** The new controller is a build this browser has not been running. */
  isNewBuild: boolean;
  hasUnsavedChanges?: boolean;
}): boolean {
  // No controller at startup means this is the first install, not an update:
  // nobody was serving this page, so nothing was interrupted.
  if (!state.hadController || state.alreadyReloading) return false;
  if (!state.isNewBuild) return false;
  return !state.hasUnsavedChanges;
}

/** How sw.js names the cache it keeps the vendored editor in. */
export const RUNTIME_CACHE_PREFIX = 'document-editor-runtime-';

/** Remembered per tab, so a heal can never turn into a reload loop. */
export const HEAL_STORAGE_KEY = 'sw-heal-reloaded';

export type HealInput = {
  registration: RegistrationLike;
  waiting: SwLike;
  controller: SwLike | null;
  hadController: boolean;
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
  cacheStorage?: Pick<CacheStorage, 'keys'>;
  ownScriptURL?: string;
};

/**
 * Move a tab that an older build's worker is still serving onto the new one,
 * without saying anything.
 *
 * The situation this exists for: a deploy whose vendor tree changed leaves its
 * worker WAITING (activating it would delete the caches the outgoing build is
 * still reading). Nothing promotes it while a document is open, and the editor
 * route practically always has one -- so the tab keeps being served the old
 * vendor tree even though the page and its bundle, fetched network-first, are
 * already new. If that old tree references files the deploy deleted, the
 * result is not a stale page but a broken one: a reverted font build kept
 * rendering garbled text for a day after the revert shipped.
 *
 * Silent is deliberate. This runs at boot, where nothing has been typed, so
 * the reload costs a second of loading and no work -- there is nothing worth
 * interrupting the reader for. It happens at most once per tab, only when the
 * waiting worker is ours and is genuinely a different build, and never when
 * there are unsaved edits (see shouldReloadOnControllerChange).
 */
export async function healStaleController(input: HealInput): Promise<boolean> {
  const { registration, waiting, controller, hadController, storage, ownScriptURL } = input;
  if (!hadController || !controller) return false;
  if (!isOwnWorker(registration, waiting, ownScriptURL)) return false;
  if (storage?.getItem(HEAL_STORAGE_KEY)) return false;
  if (!(await isUnseenBuild(waiting, input.cacheStorage))) return false;
  storage?.setItem(HEAL_STORAGE_KEY, '1');
  waiting.postMessage(SKIP_WAITING_MESSAGE);
  return true;
}

/** What a worker answers `VERSION` with (public/sw.js). */
export type WorkerVersion = { cacheVersion?: string; vendorVersion?: string };

/** Ask one worker which build it is. Resolves null when it does not answer. */
export function askVersion(worker: SwLike | null, timeoutMs = 1000): Promise<WorkerVersion | null> {
  return new Promise((resolve) => {
    if (!worker || typeof MessageChannel === 'undefined') {
      resolve(null);
      return;
    }
    const channel = new MessageChannel();
    let settled = false;
    const done = (value: WorkerVersion | null): void => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    channel.port1.onmessage = (event: MessageEvent) => done((event.data ?? null) as WorkerVersion | null);
    setTimeout(() => done(null), timeoutMs);
    try {
      // Two-argument postMessage, which the narrow SwLike shape does not model.
      (worker as unknown as { postMessage(msg: unknown, transfer: MessagePort[]): void }).postMessage(
        { type: 'VERSION' },
        [channel.port2],
      );
    } catch {
      done(null);
    }
  });
}

/**
 * How patient `isUnseenBuild` is with a worker that has not answered yet.
 * Three tries of two seconds, so a busy worker has six seconds to say which
 * build it is before its silence is taken as an answer.
 */
export const ASK_VERSION_ATTEMPTS = 3;
export const ASK_VERSION_TIMEOUT_MS = 2000;

/**
 * Ask, and keep asking for a few seconds before believing the silence.
 *
 * A worker answers `VERSION` from its message handler, which it cannot run
 * while it is busy -- and it is busiest in exactly the moment this question is
 * asked: it has just been activated, the outgoing worker is being terminated,
 * and the page is refetching a vendor tree that is not in its cache. A single
 * one-second question read that silence as "nothing to tell you", and the
 * caller acts on that answer: the reload that repairs a page torn in half by
 * the swap never happened, and the tab stayed blank. Seen once in CI on the
 * silent-heal case -- where the test's own three-second question to the same
 * worker was answered.
 *
 * Silence still decides, eventually. This only stops it deciding early.
 */
export async function askVersionPatiently(
  worker: SwLike | null,
  attempts = ASK_VERSION_ATTEMPTS,
  timeoutMs = ASK_VERSION_TIMEOUT_MS,
): Promise<WorkerVersion | null> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const answer = await askVersion(worker, timeoutMs);
    if (answer) return answer;
  }
  return null;
}

/**
 * Is the waiting worker a build this browser has never run?
 *
 * "There is a worker waiting" is not that question, and on the editor route it
 * is usually the wrong one: the vendored editor registers a script of its own
 * into this scope from inside its iframe, so the scope's script alternates and
 * OUR worker is re-installed on the next load -- waiting, same build, nothing
 * to do.
 *
 * The evidence is the runtime cache, not a conversation. sw.js names it after
 * the vendor tree's content hash (`document-editor-runtime-<vendorVersion>`),
 * so a build whose cache is already on this machine is a build this browser
 * has been running. Asking the CONTROLLER instead was the first attempt and it
 * was wrong in a way worth remembering: a worker under load does not answer
 * within a timeout, silence got read as "it is old", and tabs reloaded
 * themselves in the middle of a test run.
 *
 * The question it still asks -- which build is this? -- is asked patiently,
 * for the same reason: see askVersionPatiently.
 */
export async function isUnseenBuild(
  waiting: SwLike | null,
  cacheStorage: Pick<CacheStorage, 'keys'> | undefined = typeof caches === 'undefined' ? undefined : caches,
): Promise<boolean> {
  const version = await askVersionPatiently(waiting);
  const vendorVersion = version?.vendorVersion;
  if (!vendorVersion || !cacheStorage) return false; // cannot tell -- do nothing
  const runtime = (await cacheStorage.keys()).filter((name) => name.startsWith(RUNTIME_CACHE_PREFIX));
  // No runtime cache yet means nothing to compare against, which is not the
  // same as "this build is new". Staying quiet is the safe reading: the worst
  // case is one page load served by the outgoing build, and the next load has
  // the evidence.
  if (!runtime.length) return false;
  return !runtime.some((name) => name.endsWith(`-${vendorVersion}`));
}
