const CACHE_VERSION = 'SW_VERSION_PLACEHOLDER'.includes('PLACEHOLDER') ? 'dev-' + Date.now() : 'SW_VERSION_PLACEHOLDER';
// Two caches: core (precached shell + HTML) survives trimming; runtime holds
// the long tail (OnlyOffice sdkjs/web-apps assets — hundreds of files, so the
// old single 100-item cache was constantly evicting its own shell).
const CORE_CACHE = `document-editor-core-${CACHE_VERSION}`;
const RUNTIME_CACHE = `document-editor-runtime-${CACHE_VERSION}`;
const ASSETS_TO_CACHE = ['./', './index.html', './manifest.json', './img/64.png'];

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
const DEPLOY_COUPLED = /^\/(?:home|landing)\.css$|^\/(?:lang-switch|onlyoffice-v7-iframe-patch)\.js$|^\/ranui-iife\//;

const MAX_RUNTIME_ITEMS = 600;

// Helper: Trim cache to a certain size
const limitCacheSize = (name, maxItems) => {
  caches.open(name).then((cache) => {
    cache.keys().then((keys) => {
      if (keys.length > maxItems) {
        cache.delete(keys[0]).then(() => limitCacheSize(name, maxItems));
      }
    });
  });
};

// Install event: Pre-cache core UI assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CORE_CACHE).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }),
  );
  self.skipWaiting();
});

// Activate event: Clean up caches from every previous version
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CORE_CACHE && cacheName !== RUNTIME_CACHE) {
            return caches.delete(cacheName);
          }
        }),
      );
    }),
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
