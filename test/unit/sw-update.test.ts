import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  type SwLike,
  SKIP_WAITING_MESSAGE,
  HEAL_STORAGE_KEY,
  healStaleController,
  isUnseenBuild,
  onWaitingWorker,
  documentIsExpected,
  promoteWaitingWorker,
  shouldReloadOnControllerChange,
  wireServiceWorkerUpdates,
} from '../../lib/sw-update';

/**
 * Deploy-while-editing safety (matrix section C, "SW 缓存旧构建 -> 升级").
 * A new build's worker must not take over while a document is open: it would
 * delete the old build's caches and the still-running old page would lazy-load
 * new-build pieces into its session (mixed-version editor).
 */
type FakeWorker = SwLike & {
  postMessage: ReturnType<typeof vi.fn<(msg: unknown) => unknown>>;
  listeners: Array<() => void>;
};
const worker = (state = 'installed', scriptURL = 'https://edit.example/sw.js'): FakeWorker => {
  const w: FakeWorker = {
    state,
    scriptURL,
    postMessage: vi.fn<(msg: unknown) => unknown>(),
    listeners: [],
    addEventListener: (_t, cb) => {
      w.listeners.push(cb);
    },
  };
  return w;
};
const registration = (
  waiting: ReturnType<typeof worker> | null = null,
  active: SwLike | null = worker('activated'),
) => {
  const r = {
    active,
    waiting: waiting as SwLike | null,
    installing: null as SwLike | null,
    updateListeners: [] as Array<() => void>,
    addEventListener: (_t: 'updatefound', cb: () => void) => {
      r.updateListeners.push(cb);
    },
  };
  return r;
};

describe('promoteWaitingWorker', () => {
  it('sends SKIP_WAITING to a waiting worker when no document is open', () => {
    const w = worker();
    expect(promoteWaitingWorker(registration(w), () => false)).toBe(true);
    expect(w.postMessage).toHaveBeenCalledWith(SKIP_WAITING_MESSAGE);
  });

  it('never promotes while a document is open', () => {
    const w = worker();
    expect(promoteWaitingWorker(registration(w), () => true)).toBe(false);
    expect(w.postMessage).not.toHaveBeenCalled();
  });

  it('is a no-op without a waiting worker', () => {
    expect(promoteWaitingWorker(registration(null), () => false)).toBe(false);
  });
});

describe('wireServiceWorkerUpdates', () => {
  it('promotes a worker that finishes installing later (landing page, nothing open)', () => {
    const r = registration();
    wireServiceWorkerUpdates(r, () => false);
    const w = worker('installing');
    r.installing = w;
    r.updateListeners.forEach((cb) => cb());
    w.state = 'installed';
    r.waiting = w;
    w.listeners.forEach((cb) => cb());
    expect(w.postMessage).toHaveBeenCalledWith(SKIP_WAITING_MESSAGE);
  });

  it('leaves the new worker waiting while a document is open', () => {
    const r = registration();
    wireServiceWorkerUpdates(r, () => true);
    const w = worker('installing');
    r.installing = w;
    r.updateListeners.forEach((cb) => cb());
    w.state = 'installed';
    r.waiting = w;
    w.listeners.forEach((cb) => cb());
    expect(w.postMessage).not.toHaveBeenCalled();
  });
});

/**
 * The brake on the rule above. Promotion runs before the editor exists, so
 * "nothing is open" is true on a page that is opening something -- and the
 * vendored editor keeps our worker in `waiting` on almost every editor load
 * without any new build existing, so treating each of those as a promotion
 * worth reloading for is a reload on every load.
 */
describe('documentIsExpected', () => {
  it('recognises every route that mounts a document', () => {
    for (const search of ['?new=docx', '?file=https://x/a.docx', '?src=https://x/a.docx', '?open=local', '?saved=abc'])
      expect(documentIsExpected(search), search).toBe(true);
  });

  it('counts embed mode, where the host can push one at any moment', () => {
    // Reloading an embedded editor would throw away the host page's document.
    expect(documentIsExpected('?embed=1')).toBe(true);
    expect(documentIsExpected('?embedded=1')).toBe(true);
  });

  it('leaves a page with nothing to open free to take an update', () => {
    expect(documentIsExpected('')).toBe(false);
    expect(documentIsExpected('?locale=ja')).toBe(false);
  });
});

