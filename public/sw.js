const CACHE_VERSION = 'SW_VERSION_PLACEHOLDER'.includes('PLACEHOLDER') ? 'dev-' + Date.now() : 'SW_VERSION_PLACEHOLDER';
// Content hash of the vendor trees (sdkjs / web-apps / fonts), injected by
// bin/build.sh. Deliberately NOT the build version: see RUNTIME_CACHE.
const VENDOR_VERSION = 'VENDOR_VERSION_PLACEHOLDER'.includes('PLACEHOLDER') ? 'dev' : 'VENDOR_VERSION_PLACEHOLDER';
// Two caches: core (precached shell + HTML) survives trimming; runtime holds
// the long tail (OnlyOffice sdkjs/web-apps assets — hundreds of files, so the
// old single 100-item cache was constantly evicting its own shell).
const CORE_CACHE = `document-editor-core-${CACHE_VERSION}`;
// Keyed by the vendor content, not by the build. This is what makes a deploy
// able to take over immediately: activate() deletes every cache that is not
// one of these two, so while the runtime cache carried the build version,
// EVERY deploy would have discarded the outgoing build's vendor assets --
// which is dangerous only when they actually differ. An open editor whose
// x2t.wasm.gz / sdk-all.js / font catalog were deleted lazy-loads the new
// build's copies into an old session (mixed versions), and avoiding that is
// why sw.js does not skipWaiting() on install. Key the cache by content and
// the overwhelmingly common deploy -- app code changed, vendor did not --
// shares one cache, deletes nothing, and is safe to activate at once.
const RUNTIME_CACHE = `document-editor-runtime-${VENDOR_VERSION}`;
const RUNTIME_PREFIX = 'document-editor-runtime-';

const ASSETS_TO_CACHE = ['./', './index.html', './editor', './editor.html', './manifest.json', './img/64.png'];

// Unhashed but deploy-coupled: stable filenames whose *content* changes every deploy.
// Mirrors the group public/_headers pins to `Cache-Control: no-cache` — keep the two in sync.
//
// ran-tokens.css is deliberately NOT here any more: bin/build.sh fingerprints it
// (ran-tokens.<hash>.css), so a new build is a new URL and a stale copy is impossible. It
// takes the stale-while-revalidate path with every other immutable asset, which is both
// correct and faster.
//
// These must NOT use stale-while-revalidate. SWR hands back the cached copy first and
// refreshes in the background, so the deploy that changes a design token renders with the
// previous one and only corrects itself on the *next* load. Worse, the background refresh
// used a plain `fetch`, which the browser may answer from its own HTTP disk cache — the
// stale bytes then get written back into the SW cache, and the old copy survives deploy
// after deploy. (Symptom: `200 OK (from disk cache)` for a deploy-coupled file long after
// its content changed.) Network-first with `cache: 'no-cache'` is what the HTML branch already
// does, for exactly the same reason.
const DEPLOY_COUPLED =
  /^\/(?:home|landing)\.css$|^\/(?:lang-switch|sw-register|open-local|landing-prefetch)\.js$|^\/ranui-iife\//;

// The OnlyOffice 9 tree is ~2600 files, but most of that is per-locale help
// and on-demand font duplication a single session in one language never
// touches -- a full proportional scale-up would over-reserve. Starting
// estimate, not a measured figure; tune against real session traces.
const MAX_RUNTIME_ITEMS = 2000;

// The trees bin/build.sh hashes into VENDOR_VERSION, i.e. everything the
// runtime cache is named after and exists to keep. Everything ELSE in there
// belongs to one app build (/assets/<hash>) and dies with it.
const VENDOR_ASSET = /^\/(?:sdkjs|web-apps|fonts)\//;
const isVendorAsset = (request) => VENDOR_ASSET.test(new URL(request.url).pathname);

/**
 * Whether activating now would throw away vendor assets some still-open page
 * of the outgoing build might need.
 *
 * Asks what the other runtime caches CONTAIN, not what they are called. The
 * name is not enough, in both directions:
 *
 * - A visitor who only ever saw the landing page still has a runtime cache
 *   (the fingerprinted token CSS, the Geist face list, open-local.js,
 *   landing-prefetch.js all take the stale-while-revalidate path), and
 *   `pruneAppAssets` empties such a cache without removing it. By name alone
 *   that empty shell reads as "there are vendor assets to lose" for the rest
 *   of the site's life.
 * - On the deploy that introduces this scheme, the outgoing cache is still
 *   named after the BUILD, so its name necessarily differs from ours -- and
 *   that is the very deploy on which the client-count handshake in
 *   public/sw-register.js cannot work either, because the worker it has to ask
 *   never shipped a CLIENT_COUNT handler. Both mechanisms failing at once is
 *   what would have left the #144 fix undeliverable until every tab closed.
 *
 * Unreadable cache counts as "something to lose": waiting is the safe answer.
 */
