import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  type SwLike,
  SKIP_WAITING_MESSAGE,
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
const worker = (state = 'installed'): FakeWorker => {
  const w: FakeWorker = {
    state,
    postMessage: vi.fn<(msg: unknown) => unknown>(),
    listeners: [],
    addEventListener: (_t, cb) => {
      w.listeners.push(cb);
    },
  };
  return w;
};
const registration = (waiting: ReturnType<typeof worker> | null = null) => {
  const r = {
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

describe('shouldReloadOnControllerChange', () => {
  it('reloads once on an update with nothing open', () => {
    expect(
      shouldReloadOnControllerChange({ hadController: true, alreadyReloading: false, hasOpenDocument: false }),
    ).toBe(true);
  });
  it('does not reload on first install, twice, or with a document open', () => {
    expect(
      shouldReloadOnControllerChange({ hadController: false, alreadyReloading: false, hasOpenDocument: false }),
    ).toBe(false);
    expect(
      shouldReloadOnControllerChange({ hadController: true, alreadyReloading: true, hasOpenDocument: false }),
    ).toBe(false);
    expect(
      shouldReloadOnControllerChange({ hadController: true, alreadyReloading: false, hasOpenDocument: true }),
    ).toBe(false);
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
      put: vi.fn(),
      keys: () => Promise.resolve(entries.slice()),
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
      expect(build).toContain(`$DIST_DIR/${tree}`);
    }
    expect(src).toMatch(/const VENDOR_ASSET = \/\^\\\/\(\?:sdkjs\|web-apps\|fonts\)\\\/\//);
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
    for (const dir of ['sdkjs', 'web-apps', 'fonts']) {
      expect(script, dir).toContain(`"$DIST_DIR/${dir}"`);
    }
  });
});