describe('shouldReloadOnControllerChange', () => {
  const update = { hadController: true, alreadyReloading: false, isNewBuild: true };
  it('reloads once on an update', () => {
    expect(shouldReloadOnControllerChange(update)).toBe(true);
  });
  it('does not reload on a first install, or twice', () => {
    // No controller at startup means nobody was serving this page, so nothing
    // was interrupted -- and reloading the first visit would be a stutter.
    expect(shouldReloadOnControllerChange({ ...update, hadController: false })).toBe(false);
    expect(shouldReloadOnControllerChange({ ...update, alreadyReloading: true })).toBe(false);
  });

  /**
   * The routine case, and the one that made an earlier attempt reload every
   * second page view: the vendored editor keeps our worker re-installing, the
   * browser activates it at the next navigation, and the controller changes
   * with nothing behind it. Measured at 80ms into a plain reload.
   */
  it('ignores a swap between two instances of the same build', () => {
    expect(shouldReloadOnControllerChange({ ...update, isNewBuild: false })).toBe(false);
  });
});

describe('public/sw.js decides for itself whether it can take over', () => {
  const src = readFileSync(resolve(__dirname, '../../public/sw.js'), 'utf8');

  /**
   * The un-injected source falls back to the `dev` vendor stamp, so this is
   * what its own runtime cache is called here (bin/build.sh substitutes the
   * real content hash at build time).
   */
  const OWN_RUNTIME = 'document-editor-runtime-dev';

  /**
   * Evaluate the shipped worker in a fake ServiceWorkerGlobalScope and hand
   * back its listeners. Driving the real install handler beats asserting on a
   * slice of the source: the point is the decision, not the text.
   */
  const loadWorker = (existingCaches: Record<string, string[]>) => {
    const skipWaiting = vi.fn();
    const deleted: string[] = [];
    const caches = {
      open: vi.fn((name: string) =>
        Promise.resolve({
          addAll: vi.fn().mockResolvedValue(undefined),
          keys: () => Promise.resolve((existingCaches[name] ?? []).map((url) => ({ url: `http://localhost${url}` }))),
        }),
      ),
      keys: vi.fn().mockResolvedValue(Object.keys(existingCaches)),
      delete: vi.fn((name: string) => {
        deleted.push(name);
        return Promise.resolve(true);
      }),
    };
    const listeners: Record<string, (event: unknown) => void> = {};
    const scope = {
      addEventListener: (type: string, cb: (event: unknown) => void) => {
        listeners[type] = cb;
      },
      skipWaiting,
      clients: { claim: vi.fn(), matchAll: vi.fn().mockResolvedValue([]) },
    };
    new Function('self', 'caches', src)(scope, caches);
    return { listeners, skipWaiting, deleted };
  };

  /** Run one lifecycle event to completion, the way the browser awaits waitUntil. */
  const dispatch = async (worker: ReturnType<typeof loadWorker>, type: string) => {
    const pending: Array<Promise<unknown>> = [];
    worker.listeners[type]({ waitUntil: (p: Promise<unknown>) => pending.push(p) });
    await Promise.all(pending);
  };

  it('takes over at once when there is no vendor cache to lose (first visit)', async () => {
    const worker = loadWorker({});
    await dispatch(worker, 'install');
    expect(worker.skipWaiting).toHaveBeenCalled();
  });

  it('takes over at once when the outgoing build shares this vendor tree', async () => {
    // The overwhelmingly common deploy: app code changed, vendor did not. The
    // runtime cache name is the same, so activate() deletes nothing an open
    // editor still needs -- and users stop being stranded on old code.
    const worker = loadWorker({
      'document-editor-core-1787000000': [],
      [OWN_RUNTIME]: ['/sdkjs/common/wasm/x2t/x2t.wasm.gz'],
    });
    await dispatch(worker, 'install');
    expect(worker.skipWaiting).toHaveBeenCalled();
  });

  it('takes over past an emptied runtime cache: a landing-page-only visitor has nothing to lose', async () => {
    // `/` populates a runtime cache too (fingerprinted token CSS, the Geist
    // face list, open-local.js), and pruneAppAssets empties such a cache
    // without removing it. Judged by name, that empty shell reads as "there
    // are vendor assets to lose" and strands the visitor on old code for the
    // rest of the site's life.
    const worker = loadWorker({ 'document-editor-runtime-9f2b1c4d5e6a': [] });
    await dispatch(worker, 'install');
    expect(worker.skipWaiting).toHaveBeenCalled();
  });

  it('takes over on the very deploy that introduces this scheme', async () => {
    // The outgoing cache is still named after the BUILD, so its name can never
    // match ours -- and this is the one deploy on which the client-count
    // handshake in public/sw-register.js cannot work either (the worker it has
    // to ask never shipped a CLIENT_COUNT handler). Judged by name, both
    // mechanisms fail together and the #144 fix ships undeliverable.
    const worker = loadWorker({ 'document-editor-runtime-1787000000': ['/ran-tokens.a1b2c3d4.css'] });
    await dispatch(worker, 'install');
    expect(worker.skipWaiting).toHaveBeenCalled();
  });

  it('ignores stale core caches, which activate() may always discard', async () => {
    // HTML is served network-first, so a core cache is only an offline
    // fallback: losing the previous build's copy cannot mix versions.
    const worker = loadWorker({
      'document-editor-core-1787000000': [],
      'document-editor-core-1786000000': [],
    });
    await dispatch(worker, 'install');
    expect(worker.skipWaiting).toHaveBeenCalled();
  });

  it('stays waiting when the vendor tree changed under an open page', async () => {
    // A vendor bump is the one case where activating would pull sdk-all.js /
    // x2t.wasm.gz / the font catalog out from under a live editor, which then
    // lazy-loads the new build's copies into an old session.
    const worker = loadWorker({
      'document-editor-runtime-9f2b1c4d5e6a': ['/sdkjs/common/wasm/x2t/x2t.wasm.gz', '/fonts/012'],
    });
    await dispatch(worker, 'install');
    expect(worker.skipWaiting).not.toHaveBeenCalled();
  });

  it('still honours SKIP_WAITING, the way out of the waiting case', async () => {
    const worker = loadWorker({
      'document-editor-runtime-9f2b1c4d5e6a': ['/sdkjs/common/wasm/x2t/x2t.wasm.gz'],
    });
    worker.listeners.message({ data: { type: 'SKIP_WAITING' } });
    expect(worker.skipWaiting).toHaveBeenCalled();
  });

  it('keys the runtime cache by the vendor stamp, never by the build stamp', () => {
    // The whole fix in one line. Keyed by the build, every deploy looks like a
    // vendor change, no deploy can activate on its own, and a shipped fix waits
    // for the user to close every tab of the site (GitHub #144).
    expect(src).toMatch(/const RUNTIME_CACHE = `document-editor-runtime-\$\{VENDOR_VERSION\}`/);
    expect(src).toMatch(/const CORE_CACHE = `document-editor-core-\$\{CACHE_VERSION\}`/);
  });
});

