/**
 * OnlyOffice v7 iframe patch — injected into each editor iframe before SDK scripts.
 *
 * v7 SDK works without AscDesktopEditor (checks presence before using it), so we only
 * need one thing: rewrite font XHR requests to /fonts/<mapped>.
 *
 * v7 cell SDK requests fonts via two schemes observed in the wild:
 *   1. ascdesktop://fonts/<file>   — Desktop protocol (expected browser fallback)
 *   2. c:\Windows\Fonts\<file>    — Windows absolute path (when SDK detects non-Mac UA)
 *
 * Without this patch, both schemes silently fail in the browser, causing CJK characters
 * (dates, Chinese text, etc.) to render as blank or garbled glyphs (#62, #64).
 *
 * Paths are computed relative to this script's own URL so the patch works regardless
 * of the deployment base path (e.g. /document/ on GitHub Pages vs / locally).
 */
(function () {
  // Polyfill requestIdleCallback / cancelIdleCallback for Safari (#84).
  // The v7 SDK calls requestIdleCallback() bare (unprefixed) in several places
  // (word/cell/slide sdk-all-min.js). Older Safari has no such global, throwing
  // "ReferenceError: Can't find variable: requestIdleCallback" during init.
  // This runs in the iframe window before the SDK scripts load.
  if (typeof window.requestIdleCallback !== 'function') {
    window.requestIdleCallback = function (cb) {
      var start = Date.now();
      return window.setTimeout(function () {
        cb({
          didTimeout: false,
          timeRemaining: function () {
            return Math.max(0, 50 - (Date.now() - start));
          },
        });
      }, 1);
    };
    window.cancelIdleCallback = function (id) {
      window.clearTimeout(id);
    };
  }

  // Derive deployment root from this script's URL.
  // Script lives at <root>/onlyoffice-v7-iframe-patch.js, so strip the filename.
  var _base =
    document.currentScript && document.currentScript.src ? document.currentScript.src.replace(/[^/]+$/, '') : '/';

  // Fetch font map early — resolves well before SDK requests any fonts.
  var fontMap = {};
  fetch(_base + 'font-map.json')
    .then(function (r) {
      return r.json();
    })
    .then(function (m) {
      delete m._comment;
      fontMap = m;
    })
    .catch(function () {});

  var FALLBACK = 'NotoSansSC-VF.ttf';

  // Font remap is only needed in the SPREADSHEET (cell) editor, where v7's cell
  // SDK requests CJK fonts via ascdesktop:// / Windows paths that fail in the
  // browser (#62, #64). The Word and slide editors render text by glyph-ID
  // against the served font's glyph table; substituting a different TTF shifts
  // every glyph (Calibri style names / "Click to add title" → garbled). Letting
  // the request fail there makes the engine use its built-in glyph data, which is
  // correct. So: enable remap ONLY in the spreadsheet editor.
  var DISABLE_FONT_REMAP = window.location.pathname.indexOf('spreadsheeteditor') === -1;

  function extractFilename(path) {
    // Extract bare filename from any path (forward slash, backslash, or mixed)
    return path.split(/[/\\]/).pop().toLowerCase();
  }

  var origOpen = window.XMLHttpRequest.prototype.open;
  window.XMLHttpRequest.prototype.open = function (method, url) {
    if (!DISABLE_FONT_REMAP && typeof url === 'string') {
      var fn;
      if (url.indexOf('ascdesktop://fonts/') === 0) {
        // Scheme 1: ascdesktop://fonts/<file> or ascdesktop://fonts/C:\Windows\Fonts\<file>
        fn = extractFilename(url.slice(19));
        arguments[1] = _base + 'fonts/' + (fontMap[fn] || FALLBACK);
      } else if (/^[a-zA-Z]:[/\\]/.test(url)) {
        // Scheme 2: Windows absolute path like c:\Windows\Fonts\arial.ttf
        fn = extractFilename(url);
        arguments[1] = _base + 'fonts/' + (fontMap[fn] || FALLBACK);
      } else if (url.indexOf('/fonts/') !== -1) {
        // Remap already-relative /fonts/<file> requests via font-map
        fn = url.slice(url.lastIndexOf('/fonts/') + 7).toLowerCase();
        if (fontMap[fn]) arguments[1] = _base + 'fonts/' + fontMap[fn];
      }
    }
    return origOpen.apply(this, arguments);
  };

  // ── "Image from URL" (#72) ────────────────────────────────────────────────
  // AddImageUrl (word/cell/slide SDKs, toolbar "Insert > Image > From URL" and
  // the "paste an image with a link" clipboard path) hands external URLs to
  // AscCommon.G2. Absent a native/desktop host, G2 packages them into a
  // {c: 'imgurls', ...} command and expects a real OnlyOffice Document Server
  // to fetch them server-side (sidestepping the browser's CORS restrictions)
  // and post back local paths -- this project has no such server, so that
  // command has nowhere to go. The request it does fire ends up hitting this
  // very iframe's own origin with an unset download-callback path (observed:
  // GET .../documenteditor/main/undefined -> 404), and the image is silently
  // never inserted. Not a CORS problem (confirmed live: the target URL itself
  // fetches fine) -- a missing-server one. Replace G2 with a version that
  // fetches each URL directly from the browser instead of routing through the
  // absent server; this still respects CORS (a fetch to a CORS-blocked host
  // fails exactly as it would server-side-less anyway), it just stops paying
  // the tax of a request that could never have succeeded.
  function patchAddImageUrl() {
    var AC = window.AscCommon;
    if (!AC || typeof AC.G2 !== 'function') {
      setTimeout(patchAddImageUrl, 50);
      return;
    }
    if (AC.__g2Patched) return;
    AC.__g2Patched = true;
    AC.G2 = function (api, urls, callback) {
      Promise.all(
        urls.map(function (url) {
          return fetch(url)
            .then(function (resp) {
              if (!resp.ok) throw new Error('HTTP ' + resp.status);
              return resp.blob();
            })
            .then(function (blob) {
              var ext = (blob.type.split('/')[1] || 'png').split('+')[0].replace('jpeg', 'jpg');
              var name = 'image' + Date.now() + Math.random().toString(36).slice(2) + '.' + ext;
              return { url: URL.createObjectURL(blob), path: 'media/' + name };
            })
            .catch(function () {
              // Matches the shape G2's own native-editor/error branches already
              // produce -- callers (e.g. AddImageUrl) treat a literal 'error' URL
              // as "this one failed", which surfaces the SDK's own error UI
              // instead of silently doing nothing.
              return { url: 'error', path: 'error' };
            });
        }),
      ).then(callback);
    };
  }
  patchAddImageUrl();

  // ── AI button in OnlyOffice's left menu ───────────────────────────────────
  // The editor's left rail (#left-menu) is rendered at runtime by app.js with
  // icon buttons of class .btn-category (search, navigation, comments, ...).
  // We add a matching "AI" button there. It can't reach the agent panel (that
  // lives in the parent window), so clicking it posts `agent:toggle` upward.
  function injectAiButton() {
    if (document.getElementById('btn-ai')) return;
    // Put the AI button in the RIGHT menu — the same side the panel docks on, so
    // the trigger sits next to what it opens. Right-menu buttons are .btn-category
    // (with an `arrow-left` modifier + content-target) inside #right-menu.
    var sample = document.querySelector('#right-menu .btn-category');
    if (!sample || !sample.parentNode) return; // right menu not rendered yet
    var container = sample.parentNode;

    var btn = document.createElement(sample.tagName);
    btn.id = 'btn-ai';
    // Reuse the native button's classes for sizing/hover, minus transient state
    // and the arrow-left marker (those belong to OnlyOffice's own panel toggles).
    btn.className = sample.className
      .replace(/\b(active|disabled|arrow-left)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    btn.title = 'AI';
    btn.innerHTML = '<span class="agent-ai-label">AI</span>';
    btn.addEventListener('click', function () {
      // The agent panel lives in the top page. Same-origin: call its toggle
      // directly; fall back to postMessage if that's blocked.
      var top = window.top || window.parent;
      try {
        if (top && top.__toggleAgentPanel) {
          top.__toggleAgentPanel();
          return;
        }
      } catch (e) {
        /* cross-origin or not ready — fall through to postMessage */
      }
      top.postMessage({ type: 'agent:toggle' }, '*');
    });

    // Place it at the top of the right rail, above the first settings button.
    container.insertBefore(btn, sample);
  }

  function ensureAiButtonStyles() {
    if (document.getElementById('agent-ai-style')) return;
    var style = document.createElement('style');
    style.id = 'agent-ai-style';
    style.textContent =
      '#btn-ai{cursor:pointer;display:flex;align-items:center;justify-content:center;}' +
      '#btn-ai .agent-ai-label{font-weight:700;font-size:12px;letter-spacing:.5px;color:#444;}';
    (document.head || document.documentElement).appendChild(style);
  }

  // The AI button is opt-in: it only appears when the top page enabled the agent
  // feature (via ?agent=1). The top page (same-origin) exposes `__agentEnabled`;
  // if we can't read it (cross-origin embed) default to hidden.
  function agentEnabled() {
    try {
      var w = window.top || window.parent;
      return !!(w && w.__agentEnabled);
    } catch (e) {
      return false;
    }
  }

  function startAiButtonInjection() {
    if (!agentEnabled()) return; // no ?agent=1 → don't inject the AI button
    ensureAiButtonStyles();
    injectAiButton();
    // The left menu renders asynchronously and may re-render; keep the button
    // present by re-checking on DOM mutations.
    var obs = new MutationObserver(function () {
      injectAiButton();
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }

  // Reflect the panel's open/closed state on the AI button (the panel lives in
  // the top page and posts `agent:state` whenever it toggles).
  window.addEventListener('message', function (event) {
    if (!event.data || event.data.type !== 'agent:state') return;
    var btn = document.getElementById('btn-ai');
    if (btn) btn.classList.toggle('active', !!event.data.open);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startAiButtonInjection);
  } else {
    startAiButtonInjection();
  }
})();