const wouldDiscardVendorAssets = (cacheNames) =>
  Promise.all(
    cacheNames
      .filter((name) => name.startsWith(RUNTIME_PREFIX) && name !== RUNTIME_CACHE)
      .map((name) =>
        caches
          .open(name)
          .then((cache) => cache.keys())
          .then((keys) => keys.some(isVendorAsset))
          .catch(() => true),
      ),
  ).then((holdsVendorAssets) => holdsVendorAssets.some(Boolean));

/**
 * Drop the outgoing app build's entries from the runtime cache.
 *
 * Naming the cache after the vendor content (see RUNTIME_CACHE) is what lets a
 * deploy activate without discarding sdkjs / web-apps / fonts -- but it also
 * means nothing clears the cache any more, and the app half of it is dead the
 * moment a build ships: /assets/<hash> URLs no deploy will ever request again.
 * Left alone they accumulate deploy after deploy against MAX_RUNTIME_ITEMS,
 * and the trim would then start evicting the multi-MB vendor binaries the
 * cache-first branch was added to protect. Their replacements are one
 * revalidation each, and a deploy re-fetches them anyway.
 *
 * Skipped entirely while a window of this scope is open, and that gate is the
 * whole reason this is safe. Since a vendor-unchanged deploy now takes over
 * during install, activate() runs under live pages -- and an editor with a
 * document open is deliberately NOT reloaded on controllerchange. Deleting
 * /assets/<hash> under it removes the last copy that exists anywhere: the new
 * deployment does not serve the retired build's filenames, so its next lazy
 * `import()` (the agent panel, the pending-open handoff) gets the 404 branch
 * below and the feature simply never loads. Nothing is lost by waiting: the
 * dead entries are trimmed vendor-last by limitCacheSize meanwhile, and the
 * next activation with no window open does the sweep.
 *
 * Asks `has` before `open` because `open` CREATES: conjuring an empty runtime
 * cache here would be one more thing for the next deploy to inspect.
 */
const pruneAppAssets = (name) =>
  self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    if (windows.length) return undefined;
    return caches.has(name).then((exists) => {
      if (!exists) return undefined;
      return caches
        .open(name)
        .then((cache) =>
          cache
            .keys()
            .then((keys) =>
              Promise.all(keys.filter((request) => !isVendorAsset(request)).map((request) => cache.delete(request))),
            ),
        );
    });
  });

// Helper: Trim cache to a certain size
const limitCacheSize = (name, maxItems) => {
  caches.open(name).then((cache) => {
    cache.keys().then((keys) => {
      if (keys.length > maxItems) {
        // Evict an app asset before a vendor one. keys() is insertion-ordered,
        // so the plain keys[0] took the OLDEST entry -- which is precisely the
        // vendor tree, fetched during the first open of the session: the trim
        // would throw away x2t.wasm.gz and the font catalog and leave a much
        // younger /assets/<hash> from a build nobody runs any more.
        const victim = keys.find((request) => !isVendorAsset(request)) || keys[0];
        cache.delete(victim).then(() => limitCacheSize(name, maxItems));
      }
    });
  });
};

// Install event: Pre-cache core UI assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(CORE_CACHE).then((cache) => {
        return cache.addAll(ASSETS_TO_CACHE);
      }),
      // Take over at once unless doing so would discard vendor assets an open
      // page of the outgoing build still needs (see wouldDiscardVendorAssets).
      // When it would, stay waiting: a page with a document open is
      // deliberately not reloaded on controllerchange, so its later lazy loads
      // (sdk-all.js, x2t.wasm.gz, fonts, spellcheck) would come from the NEW
      // build and run mixed with the old one. Somebody then has to ask for the
      // switch -- public/sw-register.js on the landing page, or lib/sw-update.ts
      // once no document is open, or simply every tab of the site closing.
      caches
        .keys()
        .then(wouldDiscardVendorAssets)
        .then((wouldDiscard) => {
          if (!wouldDiscard) self.skipWaiting();
        }),
    ]),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  // How many windows this worker controls. The landing page asks before it
  // promotes a waiting worker: activation deletes this build's caches, and it
  // cannot see whether another tab is an editor with a document open, so it
  // only promotes when the answer is "just you" (public/sw-register.js).
  if (event.data && event.data.type === 'CLIENT_COUNT') {
    const port = event.ports && event.ports[0];
    if (!port) return;
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        port.postMessage({ type: 'CLIENT_COUNT', count: clients.length });
      }),
    );
  }
});

// Activate event: Clean up caches from every previous version
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CORE_CACHE && cacheName !== RUNTIME_CACHE) {
              return caches.delete(cacheName);
            }
          }),
        );
      })
      // The runtime cache can be one we inherited from the previous build (same
      // vendor content, different app code), and nothing else ever clears it.
      .then(() => pruneAppAssets(RUNTIME_CACHE)),
  );
  self.clients.claim();
});

