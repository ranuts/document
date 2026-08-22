// Warming the editor from the landing page, in two layers.
//
// Opening a document cold pulls ~34 MB: sdk-all.js alone is 13.7 MB, the font
// engine's wasm is 3.5 MB, the font catalog entries a session touches are
// another 2.5-18 MB depending on the format, and opening an EXISTING file adds
// the 9.4 MB x2t wasm. The landing page itself is 0.5 MB. So the first open is
// slow for a reason, and the page that precedes it sits idle the whole time.
//
// Layer 1 -- background, no intent needed. The part every format loads
// regardless of what the visitor opens: the API loader, the font engine, the
// four catalog entries all three editors pull, and the x2t wasm (the landing
// page's main call to action is opening an existing file). Measured, not
// guessed: see docs/explorations/2026-08-21-landing-prefetch-warmup.md.
//
// Layer 2 -- still background, once the core is done: every editor's shell and
// SDK, in order of how often each is opened. Their disk sizes (57 MB for all
// three) badly overstate the cost -- they are text, and compressed the three
// come to 11.95 MB. Declined outright when the origin has no storage room.
//
// Layer 3 -- intent. Hover / focus / touch on a CTA jumps that format's files
// to the front rather than waiting for its turn.
//
// Format-specific font catalog entries are deliberately NOT warmed: they range
// from 2.5 MB (xlsx) to 18 MB (pptx) and their indices move with the vendor.
// They load on demand and the service worker keeps them from a second visit on.
//
// Everything is requested with fetch() AFTER the service worker controls the
// page, so the bytes land in its cache rather than only in the HTTP cache --
// that is what makes the next visit free. Requests are serial and low priority
// so the warm-up never competes with the page the visitor is actually reading.
(function () {
  var APP = { docx: 'documenteditor', xlsx: 'spreadsheeteditor', pptx: 'presentationeditor' };
  var SDK = { docx: 'word', xlsx: 'cell', pptx: 'slide' };
  var LOADER = '/web-apps/apps/api/documents/api.js';

  // Shared by every open, in the order the editor asks for them, so a warm-up
  // cut short by a click has still fetched the things needed first.
  var CORE = [
    LOADER,
    '/sdkjs/common/libfont/engine/fonts.js',
    '/sdkjs/common/libfont/engine/fonts.wasm',
    // The catalog entries all three editors load. Measured across docx/xlsx/pptx;
    // test/e2e/landing-prefetch.spec.ts fails if that stops being true, which is
    // how a vendor bump that renumbers the catalog gets noticed.
    '/fonts/072',
    '/fonts/074',
    '/fonts/075',
    '/fonts/076',
    // Only needed to open an existing file, which is what the hero CTA does.
    '/sdkjs/common/wasm/x2t/x2t.wasm.gz',
  ];

  var requested = {};

  function conn() {
    return navigator.connection || null;
  }

  /** Intent-triggered prefetch: anything but data-saver or a 2G-class link. */
  function allowedOnIntent() {
    var c = conn();
    if (!c) return true;
    if (c.saveData) return false;
    return !(c.effectiveType === 'slow-2g' || c.effectiveType === '2g');
  }

  /**
   * Background warm-up is held to a higher bar than an intent-triggered one:
   * nobody asked for it, so it must not spend a metered or slow connection.
   * Unknown connection (Safari, Firefox) counts as allowed -- the API is
   * Chromium-only and refusing everywhere else would disable the feature for
   * most visitors.
   */
  function allowedInBackground() {
    var c = conn();
    if (!c) return true;
    if (c.saveData) return false;
    return c.effectiveType === '4g' || c.effectiveType === undefined;
  }

  /**
   * Fetch through the service worker so the response is stored in ITS cache.
   * A `<link rel=prefetch>` would only populate the HTTP cache, and the worker
   * serves the vendored tree cache-first -- a miss there re-requests the file
   * even when the browser still holds a copy.
   */
  function warm(url) {
    if (requested[url]) return Promise.resolve();
    requested[url] = true;
    return fetch(url, { credentials: 'same-origin', priority: 'low' })
      .then(drain)
      .catch(function () {
        // A warm-up failure must stay invisible: the real load will just be cold.
        // Allow a retry later rather than poisoning the URL for the session.
        requested[url] = false;
      });
  }

  /**
   * Read the response to the end, and throw the bytes away.
   *
   * This is not optional. The worker caches these by cloning the response and
   * putting the clone, and a clone of a stream nobody reads can be discarded
   * before the copy finishes -- so `cache.put` never completes. Measured with
   * this missing: of the eight core files, the two small ones landed in the
   * cache and the six large ones (the 3.5 MB font engine, the catalog entries,
   * the 9.4 MB x2t wasm) did not, which is exactly backwards from what the
   * warm-up is for. Draining by reader rather than arrayBuffer() so a 9.4 MB
   * file is not held in memory just to be dropped.
   */
  function drain(response) {
    if (!response || !response.body || typeof response.body.getReader !== 'function') {
      return response && typeof response.arrayBuffer === 'function' ? response.arrayBuffer() : undefined;
    }
    var reader = response.body.getReader();
    return (function pump() {
      return reader.read().then(function (result) {
        return result.done ? undefined : pump();
      });
    })();
  }

  /** One at a time: a warm-up that saturates the connection is not a warm-up. */
  function warmSerially(urls) {
    return urls.reduce(function (chain, url) {
      return chain.then(function () {
        return warm(url);
      });
    }, Promise.resolve());
  }

  function formatUrls(kind) {
    if (!kind || !APP[kind]) return [];
    return [
      '/web-apps/apps/' + APP[kind] + '/main/app.js',
      '/web-apps/apps/' + APP[kind] + '/main/code.js',
      '/sdkjs/' + SDK[kind] + '/sdk-all-min.js',
      '/sdkjs/' + SDK[kind] + '/sdk-all.js',
    ];
  }

  function prefetchOnIntent(kind) {
    if (!allowedOnIntent()) return;
    warmSerially([LOADER].concat(formatUrls(kind)));
  }

  function arm(el, kind) {
    if (!el) return;
    var fired = false;
    function fire() {
      if (fired) return;
      fired = true;
      prefetchOnIntent(kind);
    }
    ['pointerenter', 'focus', 'touchstart'].forEach(function (evt) {
      el.addEventListener(evt, fire, { passive: true, once: true });
    });
  }

  var idle =
    window.requestIdleCallback ||
    function (fn) {
      return setTimeout(fn, 1500);
    };

  // Every editor, warmed after the shared core. Ordered by how often each is
  // opened, so a visitor who clicks mid-warm-up is most likely to find theirs
  // already done.
  //
  // On disk these are 57 MB and that number is misleading: they are text, and
  // the wire carries them compressed. Measured -- docx 3.92 MB, xlsx 4.29 MB,
  // pptx 3.74 MB, 11.95 MB for all three, against 18.79 / 20.52 / 18.04 MB raw.
  // Warming all three is a fraction of what the disk sizes suggest, which is
  // why this is worth doing rather than betting on one format.
  var ENGINES = ['docx', 'xlsx', 'pptx'];

  // Roughly what the cache ends up holding, uncompressed, plus room for the
  // font entries a session pulls on demand. Used only to decline gracefully on
  // a device that has no space for it.
  var ESTIMATED_BYTES_NEEDED = 120 * 1024 * 1024;

  /**
   * Decline when the origin has no room. Cache.put failures are already
   * swallowed by the worker, so a full bucket would not break anything -- it
   * would just mean spending a visitor's bandwidth on bytes that get evicted
   * immediately. Unknown quota counts as room: the API is not everywhere, and
   * refusing without evidence would disable the warm-up for those browsers.
   */
  function hasRoom() {
    if (!navigator.storage || typeof navigator.storage.estimate !== 'function') return Promise.resolve(true);
    return navigator.storage
      .estimate()
      .then(function (est) {
        if (!est || !est.quota) return true;
        return est.quota - (est.usage || 0) > ESTIMATED_BYTES_NEEDED;
      })
      .catch(function () {
        return true;
      });
  }

  /**
   * Core first, then every editor. Serial throughout: the point is to use the
   * time the visitor spends reading, not to compete with them for bandwidth.
   * Each step waits for an idle moment of its own, so a page that is busy
   * (a click, a scroll, the theme switch) does not queue work behind itself.
   */
  function warmEverything() {
    return [CORE].concat(ENGINES.map(formatUrls)).reduce(function (chain, urls) {
      return chain.then(function () {
        return new Promise(function (resolve) {
          idle(function () {
            warmSerially(urls).then(resolve, resolve);
          });
        });
      });
    }, Promise.resolve());
  }

  /**
   * Start the background layer once the worker is in charge. Without a worker
   * (first visit before it activates, or a browser without one) the bytes would
   * land only in the HTTP cache, so warming would not deliver what it promises;
   * `ready` resolves after activation, and sw.js claims clients on activate, so
   * on a first visit this simply starts a moment later.
   */
  function startBackgroundWarmUp() {
    if (!allowedInBackground()) return;
    if (!navigator.serviceWorker) return;
    navigator.serviceWorker.ready
      .then(hasRoom)
      .then(function (room) {
        if (room) warmEverything();
      })
      .catch(function () {
        /* no worker, no warm-up */
      });
  }

  document.addEventListener('DOMContentLoaded', function () {
    arm(document.getElementById('hero-open'));
    var nodes = document.querySelectorAll('[data-prefetch]');
    for (var i = 0; i < nodes.length; i++) arm(nodes[i], nodes[i].getAttribute('data-prefetch'));
    startBackgroundWarmUp();
  });

  // Test hook: the E2E suite drives the layers directly rather than simulating
  // hover and waiting on an idle callback.
  window.__landingPrefetch = {
    CORE: CORE,
    ENGINES: ENGINES,
    formatUrls: formatUrls,
    warmSerially: warmSerially,
    warmEverything: warmEverything,
  };
})();
