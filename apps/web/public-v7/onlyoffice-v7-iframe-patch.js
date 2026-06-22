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
  // Derive deployment root from this script's URL.
  // Script lives at <root>/onlyoffice-v7-iframe-patch.js, so strip the filename.
  var _base = (document.currentScript && document.currentScript.src)
    ? document.currentScript.src.replace(/[^/]+$/, '')
    : '/';

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

  function extractFilename(path) {
    // Extract bare filename from any path (forward slash, backslash, or mixed)
    return path.split(/[/\\]/).pop().toLowerCase();
  }

  var origOpen = window.XMLHttpRequest.prototype.open;
  window.XMLHttpRequest.prototype.open = function (method, url) {
    if (typeof url === 'string') {
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
})();
