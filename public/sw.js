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
// x2t.wasm / sdk-all.js / font catalog were deleted lazy-loads the new
// build's copies into an old session (mixed versions), and avoiding that is
// why sw.js does not skipWaiting() on install. Key the cache by content and
// the overwhelmingly common deploy -- app code changed, vendor did not --
// shares one cache, deletes nothing, and is safe to activate at once.
const RUNTIME_CACHE = `document-editor-runtime-${VENDOR_VERSION}`;
const RUNTIME_PREFIX = 'document-editor-runtime-';
// Model providers and plugins share this origin's CacheStorage. Retire only
// our app caches, including the original single-cache versioned names.
const isOwnedAppCache = (name) =>
  name.startsWith('document-editor-core-') ||
  name.startsWith(RUNTIME_PREFIX) ||
  /^document-editor-(?:(?:dev-)?\d+|v\d+(?:\.\d+)*)$/.test(name);

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './editor',
  './editor.html',
  './manifest.json',
  './theme-presentation.js',
  './icons/document-light.svg',
  './icons/document-dark.svg',
  './icons/document-light-32.png',
  './icons/document-dark-32.png',
  './icons/document.svg',
  './icons/document-32.png',
  './icons/document-180.png',
  './icons/document-192.png',
  './icons/document-512.png',
  './icons/document-maskable-512.png',
];
const APP_ASSETS_TO_CACHE = []; // BUILD_APP_ASSETS
const EDITOR_BOOTSTRAP_HTML = [
  '/web-apps/apps/documenteditor/main/index.html',
  '/web-apps/apps/spreadsheeteditor/main/index.html',
  '/web-apps/apps/presentationeditor/main/index.html',
];

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
  /^\/(?:home|landing)\.css$|^\/(?:lang-switch|sw-register|open-local|landing-prefetch|history-recent|theme-presentation)\.js$|^\/ranui-iife\//;

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

// The editor route (`/editor`, `/editor.html`, either with a query string).
// Everything else this scope serves is a landing or content page, which holds
// no session an activation could spoil.
const EDITOR_ROUTE = /^\/editor(?:\.html)?\/?$/;
const isEditorWindow = (url) => {
  try {
    return EDITOR_ROUTE.test(new URL(url).pathname);
  } catch {
    return false;
  }
};

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

// Helper: store a response in the runtime cache, tolerating a full storage bucket.
// A rejected put must not take the response down with it -- the page already has its
// bytes and the next visit simply re-fetches, whereas an unhandled rejection here
// propagates into the respondWith chain and fails the request outright.
const putInRuntimeCache = (request, response) =>
  caches
    .open(RUNTIME_CACHE)
    .then((cache) => cache.put(request, response))
    .then(() => limitCacheSize(RUNTIME_CACHE, MAX_RUNTIME_ITEMS))
    .catch(() => {});

// Helper: Trim cache to a certain size
const limitCacheSize = (name, maxItems) => {
  return caches.open(name).then((cache) => {
    return cache.keys().then((keys) => {
      const excess = keys.length - maxItems;
      if (excess > 0) {
        // Evict an app asset before a vendor one. keys() is insertion-ordered,
        // so the plain keys[0] took the OLDEST entry -- which is precisely the
        // vendor tree, fetched during the first open of the session: the trim
        // would throw away x2t.wasm and the font catalog and leave a much
        // younger /assets/<hash> from a build nobody runs any more.
        // Return the full cleanup promise to waitUntil. One snapshot also
        // avoids reading all cache keys again for each excess entry.
        const victims = keys.filter((request) => !isVendorAsset(request)).concat(keys.filter(isVendorAsset));
        return Promise.all(victims.slice(0, excess).map((request) => cache.delete(request)));
      }
    });
  });
};