describe('the runtime cache outlives deploys, so it has to be kept honest', () => {
  const src = readFileSync(resolve(__dirname, '../../public/sw.js'), 'utf8');
  const ORIGIN = 'http://localhost';
  const OWN_RUNTIME = 'document-editor-runtime-dev';

  /** A Cache whose contents the test can inspect; deletions are real. */
  const fakeCache = (urls: string[]) => {
    const entries = urls.map((url) => ({ url: `${ORIGIN}${url}` }));
    return {
      urls: () => entries.map((entry) => entry.url.slice(ORIGIN.length)),
      addAll: vi.fn().mockResolvedValue(undefined),
      // Resolves, like the real Cache API: the fetch handler chains off put()
      // so that a rejected write (a full storage bucket) cannot take the
      // response down with it.
      put: vi.fn().mockResolvedValue(undefined),
      keys: () => Promise.resolve(entries.slice()),
      // The vendor branch of the fetch handler reads through the cache handle
      // rather than the global `caches`, so a store that cannot answer match()
      // makes it reject instead of falling through to the network.
      match: (request: { url: string }) =>
        Promise.resolve(entries.find((entry) => entry.url === request.url) ? { body: 'cached' } : undefined),
      delete: (request: { url: string }) => {
        const at = entries.findIndex((entry) => entry.url === request.url);
        if (at >= 0) entries.splice(at, 1);
        return Promise.resolve(at >= 0);
      },
    };
  };

  /**
   * The worker with a populated cache store, and a network that answers every
   * request with a cacheable 200 (the fetch handler's happy path).
   */
  const loadWorker = (stores: Record<string, ReturnType<typeof fakeCache>>, windows: object[] = []) => {
    const caches = {
      open: vi.fn((name: string) => Promise.resolve((stores[name] ??= fakeCache([])))),
      has: vi.fn((name: string) => Promise.resolve(name in stores)),
      keys: vi.fn(() => Promise.resolve(Object.keys(stores))),
      delete: vi.fn((name: string) => {
        delete stores[name];
        return Promise.resolve(true);
      }),
      match: vi.fn().mockResolvedValue(undefined),
    };
    const listeners: Record<string, (event: unknown) => void> = {};
    const scope = {
      addEventListener: (type: string, cb: (event: unknown) => void) => {
        listeners[type] = cb;
      },
      skipWaiting: vi.fn(),
      location: { origin: ORIGIN },
      clients: { claim: vi.fn(), matchAll: vi.fn().mockResolvedValue(windows) },
    };
    const fetchStub = vi.fn().mockResolvedValue({
      status: 200,
      type: 'basic',
      clone: () => ({ body: 'copy' }),
    });
    new Function('self', 'caches', 'fetch', src)(scope, caches, fetchStub);
    return { listeners, caches };
  };

  const dispatch = async (worker: ReturnType<typeof loadWorker>, type: string, event: object = {}) => {
    const pending: Array<Promise<unknown>> = [];
    worker.listeners[type]({ waitUntil: (p: Promise<unknown>) => pending.push(p), ...event });
    await Promise.all(pending);
  };

  it('drops the outgoing app build from the runtime cache and keeps the vendor tree', async () => {
    // Keying the cache by vendor content is what lets a deploy activate at
    // once -- and it also means nothing clears the cache any more. The app half
    // is dead on arrival (no deploy requests /assets/<hash> again) and would
    // otherwise pile up deploy after deploy against MAX_RUNTIME_ITEMS.
    const runtime = fakeCache([
      '/sdkjs/common/wasm/x2t/x2t.wasm.gz',
      '/web-apps/apps/spreadsheeteditor/main/app.js',
      '/fonts/012',
      '/assets/index-deadbeef.js',
      '/assets/index-deadbeef.css',
    ]);
    const worker = loadWorker({ 'document-editor-core-1787000000': fakeCache([]), [OWN_RUNTIME]: runtime });

    await dispatch(worker, 'activate');

    expect(runtime.urls()).toEqual([
      '/sdkjs/common/wasm/x2t/x2t.wasm.gz',
      '/web-apps/apps/spreadsheeteditor/main/app.js',
      '/fonts/012',
    ]);
  });

  it('leaves the app half alone while a window of the outgoing build is open', async () => {
    // A vendor-unchanged deploy now takes over during install, so activate()
    // runs under live pages -- and an editor with a document open is
    // deliberately not reloaded. Deleting /assets/<hash> under it removes the
    // last copy in existence (the new deployment does not serve the retired
    // build's filenames), so its next lazy import() -- the agent panel, the
    // pending-open handoff -- gets the 404 branch and never loads.
    const runtime = fakeCache(['/sdkjs/common/wasm/x2t/x2t.wasm.gz', '/assets/index-deadbeef.js']);
    const worker = loadWorker({ [OWN_RUNTIME]: runtime }, [{ id: 'window-1' }]);

    await dispatch(worker, 'activate');

    expect(runtime.urls()).toContain('/assets/index-deadbeef.js');
  });

  it('keeps a stale runtime cache that acquired vendor assets after the install check', async () => {
    // wouldDiscardVendorAssets runs during install; activate runs after it, and
    // on a take-over-at-once deploy that is under live pages. In between, a
    // page of the outgoing build can write its first vendor entries into its
    // own runtime cache -- the install check saw it empty and let us through,
    // and deleting it here is the mixed-version state that check exists to
    // prevent. Asked again at delete time, with a window open, it survives.
    const stale = fakeCache(['/sdkjs/common/wasm/x2t/x2t.wasm.gz']);
    const stores = { 'document-editor-runtime-oldvendor': stale, [OWN_RUNTIME]: fakeCache([]) };
    const worker = loadWorker(stores, [{ id: 'window-1' }]);

    await dispatch(worker, 'activate');

    expect(Object.keys(stores)).toContain('document-editor-runtime-oldvendor');
  });

  it('still sweeps a stale runtime cache when no window can be hurt by it', async () => {
    const stale = fakeCache(['/sdkjs/common/wasm/x2t/x2t.wasm.gz']);
    const stores = { 'document-editor-runtime-oldvendor': stale, [OWN_RUNTIME]: fakeCache([]) };
    const worker = loadWorker(stores, []);

    await dispatch(worker, 'activate');

    expect(Object.keys(stores)).not.toContain('document-editor-runtime-oldvendor');
  });

  it('sweeps a stale CORE cache even under an open window (it holds no vendor assets)', async () => {
    const stores = { 'document-editor-core-1787000000': fakeCache(['/index.html']), [OWN_RUNTIME]: fakeCache([]) };
    const worker = loadWorker(stores, [{ id: 'window-1' }]);

    await dispatch(worker, 'activate');

    expect(Object.keys(stores)).not.toContain('document-editor-core-1787000000');
  });

  it('trims an app asset rather than the vendor binary the trim was protecting', async () => {
    // keys() is insertion-ordered, so a plain keys[0] takes the OLDEST entry --
    // exactly the vendor tree, fetched during the first open. Re-downloading
    // x2t.wasm.gz and the font catalog is what the cache-first branch exists to
    // prevent, and an /assets/<hash> from a retired build costs one request.
    const filler = Array.from({ length: 1999 }, (_, i) => `/web-apps/apps/filler-${i}.js`);
    const runtime = fakeCache(['/sdkjs/common/wasm/x2t/x2t.wasm.gz', ...filler, '/assets/index-deadbeef.js']);
    const worker = loadWorker({ [OWN_RUNTIME]: runtime });

    // A cache-first vendor binary: it misses, gets fetched, and trims.
    await dispatch(worker, 'fetch', {
      request: { method: 'GET', url: `${ORIGIN}/fonts/031`, mode: 'no-cors' },
      respondWith: () => {},
    });

    await vi.waitFor(() => expect(runtime.urls()).not.toContain('/assets/index-deadbeef.js'));
    expect(runtime.urls()).toContain('/sdkjs/common/wasm/x2t/x2t.wasm.gz');
  });

  it('does not conjure a runtime cache for a visitor who has none', async () => {
    // `caches.open` CREATES. An empty runtime cache is not harmless: the next
    // vendor-changing deploy reads its existence as "there are vendor assets to
    // lose" and stays waiting instead of taking over (wouldDiscardVendorAssets),
    // which is the whole failure this rewrite exists to end -- for exactly the
    // landing-page-only visitor who had nothing to lose.
    const stores: Record<string, ReturnType<typeof fakeCache>> = {};
    const worker = loadWorker(stores);

    await dispatch(worker, 'activate');

    expect(Object.keys(stores)).toEqual([]);
    expect(worker.caches.has).toHaveBeenCalledWith(OWN_RUNTIME);
  });

  it('names the vendor trees bin/build.sh hashes, so the two cannot drift', () => {
    // A tree in the VENDOR_VERSION hash but not in VENDOR_ASSET would be
    // pruned on every activate despite naming the cache it lives in.
    const build = readFileSync(resolve(__dirname, '../../bin/build.sh'), 'utf8');
    for (const tree of ['sdkjs', 'web-apps', 'fonts']) {
      expect(src).toContain(tree);
      // Listed relative to $DIST_DIR: the hash is taken from inside it (see
      // the next case), so the tree names appear as the loop's own words.
      expect(build).toMatch(new RegExp(`for dir in [^\n]*\\b${tree}\\b`));
    }
    expect(src).toMatch(/const VENDOR_ASSET = \/\^\\\/\(\?:sdkjs\|web-apps\|fonts\)\\\/\//);
  });
});

/**
 * A cache write has to outlive the response it came from.
 *
 * `respondWith` settles the moment the response is handed to the page, and a
 * worker with no outstanding work may be terminated right there -- taking a
 * half-finished `cache.put` with it. The larger the file the wider that window,
 * which is exactly backwards: the 13.7 MB SDK bundle is the entry most worth
 * keeping. It surfaced as a CI failure where the last file of a warm-up was
 * missing from the cache, and it is invisible locally because nothing pressures
 * the worker to shut down.
 */
describe('cache writes are held open past the response', () => {
  const src = readFileSync(resolve(__dirname, '../../public/sw.js'), 'utf8');

  it('every runtime cache write is wrapped in event.waitUntil', () => {
    // One call site per caching branch: the vendor cache-first path and the
    // stale-while-revalidate path. (The helper's own arrow definition does not
    // match, which is what makes this a count of call sites.)
    const calls = [...src.matchAll(/putInRuntimeCache\(/g)];
    expect(calls.length, 'expected a call site in each caching branch').toBe(2);

    const guarded = [...src.matchAll(/event\.waitUntil\(putInRuntimeCache\(/g)];
    expect(guarded.length, 'a putInRuntimeCache call is not inside event.waitUntil').toBe(calls.length);
  });

  it('holds the core-cache writes open too', () => {
    // The HTML branch had the same shape. Smaller files, same failure mode.
    const fetchHandler = src.slice(src.indexOf("addEventListener('fetch'"));
    const coreWrites = [...fetchHandler.matchAll(/caches\.open\(CORE_CACHE\)/g)];
    expect(coreWrites.length, 'expected the network-first and 404-recovery writes').toBe(2);
    for (const match of coreWrites) {
      const before = fetchHandler.slice(Math.max(0, match.index - 200), match.index);
      expect(before, 'a CORE_CACHE write in the fetch handler is not inside event.waitUntil').toMatch(
        /event\.waitUntil\(\s*$/,
      );
    }
  });
});

describe('bin/build.sh stamps both versions into sw.js', () => {
  const script = readFileSync(resolve(__dirname, '../../bin/build.sh'), 'utf8');

  it('substitutes the vendor placeholder as well as the build one', () => {
    // Left unsubstituted, sw.js falls back to the literal `dev` stamp: every
    // deploy would then share one runtime cache name and a real vendor bump
    // would be served from the previous vendor's cache.
    expect(script).toContain('s/SW_VERSION_PLACEHOLDER/$TIMESTAMP/g');
    expect(script).toContain('s/VENDOR_VERSION_PLACEHOLDER/$VENDOR_VERSION/g');
  });

  it('derives the vendor stamp from the served vendor trees, reproducibly', () => {
    // Sorted (so two builds of the same tree agree), content-hashed (so our own
    // patches inside the vendor tree count), and `-exec ... +` rather than a
    // pipe through xargs because some vendor files have spaces in their names.
    expect(script).toMatch(/find \$VENDOR_DIRS -type f -exec \$HASH_CMD \{\} \+/);
    expect(script).toContain('LC_ALL=C sort');
    // From INSIDE $DIST_DIR, so the digests carry relative paths. Hashing
    // `$DIST_DIR/sdkjs/...` would fold the output directory's name into the
    // stamp, and the same vendor tree built into `dist-e2e-4174/` would name a
    // different runtime cache than the one built into `dist/`.
    expect(script).toMatch(/VENDOR_VERSION=\$\(cd "\$DIST_DIR" && find \$VENDOR_DIRS/);
    for (const dir of ['sdkjs', 'web-apps', 'fonts']) {
      expect(script, dir).toMatch(new RegExp(`for dir in [^\n]*\\b${dir}\\b`));
    }
  });
});

/**
 * The other half of the update path: someone whose document is open is never
 * promoted automatically, so they have to be offered the new build instead.
 * That offer is only as good as the detection -- a worker can be waiting
 * already, be mid-install, or arrive later -- and missing the last case is how
 * a whole page lifetime passes with nobody asking.
 */
describe('onWaitingWorker', () => {
  it('reports a worker that is already waiting', () => {
    const w = worker();
    const seen: unknown[] = [];
    onWaitingWorker(registration(w), (found) => seen.push(found));
    expect(seen).toEqual([w]);
  });

  it('reports one that is still installing when the page loads', () => {
    const r = registration();
    const w = worker('installing');
    r.installing = w;
    const seen: unknown[] = [];
    onWaitingWorker(r, (found) => seen.push(found));
    expect(seen).toEqual([]);
    w.state = 'installed';
    w.listeners.forEach((cb) => cb());
    expect(seen).toEqual([w]);
  });

  it('reports one that turns up after the page has loaded', () => {
    const r = registration();
    const seen: unknown[] = [];
    onWaitingWorker(r, (found) => seen.push(found));
    const w = worker('installing');
    r.installing = w;
    r.updateListeners.forEach((cb) => cb());
    w.state = 'installed';
    w.listeners.forEach((cb) => cb());
    expect(seen).toEqual([w]);
  });

  it('says nothing when there is no new worker at all', () => {
    const seen: unknown[] = [];
    onWaitingWorker(registration(null), (found) => seen.push(found));
    expect(seen).toEqual([]);
  });
});

/**
 * The vendored editor registers a worker of its own from inside the iframe --
 * `/document_editor_service_worker.js`, a stub this repo ships empty -- into
 * the same scope. So on the editor route `registration.waiting` is usually
 * that, not a new deploy of ours. Promoting it hands the origin to an empty
 * worker (no cache-first vendor tree, an editor that can fail to load), and
 * announcing it as a new version is a lie. Both paths check the script URL.
 */
describe('a foreign worker in the same scope', () => {
  const vendor = () => worker('installed', 'https://edit.example/document_editor_service_worker.js');

  it('is never told to skip waiting', () => {
    const v = vendor();
    expect(promoteWaitingWorker(registration(v), () => false)).toBe(false);
    expect(v.postMessage).not.toHaveBeenCalled();
  });

  it('is never announced as a new version', () => {
    const seen: unknown[] = [];
    onWaitingWorker(registration(vendor()), (found) => seen.push(found));
    expect(seen).toEqual([]);
  });

  it('does not stop a real update of ours from being promoted', () => {
    const ours = worker();
    expect(promoteWaitingWorker(registration(ours), () => false)).toBe(true);
    expect(ours.postMessage).toHaveBeenCalledWith(SKIP_WAITING_MESSAGE);
  });
});

/**
 * "A worker is waiting" does not mean "a new build is waiting". The vendored
 * editor registers a script of its own into this scope from inside its iframe,
 * so the scope's script alternates and OUR worker gets re-installed on the
 * next editor load -- waiting, same build, nothing to do.
 *
 * The evidence is the runtime cache sw.js names after the vendor tree's
 * content hash: a build whose cache is already here is one this browser has
 * been running. (Asking the controller instead was tried first and reloaded
 * tabs mid-test whenever a busy worker missed the timeout.)
 */
describe('isUnseenBuild', () => {
  const answering = (version: Record<string, string> | null) =>
    ({
      state: 'installed',
      addEventListener: () => {},
      postMessage: (_msg: unknown, transfer?: MessagePort[]) => {
        const port = transfer?.[0];
        if (port && version) setTimeout(() => port.postMessage({ type: 'VERSION', ...version }), 0);
      },
    }) as unknown as SwLike;
  const cachesWith = (...names: string[]) => ({ keys: () => Promise.resolve(names) });

  it('is false when this browser already holds that build cache', async () => {
    const seen = cachesWith('document-editor-core-123', 'document-editor-runtime-v1');
    await expect(isUnseenBuild(answering({ vendorVersion: 'v1' }), seen)).resolves.toBe(false);
  });

  it('is true when no cache here belongs to it', async () => {
    const seen = cachesWith('document-editor-core-123', 'document-editor-runtime-v1');
    await expect(isUnseenBuild(answering({ vendorVersion: 'v2' }), seen)).resolves.toBe(true);
  });

  it('says nothing when the waiting worker does not answer', async () => {
    await expect(isUnseenBuild(answering(null), cachesWith('document-editor-runtime-v1'))).resolves.toBe(false);
  });

  it('says nothing when there is no runtime cache to compare against', async () => {
    await expect(isUnseenBuild(answering({ vendorVersion: 'v2' }), cachesWith('document-editor-core-1'))).resolves.toBe(
      false,
    );
  });
});

/**
 * The silent heal. A deploy that changed the vendor tree leaves its worker
 * waiting, nothing promotes it while a document is open, and the editor route
 * practically always has one -- so the tab keeps being served an outgoing
 * build whose files the deploy may have deleted. At boot there is nothing
 * typed to lose, so it promotes and reloads without asking.
 */
describe('healStaleController', () => {
  const answering = (version: Record<string, string> | null, scriptURL = 'https://edit.example/sw.js') => {
    const posted: unknown[] = [];
    const w = {
      state: 'installed',
      scriptURL,
      addEventListener: () => {},
      posted,
      postMessage: (msg: unknown, transfer?: MessagePort[]) => {
        posted.push(msg);
        const port = transfer?.[0];
        if (port && version) setTimeout(() => port.postMessage({ type: 'VERSION', ...version }), 0);
      },
    };
    return w as typeof w & SwLike;
  };
  const store = () => {
    const map = new Map<string, string>();
    return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), map };
  };
  const input = (over: Partial<Parameters<typeof healStaleController>[0]> = {}) => {
    const waiting = answering({ vendorVersion: 'v2' });
    const controller = answering({ vendorVersion: 'v1' });
    return {
      registration: registration(waiting as never, controller as never),
      waiting,
      controller,
      hadController: true,
      storage: store(),
      cacheStorage: { keys: () => Promise.resolve(['document-editor-runtime-v1']) },
      ownScriptURL: 'https://edit.example/sw.js',
      ...over,
    } as Parameters<typeof healStaleController>[0] & { waiting: typeof waiting; storage: ReturnType<typeof store> };
  };

  it('promotes an older build out of the way', async () => {
    const args = input();
    await expect(healStaleController(args)).resolves.toBe(true);
    expect((args.waiting as unknown as { posted: unknown[] }).posted).toContainEqual(SKIP_WAITING_MESSAGE);
  });

  it('does nothing on a first install, when there is no outgoing build', async () => {
    const args = input({ hadController: false });
    await expect(healStaleController(args)).resolves.toBe(false);
  });

  it('does nothing when the waiting worker is the same build', async () => {
    const waiting = answering({ vendorVersion: 'v1' });
    const controller = answering({ vendorVersion: 'v1' });
    await expect(
      healStaleController({
        registration: registration(waiting as never, controller as never),
        waiting,
        controller,
        hadController: true,
        storage: store(),
        cacheStorage: { keys: () => Promise.resolve(['document-editor-runtime-v1']) },
        ownScriptURL: 'https://edit.example/sw.js',
      }),
    ).resolves.toBe(false);
  });

  it('leaves the vendored editor own worker alone', async () => {
    const waiting = answering({ vendorVersion: 'v2' }, 'https://edit.example/document_editor_service_worker.js');
    const controller = answering({ vendorVersion: 'v1' });
    await expect(
      healStaleController({
        registration: registration(waiting as never, controller as never),
        waiting,
        controller,
        hadController: true,
        storage: store(),
        cacheStorage: { keys: () => Promise.resolve(['document-editor-runtime-v1']) },
        ownScriptURL: 'https://edit.example/sw.js',
      }),
    ).resolves.toBe(false);
    expect((waiting as unknown as { posted: unknown[] }).posted).toEqual([]);
  });

  it('happens once per tab, so it can never become a reload loop', async () => {
    const storage = store();
    await expect(healStaleController(input({ storage }))).resolves.toBe(true);
    expect(storage.map.get(HEAL_STORAGE_KEY)).toBe('1');
    await expect(healStaleController(input({ storage }))).resolves.toBe(false);
  });
});

describe('shouldReloadOnControllerChange after a swap this page did not ask for', () => {
  /**
   * The blank editor. A worker taking over terminates the outgoing one and
   * every request it still had in flight fails -- on the editor route that is
   * the vendored iframe's own document, which nothing retries. Measured in CI:
   * the swap landed 50ms into a reload, 170ms before it killed that request.
   * Refusing the reload does not undo the swap, it only leaves the reader on
   * a white page.
   *
   * And the page cannot tell who swapped: sw.js promotes itself when it would
   * not discard vendor assets, another tab promotes through the landing page,
   * and the browser activates a waiting worker on its own once the old one's
   * clients are gone. Only the third of those involves this page at all.
   */
  it('reloads even with a document open -- the reload is the repair', () => {
    // `hasOpenDocument` was the old condition, and passing it is the point:
    // this exact input used to return false, which is how a reader ended up
    // on a blank page with no way out but a manual reload.
    const state = {
      hadController: true,
      alreadyReloading: false,
      isNewBuild: true,
      hasOpenDocument: true,
    } as Parameters<typeof shouldReloadOnControllerChange>[0];
    expect(shouldReloadOnControllerChange(state)).toBe(true);
  });

  it('never reloads over unsaved edits', () => {
    expect(
      shouldReloadOnControllerChange({
        hadController: true,
        alreadyReloading: false,
        isNewBuild: true,
        hasUnsavedChanges: true,
      }),
    ).toBe(false);
  });
});
