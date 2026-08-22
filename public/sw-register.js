/**
 * Service-worker registration and update promotion for the landing pages.
 *
 * sw.js calls skipWaiting() on install only when activating cannot discard
 * vendor assets an open page still needs (see wouldDiscardVendorAssets in
 * public/sw.js); otherwise the new worker waits, because activating it deletes
 * the previous build's caches and a page still running the old build would
 * then lazy-load pieces of the new one (sdk-all.js, x2t.wasm.gz, fonts) into an
 * old session. So for that case something has to ask for the switch, and
 * lib/sw-update.ts was written to do it "when no document is open".
 *
 * That promotion had no home left. The route split (2026-08-16) moved the
 * landing page to `/`, which ships no editor bundle, so lib/sw-update.ts now
 * only ever runs on `/editor` -- where the open is kicked off *before* the
 * registration resolves, leaving `hasOpenDocument()` true every time. A
 * waiting worker was therefore never promoted in normal use: users kept the
 * old build until they closed every tab of the site. `/zh-CN/` did not even
 * register a worker.
 *
 * This is the missing half, and the landing page is the right place for it:
 * it has no document, so promoting here cannot corrupt a session of its own.
 * The one case it must still refuse is another tab that does have a document
 * open, which the page cannot see -- so it asks the active worker what it
 * controls and only promotes when no window is on the editor route. Another
 * landing tab is not a reason to refuse: it has nothing to lose, and treating
 * every second window as a possible editor left a reader who keeps two tabs of
 * the site open on an old build for good.
 *
 * Plain JS on purpose: the landing pages ship no bundle. `__createSwUpdater`
 * is exposed so test/unit/sw-register.test.ts drives this file rather than a
 * copy of it (sw-routing.test.ts has to keep such a copy in sync by hand, and
 * that is exactly the drift worth avoiding here).
 */
(function (global) {
  'use strict';

  /** Absolute, not './sw.js': from /zh-CN/ a relative URL would scope the worker to /zh-CN/. */
  var SW_URL = '/sw.js';
  var CLIENT_COUNT_TIMEOUT_MS = 1000;

  function createSwUpdater(nav, options) {
    var timeoutMs = (options && options.timeoutMs) || CLIENT_COUNT_TIMEOUT_MS;

    /**
     * What the active worker controls: `{ count, editors }`. Resolves to null
     * when there is nobody to ask or the answer does not arrive -- callers
     * treat that as "unknown" and leave the worker waiting.
     */
    function countClients() {
      return new Promise(function (resolve) {
        var controller = nav.serviceWorker.controller;
        if (!controller) {
          resolve(null);
          return;
        }
        var channel = new MessageChannel();
        var settled = false;
        var done = function (value) {
          if (settled) return;
          settled = true;
          resolve(value);
        };
        channel.port1.onmessage = function (event) {
          var data = event.data;
          done(data && typeof data.count === 'number' ? data : null);
        };
        global.setTimeout(function () {
          done(null);
        }, timeoutMs);
        try {
          controller.postMessage({ type: 'CLIENT_COUNT' }, [channel.port2]);
        } catch (error) {
          done(null);
        }
      });
    }

    /**
     * Promote the waiting worker, but not while another tab is on the editor
     * route: activation wipes the outgoing build's caches, and such a tab may
     * have a document open and is deliberately not reloaded when the new
     * worker takes control.
     *
     * `editors` is missing from the reply of a worker deployed before it
     * existed; there the old, blunter reading applies -- promote only when
     * this tab is the only window at all.
     */
    function maybePromote(registration) {
      var waiting = registration.waiting;
      if (!waiting) return Promise.resolve(false);
      // Not every waiting worker is one of ours. The vendored editor registers
      // its own (`/document_editor_service_worker.js`, an empty stub) into the
      // same scope from inside the editor iframe, so a visitor who has opened
      // the editor leaves one waiting here. Promoting THAT hands the origin to
      // an empty worker and the vendor tree stops being served cache-first.
      // SW_URL is the reference, not registration.active: right after a
      // reload `active` can still be null, and "nothing to compare with" must
      // not be read as "it is ours".
      if (waiting.scriptURL && waiting.scriptURL.indexOf(SW_URL, waiting.scriptURL.length - SW_URL.length) === -1) {
        return Promise.resolve(false);
      }
      return countClients().then(function (answer) {
        if (!answer) return false;
        var blocked = typeof answer.editors === 'number' ? answer.editors > 0 : answer.count > 1;
        if (blocked) return false;
        waiting.postMessage({ type: 'SKIP_WAITING' });
        return true;
      });
    }

    /**
     * Promote once this worker finishes installing.
     *
     * `statechange` only fires for transitions from here on, so a worker that
     * is ALREADY installed has to be handled directly -- and so does a null
     * one, which means the transition happened before we looked and the worker
     * has moved on to `registration.waiting`. Missing either of those is
     * missing the whole point of this file: nothing else would promote it for
     * the rest of the page's life.
     */
    function watchInstalling(registration, worker) {
      if (!worker || worker.state === 'installed') {
        void maybePromote(registration);
        return;
      }
      worker.addEventListener('statechange', function () {
        if (worker.state === 'installed') void maybePromote(registration);
      });
    }

    /** Promote a worker that is already waiting, installing, or yet to be found. */
    function wire(registration) {
      void maybePromote(registration);
      // `updatefound` for an update found during registration itself can fire
      // before this listener exists, so pick up an in-flight install too.
      if (registration.installing) watchInstalling(registration, registration.installing);
      registration.addEventListener('updatefound', function () {
        watchInstalling(registration, registration.installing);
      });
    }

    function start() {
      return nav.serviceWorker.register(SW_URL).then(wire, function () {
        // Registration is best-effort: the landing page works without it.
      });
    }

    return { start: start, wire: wire, maybePromote: maybePromote, countClients: countClients };
  }

  global.__createSwUpdater = createSwUpdater;

  if (global.navigator && 'serviceWorker' in global.navigator) {
    global.addEventListener('load', function () {
      void createSwUpdater(global.navigator).start();
    });
  }
})(window);