// Fetch event: Strategy-based resource handling
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Only handle GET requests
  if (event.request.method !== 'GET') return;

  // 2. Only handle same-origin requests to avoid caching external APIs/documents
  if (url.origin !== self.location.origin) return;

  // 3. Skip caching for requests with dynamic parameters (like ?file= or ?src=)
  // These are typically documents being edited, which should always be fresh.
  if (url.searchParams.has('file') || url.searchParams.has('src')) return;

  // 4. Skip font files — let the browser cache them natively to avoid SW
  // interception latency triggering Chrome's font-loading intervention, which
  // causes a crash in OnlyOffice v7.5's fallback font code path.
  if (/\.(ttf|woff2?|otf|eot)(\?.*)?$/.test(url.pathname)) return;

  // 4a. The editor's indexed font catalog (/fonts/000..266, no extension) and
  // the x2t WASM are large, immutable, vendor-versioned binaries. They used to
  // fall through to stale-while-revalidate below, whose `cache: 'no-cache'`
  // revalidation re-downloaded every multi-MB font on every open; with the
  // SDK loading fonts serially, a CJK deck sat on "Loading presentation" for
  // minutes on production. Serve them cache-first: the network is consulted
  // only when the entry is missing.
  const isImmutableBinary = /^\/fonts\/\d{3}$/.test(url.pathname) || url.pathname.endsWith('/x2t.wasm.gz');
  if (isImmutableBinary) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(event.request, responseToCache);
              limitCacheSize(RUNTIME_CACHE, MAX_RUNTIME_ITEMS);
            });
          }
          return networkResponse;
        });
      }),
    );
    return;
  }

  // 4b. Skip the spellchecker engine: it is importScripts'd from inside a
  // dedicated worker during the editor's first boot, and routing that request
  // through a just-activated service worker hangs forever on a cold profile
  // (observed on every first visit: the request stays pending, the editor's
  // full API never finishes loading -- isLoadFullApi:false -- and every
  // save/export silently breaks). The browser's HTTP cache handles these.
  if (url.pathname.includes('/sdkjs/common/spell/')) return;

  // 5. Determine Strategy
  const isHtml =
    event.request.mode === 'navigate' ||
    url.pathname.endsWith('.html') ||
    url.pathname === '/' ||
    url.pathname.endsWith('/');

  // Hashed build outputs (/assets/index-<hash>.css|js). Their filenames change
  // on every deploy, so a stale HTML + missing asset = broken page. Treat any
  // non-OK answer for them as an error instead of handing an HTML 404 fallback
  // to the CSS/JS parser ("Refused to apply style… MIME type text/html").
  const isHashedAsset = url.pathname.startsWith('/assets/');

  // Same strategy as HTML: these files must match the HTML of the current deploy.
  const isNetworkFirst = isHtml || DEPLOY_COUPLED.test(url.pathname);

  if (isNetworkFirst) {
    // Strategy: Network-First for HTML/navigation and for deploy-coupled assets.
    // `cache: 'no-cache'` forces revalidation with the server instead of
    // accepting a possibly-stale HTTP-cache copy — a stale HTML references
    // hashed assets that no longer exist after a deploy (the exact broken
    // state this rewrite fixes). Offline still falls back to the SW cache.
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .then((networkResponse) => {
          // If network is ok, cache and return
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CORE_CACHE).then((cache) => {
              cache.put(event.request, responseToCache);
            });
            return networkResponse;
          }
          // If status is not 200, try cache
          return caches.match(event.request).then((cached) => cached || networkResponse);
        })
        .catch(() => {
          // If fetch fails (offline), try cache
          return caches.match(event.request);
        }),
    );
  } else {
    // Strategy: Stale-While-Revalidate for other static assets (JS, CSS, Images)
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        // `cache: 'no-cache'` on the revalidation too: without it this fetch can be served
        // from the browser's HTTP cache, so the "revalidate" half of stale-while-revalidate
        // never actually reaches the server and the entry can never converge.
        const fetchPromise = fetch(event.request, { cache: 'no-cache' })
          .then((networkResponse) => {
            // Only cache valid 200 responses
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
              const responseToCache = networkResponse.clone();
              caches.open(RUNTIME_CACHE).then((cache) => {
                cache.put(event.request, responseToCache);
                limitCacheSize(RUNTIME_CACHE, MAX_RUNTIME_ITEMS);
              });
            } else if (isHashedAsset && networkResponse && networkResponse.status === 404) {
              // A hashed asset that 404s means the page HTML is from another
              // deploy. Surface a network error (never an HTML body) so the
              // browser reports a clean failure, and refresh the cached shell
              // so the next navigation picks up the current HTML.
              caches.open(CORE_CACHE).then((cache) => {
                fetch('./index.html', { cache: 'no-cache' }).then((fresh) => {
                  if (fresh && fresh.status === 200) {
                    cache.put('./index.html', fresh.clone());
                    cache.put('./', fresh);
                  }
                });
              });
              return Response.error();
            }
            return networkResponse;
          })
          .catch(() => {
            return cachedResponse;
          });

        return cachedResponse || fetchPromise;
      }),
    );
  }
});
