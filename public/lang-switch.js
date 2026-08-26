// Remembers the language the reader picks from the switcher in the header.
//
// The switcher itself needs no script: it is a disclosure button (ranui's
// <r-popover>) over a list of real <a href> links, so choosing a language is an
// ordinary navigation — middle-clickable, copyable, and crawlable. All this file
// adds is the cookie.
//
// The cookie exists because the static pages carry their language in the URL but
// /editor and /history are one app that reads its language from, in order:
// ?locale=, this cookie, localStorage, and the browser. Without it, picking
// 日本語 on the homepage and then opening the saved-documents page landed the
// reader back in English — the choice existed only as the path they happened to
// be standing on.
//
// Listeners go on the links themselves rather than on the document, because
// <r-popover> stops click propagation at its panel: the panel is portalled to
// <body> and a document-level delegate never hears about it. Moving a node does
// not disturb its listeners, so binding before the portal happens is fine.
document.addEventListener('DOMContentLoaded', function () {
  var links = document.querySelectorAll('a.lang-option[hreflang]');
  for (var i = 0; i < links.length; i++) {
    links[i].addEventListener('click', remember);
  }
});

function remember(event) {
  var locale = event.currentTarget.getAttribute('hreflang');
  if (!locale) return;
  try {
    document.cookie = 'locale=' + encodeURIComponent(locale) + ';path=/;max-age=31536000;samesite=lax';
  } catch (e) {
    /* cookies disabled: the URL still carries the language */
  }
  // Deliberately no preventDefault — the link navigates on its own, which is
  // the point of it being a link.
}
