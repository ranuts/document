// Follow the effective ranui theme, including an explicit choice that differs
// from the OS. Runs after the no-flash restore and before stylesheets paint.
(function () {
  var root = document.documentElement;
  var system = window.matchMedia('(prefers-color-scheme: dark)');
  var icon = document.querySelector('link[rel="icon"][type="image/svg+xml"]');
  var png = document.querySelector('link[rel="icon"][type="image/png"]');
  var iconBase = icon && new URL('./', icon.href);
  var colors = document.querySelectorAll('meta[name="theme-color"]');
  var color = colors[0];
  if (color) color.removeAttribute('media');
  for (var i = 1; i < colors.length; i++) colors[i].remove();

  function effectiveTheme() {
    var theme = root.getAttribute('data-ran-theme');
    if (theme === 'light' || theme === 'dark') return theme;
    try {
      theme = localStorage.getItem('ran-theme');
      if (theme === 'light' || theme === 'dark') return theme;
    } catch {}
    return system.matches ? 'dark' : 'light';
  }

  function sync() {
    var theme = effectiveTheme();
    root.style.colorScheme = theme;
    if (color) {
      var value = theme === 'dark' ? '#000000' : '#ffffff';
      if (color.content !== value) color.content = value;
    }
    if (iconBase) {
      var svgUrl = new URL('document-' + theme + '.svg', iconBase).href;
      var pngUrl = new URL('document-' + theme + '-32.png', iconBase).href;
      if (icon.href !== svgUrl) icon.href = svgUrl;
      if (png && png.href !== pngUrl) png.href = pngUrl;
    }
  }

  sync();
  var observer = new MutationObserver(sync);
  observer.observe(root, { attributes: true, attributeFilter: ['data-ran-theme'] });
  // ranui's theme switch also writes theme-color; keep both writers aligned
  // when it restores a remembered color on a return to system mode.
  if (color) observer.observe(color, { attributes: true, attributeFilter: ['content'] });
  system.addEventListener('change', sync);
})();
