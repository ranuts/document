// Intent-triggered prefetch for the static homepage: hovering / focusing an
// Open / New CTA starts pulling the editor engine (loader, app shell, SDK) so
// the click that follows lands on a warm cache. Same URL list and rules as
// lib/prefetch.ts (which serves the FAB menu inside /editor); kept in plain JS
// because the landing page ships no bundle. Skipped on Save-Data / 2G.
(function () {
  var APP = { docx: 'documenteditor', xlsx: 'spreadsheeteditor', pptx: 'presentationeditor' };
  var SDK = { docx: 'word', xlsx: 'cell', pptx: 'slide' };
  var LOADER = '/web-apps/apps/api/documents/api.js';
  var requested = {};

  function allowed() {
    var c = navigator.connection;
    if (!c) return true;
    if (c.saveData) return false;
    return !(c.effectiveType === 'slow-2g' || c.effectiveType === '2g');
  }

  function urls(kind) {
    var list = [LOADER];
    if (kind && APP[kind]) {
      list.push('/web-apps/apps/' + APP[kind] + '/main/app.js');
      list.push('/sdkjs/' + SDK[kind] + '/sdk-all-min.js');
      list.push('/sdkjs/' + SDK[kind] + '/sdk-all.js');
    }
    return list;
  }

  function prefetch(kind) {
    if (!allowed()) return;
    urls(kind).forEach(function (href) {
      if (requested[href]) return;
      requested[href] = true;
      var link = document.createElement('link');
      link.rel = 'prefetch';
      link.setAttribute('as', 'script');
      link.href = href;
      document.head.appendChild(link);
    });
  }

  function arm(el, kind) {
    if (!el) return;
    var fired = false;
    function fire() {
      if (fired) return;
      fired = true;
      prefetch(kind);
    }
    ['pointerenter', 'focus', 'touchstart'].forEach(function (evt) {
      el.addEventListener(evt, fire, { passive: true, once: true });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    arm(document.getElementById('hero-open'));
    var nodes = document.querySelectorAll('[data-prefetch]');
    for (var i = 0; i < nodes.length; i++) arm(nodes[i], nodes[i].getAttribute('data-prefetch'));
  });
})();