// The first navigation loads JS/CSS before a new worker can control it.
// Cache the current build's HTML dependencies during install as well as its shell.
async function precacheBootAssets(cache, vendor = false) {
  const assets = new Set();
  for (const path of vendor ? EDITOR_BOOTSTRAP_HTML : ['/index.html', '/editor.html']) {
    const page = await cache.match(new URL(path, self.location.origin).href);
    if (!page) throw new Error(`Missing offline shell: ${path}`);
    // Inline legacy code contains document.write strings for removed IE assets.
    // Preserve actual opening tags; do not interpret strings inside scripts.
    const html = (await page.text()).replace(/<script\b([^>]*)>[\s\S]*?<\/script>/gi, '<script$1></script>');
    for (const match of html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/g)) {
      const url = new URL(match[1], new URL(path, self.location.origin));
      if (url.origin !== self.location.origin) continue;
      if (vendor) {
        if (url.pathname.startsWith('/web-apps/') && /\.(js|css)$/.test(url.pathname)) assets.add(url.href);
        continue;
      }
      if (
        url.pathname.startsWith('/assets/') ||
        DEPLOY_COUPLED.test(url.pathname) ||
        /^\/ran-tokens\.[^/]+\.css$/.test(url.pathname) ||
        url.pathname === '/ran-fonts/fonts.css' ||
        url.pathname.startsWith('/ranui-iife/')
      )
        assets.add(url.href);
    }
  }
  if (assets.size) await cache.addAll([...assets]);
}

// Install event: Pre-cache core UI assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      // This entry is requested before the app can register its first worker.
      caches.open(RUNTIME_CACHE).then(async (cache) => {
        await cache.addAll([
          '/web-apps/apps/api/documents/api.js',
          '/sdkjs/common/AllFonts.js',
          // Font menus load these lazily, including when reopening a saved file.
          // Cache every locale/density variant so first use also works offline.
          ...['', '_ea'].flatMap((locale) =>
            ['', '@1.25x', '@1.5x', '@1.75x', '@2x'].map(
              (density) => `/sdkjs/common/Images/fonts_thumbnail${locale}${density}.png.bin`,
            ),
          ),
          '/web-apps/vendor/xregexp/xregexp-all-min.js',
          '/web-apps/vendor/socketio/socket.io.min.js',
          '/sdkjs/common/wasm/x2t/x2t_helper.js',
          // Export must work on the first offline save, before conversion has run.
          '/sdkjs/common/wasm/x2t/x2t.js',
          '/sdkjs/common/wasm/x2t/x2t.wasm.br',
          '/sdkjs/common/wasm/x2t/x2t.worker.js',
          ...EDITOR_BOOTSTRAP_HTML,
          ...EDITOR_BOOTSTRAP_HTML.map((path) => path.replace('/index.html', '/app.js')),
          ...EDITOR_BOOTSTRAP_HTML.map((path) => path.replace('/index.html', '/code.js')),
          ...EDITOR_BOOTSTRAP_HTML.flatMap((path) =>
            ['en', 'de', 'es', 'pt', 'ja', 'ko', 'zh'].map((language) =>
              path.replace('/index.html', `/locale/${language}.json`),
            ),
          ),
        ]);
        await precacheBootAssets(cache, true);
      }),
      caches.open(CORE_CACHE).then(async (cache) => {
        await cache.addAll([...ASSETS_TO_CACHE, ...APP_ASSETS_TO_CACHE]);
        await precacheBootAssets(cache);
      }),
      // Take over at once unless doing so would discard vendor assets an open
      // page of the outgoing build still needs (see wouldDiscardVendorAssets).
      // When it would, stay waiting: a page with a document open is
      // deliberately not reloaded on controllerchange, so its later lazy loads
      // (sdk-all.js, x2t.wasm, fonts, spellcheck) would come from the NEW
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
  // What this worker controls, for the landing page's promotion decision:
  // activation deletes this build's caches, and the window that cannot survive
  // that is an editor -- it may have a document open, and it is deliberately
  // not reloaded on controllerchange. `editors` is what the decision actually
  // needs; `count` stays in the reply for a worker-side change that has to be
  // readable by the page shipped before it (see public/sw-register.js).
  //
  // Which tabs are editors is knowable from the URL; whether they hold a
  // document is not, so any editor window counts against promotion. Another
  // LANDING tab does not -- it has nothing to lose, and blocking on it was
  // enough to leave a two-tab reader on an old build indefinitely.
  // Which build this worker is. A page cannot tell a NEW build waiting behind
  // it from its own build re-installed: the vendored editor registers a second
  // script into this scope from inside its iframe, which makes the scope's
  // script alternate and re-installs this one on the next load. Same versions
  // means same build, however many times it has been installed -- so the page
  // has something better to go on than "there is a worker waiting".
  if (event.data && event.data.type === 'VERSION') {
    const port = event.ports && event.ports[0];
    if (port) port.postMessage({ type: 'VERSION', cacheVersion: CACHE_VERSION, vendorVersion: VENDOR_VERSION });
  }
  if (event.data && event.data.type === 'CLIENT_COUNT') {
    const port = event.ports && event.ports[0];
    if (!port) return;
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        const editors = clients.filter((client) => isEditorWindow(client.url)).length;
        port.postMessage({ type: 'CLIENT_COUNT', count: clients.length, editors });
      }),
    );
  }
});

