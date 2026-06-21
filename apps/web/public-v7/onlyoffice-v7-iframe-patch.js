/**
 * OnlyOffice v7 iframe patch — injected into each editor iframe before SDK scripts.
 *
 * v7 SDK works without AscDesktopEditor (checks presence before using it), so we only
 * need one thing: rewrite ascdesktop://fonts/<file> XHR requests to /fonts/<mapped>.
 * Without this patch, all font XHR requests silently fail because browsers don't
 * support the ascdesktop:// scheme, and CJK characters (dates, Chinese text, etc.)
 * render as blank or garbled glyphs.
 */
(function () {
  // Fetch font map early — resolves well before SDK requests any fonts.
  var fontMap = {};
  fetch('/font-map.json')
    .then(function (r) { return r.json(); })
    .then(function (m) { delete m._comment; fontMap = m; })
    .catch(function () {});

  var FALLBACK = 'DejaVuSans.ttf';
  var origOpen = window.XMLHttpRequest.prototype.open;
  window.XMLHttpRequest.prototype.open = function (method, url) {
    if (typeof url === 'string') {
      if (url.indexOf('ascdesktop://fonts/') === 0) {
        var bs = String.fromCharCode(92); // backslash
        var fp = url.slice(19);
        var ls = Math.max(fp.lastIndexOf('/'), fp.lastIndexOf(bs));
        var fn = fp.slice(ls + 1).toLowerCase();
        arguments[1] = '/fonts/' + (fontMap[fn] || FALLBACK);
      } else if (url.indexOf('/fonts/') !== -1) {
        var fi = url.lastIndexOf('/fonts/') + 7;
        var fn2 = url.slice(fi).toLowerCase();
        if (fontMap[fn2]) arguments[1] = '/fonts/' + fontMap[fn2];
      }
    }
    return origOpen.apply(this, arguments);
  };
})();
