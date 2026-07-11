/* Theme switch shared by the app homepage and every static satellite page.
   Mirrors ranui's utils/theme.ts convention without needing the full bundle:
   localStorage key `ran-theme` holds 'light' | 'dark' | 'system'; forcing a
   theme sets BOTH `data-ran-theme` and `theme` attributes on <html> (what
   ran-tokens.css matches); 'system' removes them so the prefers-color-scheme
   media query in the token layer takes over natively — no matchMedia glue.
   The companion no-flash snippet in each page's <head> applies the stored
   value before first paint; this file only wires the footer buttons. */
(function () {
  var KEY = 'ran-theme';
  var root = document.documentElement;

  function stored() {
    try {
      var t = localStorage.getItem(KEY);
      return t === 'light' || t === 'dark' ? t : 'system';
    } catch (e) {
      return 'system';
    }
  }

  function apply(theme) {
    if (theme === 'light' || theme === 'dark') {
      root.setAttribute('data-ran-theme', theme);
      root.setAttribute('theme', theme);
    } else {
      root.removeAttribute('data-ran-theme');
      root.removeAttribute('theme');
    }
    syncMeta(theme);
  }

  /* Keep the browser chrome (address bar / PWA title bar) in step when a
     theme is forced; in 'system' the media-qualified metas already match. */
  function syncMeta(theme) {
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < metas.length; i++) {
      var media = metas[i].getAttribute('media') || '';
      if (theme === 'system') {
        metas[i].setAttribute('content', media.indexOf('dark') !== -1 ? '#000000' : '#ffffff');
      } else {
        metas[i].setAttribute('content', theme === 'dark' ? '#000000' : '#ffffff');
      }
    }
  }

  function reflect(theme) {
    var buttons = document.querySelectorAll('.theme-switch [data-theme-choice]');
    for (var i = 0; i < buttons.length; i++) {
      var pressed = buttons[i].getAttribute('data-theme-choice') === theme;
      buttons[i].setAttribute('aria-pressed', pressed ? 'true' : 'false');
    }
  }

  function set(theme) {
    try {
      localStorage.setItem(KEY, theme);
    } catch (e) {
      /* private mode: still apply for this page view */
    }
    apply(theme);
    reflect(theme);
  }

  function init() {
    var current = stored();
    reflect(current);
    var switches = document.querySelectorAll('.theme-switch');
    for (var i = 0; i < switches.length; i++) {
      switches[i].addEventListener('click', function (event) {
        var target = event.target;
        while (target && target !== this && !target.getAttribute('data-theme-choice')) {
          target = target.parentElement;
        }
        if (target && target !== this) set(target.getAttribute('data-theme-choice'));
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