/**
 * Whether a cache about to be deleted is a runtime cache that has since
 * acquired vendor assets, with a window still open to use them.
 *
 * `wouldDiscardVendorAssets` is evaluated during install; activate runs after
 * it, and on a take-over-at-once deploy that is under live pages. In between,
 * a page of the outgoing build can write the first vendor entries into its own
 * runtime cache -- the install check saw an empty one and let us through, and
 * deleting it now is exactly the mixed-version state the check exists to
 * prevent. Asking again here costs one `keys()` per stale cache and closes all
 * but the microseconds between this read and the delete.
 *
 * Only deferred while a window is open: with none, nobody can be hurt and the
 * sweep should happen.
 */
const holdsVendorAssetsForOpenWindow = (cacheName) =>
  cacheName.startsWith(RUNTIME_PREFIX)
    ? self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
        if (!windows.length) return false;
        return caches
          .open(cacheName)
          .then((cache) => cache.keys())
          .then((keys) => keys.some(isVendorAsset))
          .catch(() => true);
      })
    : Promise.resolve(false);

// Activate event: Retire owned app caches from previous versions.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (isOwnedAppCache(cacheName) && cacheName !== CORE_CACHE && cacheName !== RUNTIME_CACHE) {
              return holdsVendorAssetsForOpenWindow(cacheName).then((keep) =>
                keep ? undefined : caches.delete(cacheName),
              );
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
// An isolated host also needs its cached iframe and Worker responses to carry
// the current policy. Reuse the body stream so large SDK assets are not copied.
let cachedShellPolicy;
async function isolationPolicyEnabled() {
  if (self.location.href && new URL(self.location.href).searchParams.get('isolation') === '1') return true;
  // A COEP editor embedded under a nonisolated parent still requires policy
  // on its native iframe. Its capability flag is false, so use our own shell
  // from this build's core cache, never another provider's cached response.
  if (!cachedShellPolicy) {
    cachedShellPolicy = Promise.resolve()
      .then(() =>
        caches.match(new URL('/editor.html', self.location.origin).href, { cacheName: CORE_CACHE, ignoreVary: true }),
      )
      .then(
        (shell) =>
          shell?.headers?.get?.('cross-origin-opener-policy') === 'same-origin' &&
          shell?.headers?.get?.('cross-origin-embedder-policy') === 'require-corp',
      )
      .catch(() => false)
      .then((enabled) => {
        // An early missing entry or a transient storage failure is not a
        // permanent policy decision. Share concurrent reads, retry later.
        if (!enabled) cachedShellPolicy = undefined;
        return enabled;
      });
  }
  return cachedShellPolicy;
}
async function withIsolationHeaders(response) {
  if (!response || response.status === 0 || !(await isolationPolicyEnabled())) return response;
  if (
    response.headers.get('cross-origin-opener-policy') === 'same-origin' &&
    response.headers.get('cross-origin-embedder-policy') === 'require-corp'
  )
    return response;
  const headers = new Headers(response.headers);
  headers.set('cross-origin-opener-policy', 'same-origin');
  headers.set('cross-origin-embedder-policy', 'require-corp');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const respondWith = (response) =>
    event.respondWith(
      Promise.resolve(response).then((resolved) => {
        // Pages canonicalizes application HTML. A cached followed redirect cannot
        // answer redirect:manual navigation; preserve our same-origin shell bytes.
        if (
          resolved?.redirected &&
          event.request.mode === 'navigate' &&
          (EDITOR_BOOTSTRAP_HTML.includes(url.pathname) || EDITOR_ROUTE.test(url.pathname)) &&
          new URL(resolved.url).origin === self.location.origin
        ) {
          resolved = new Response(resolved.body, {
            status: resolved.status,
            statusText: resolved.statusText,
            headers: resolved.headers,
          });
        }
        return withIsolationHeaders(resolved);
      }),
    );

  // 1. Only handle GET requests
  if (event.request.method !== 'GET') return;

  // 2. Only handle same-origin requests to avoid caching external APIs/documents
  if (url.origin !== self.location.origin) return;

  // Match Pages' canonical route offline too. Otherwise the cached root shell
  // would resolve its relative assets under /editor/ and render a blank page.
  if (event.request.mode === 'navigate' && url.pathname === '/editor/') {
    url.pathname = '/editor';
    event.respondWith(Response.redirect(url.href, 308));
    return;
  }

  // 3. Skip caching for requests with dynamic parameters (like ?file= or ?src=)
  // These are typically documents being edited, which should always be fresh.
  if (url.searchParams.has('file') || url.searchParams.has('src')) return;

  // 4. Skip font files — let the browser cache them natively to avoid SW
  // interception latency triggering Chrome's font-loading intervention, which
  // causes a crash in OnlyOffice v7.5's fallback font code path.
  if (/\.(ttf|woff2?|otf|eot)(\?.*)?$/.test(url.pathname) && !url.pathname.startsWith('/ran-fonts/')) return;

  // 4a. Skip the spellchecker engine: it is importScripts'd from inside a
  // dedicated worker during the editor's first boot, and routing that request
  // through a just-activated service worker hangs forever on a cold profile
  // (observed on every first visit: the request stays pending, the editor's
  // full API never finishes loading -- isLoadFullApi:false -- and every
  // save/export silently breaks). The browser's HTTP cache handles these.
  //
  // Must stay AHEAD of the vendor branch below, which would otherwise claim
  // /sdkjs/common/spell/ along with the rest of the tree.
  if (url.pathname.includes('/sdkjs/common/spell/')) return;

  // 4b. The vendored editor, served cache-first: the network is consulted only
  // when the entry is missing, so a warm cache puts nothing on the wire.
  //
  // Cache-first is correct here precisely BECAUSE the runtime cache is named
  // after the vendor content (see RUNTIME_CACHE): the cache name changes if
  // and only if any byte under sdkjs/ web-apps/ fonts/ changes -- our own
  // patches inside the tree included, since bin/build.sh hashes what it
  // serves. A stale entry is therefore not reachable: matching name implies
  // matching bytes, and a vendor change starts from an empty cache.
  //
  // The catalog and the x2t WASM were carved out into this branch first, after
  // stale-while-revalidate's `cache: 'no-cache'` revalidation re-downloaded
  // every multi-MB font on every open and a CJK deck sat on "Loading
  // presentation" for minutes on production. The rest of the tree had the same
  // disease in a milder form: measured on a warm profile, a second open of a
  // .docx still sent 46 requests for files it already held. SWR hid it well --
  // the revalidation happens after the cached copy is handed back, and it is
  // invisible to page-level request events -- but on a slow link it is 46
  // conditional requests competing with the ones that matter.
  if (isVendorAsset(event.request)) {
    respondWith(
      caches
        .open(RUNTIME_CACHE)
        .then((cache) => cache.match(event.request, { ignoreSearch: EDITOR_BOOTSTRAP_HTML.includes(url.pathname) }))
        .then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
              // waitUntil, not fire-and-forget: respondWith settles as soon as the
              // response is handed over, and a worker with no outstanding work may
              // be terminated right then -- taking a half-written entry with it.
              // The bigger the file the likelier that is, which is backwards: the
              // 13.7 MB SDK is the one entry most worth keeping. Surfaced as a CI
              // flake where the last file of a warm-up was missing from the cache.
              event.waitUntil(putInRuntimeCache(event.request, networkResponse.clone()));
            }
            return networkResponse;
          });
        }),
    );
    return;
  }

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
  const cachedNavigation = async () => {
    const exact = await caches.match(event.request);
    if (exact) return exact;
    // Local document ids live in the URL; the HTML shell is identical for them.
    // Limit the fallback to editor navigations and this build's core cache.
    if (event.request.mode === 'navigate' && EDITOR_ROUTE.test(url.pathname)) {
      const core = await caches.open(CORE_CACHE);
      return core.match(new URL('/editor.html', self.location.origin).href);
    }
    return undefined;
  };

  if (isNetworkFirst) {
    // Strategy: Network-First for HTML/navigation and for deploy-coupled assets.
    // `cache: 'no-cache'` forces revalidation with the server instead of
    // accepting a possibly-stale HTTP-cache copy — a stale HTML references
    // hashed assets that no longer exist after a deploy (the exact broken
    // state this rewrite fixes). Offline still falls back to the SW cache.
    respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .then((networkResponse) => {
          // If network is ok, cache and return
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            // waitUntil for the same reason as the branches above: nothing else
            // keeps the worker alive once the response has been handed over.
            event.waitUntil(caches.open(CORE_CACHE).then((cache) => cache.put(event.request, responseToCache)));
            return networkResponse;
          }
          // If status is not 200, try cache
          return cachedNavigation().then((cached) => cached || networkResponse);
        })
        .catch(() => {
          // If fetch fails (offline), try cache
          return cachedNavigation();
        }),
    );
  } else {
    // Strategy: Stale-While-Revalidate for other static assets (JS, CSS, Images)
    respondWith(
      // Public build outputs have identical bytes for every Origin. A preview
      // server may add Vary: Origin; HTML-precache requests and module-script
      // requests then differ even though they address the same immutable file.
      caches
        .match(event.request, { ignoreVary: isHashedAsset || url.pathname.startsWith('/ran-fonts/') })
        .then((cachedResponse) => {
          // `cache: 'no-cache'` on the revalidation too: without it this fetch can be served
          // from the browser's HTTP cache, so the "revalidate" half of stale-while-revalidate
          // never actually reaches the server and the entry can never converge.
          const fetchPromise = fetch(event.request, { cache: 'no-cache' })
            .then((networkResponse) => {
              // Only cache valid 200 responses
              if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                // Same reasoning as the vendor branch above: the revalidation half of
                // stale-while-revalidate runs after the cached copy was handed back,
                // so nothing else is keeping the worker alive to finish the write.
                event.waitUntil(putInRuntimeCache(event.request, networkResponse.clone()));
              } else if (isHashedAsset && networkResponse && networkResponse.status === 404) {
                // A hashed asset that 404s means the page HTML is from another
                // deploy. Surface a network error (never an HTML body) so the
                // browser reports a clean failure, and refresh the cached shell
                // so the next navigation picks up the current HTML.
                event.waitUntil(
                  caches.open(CORE_CACHE).then((cache) =>
                    fetch('./index.html', { cache: 'no-cache' }).then((fresh) => {
                      if (fresh && fresh.status === 200) {
                        return Promise.all([cache.put('./index.html', fresh.clone()), cache.put('./', fresh)]);
                      }
                      return undefined;
                    }),
                  ),
                );
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
