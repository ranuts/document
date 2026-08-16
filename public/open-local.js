// Shared "open a local file" wiring for the static landing pages (e.g. the
// zh-CN homepage), mirroring the app homepage's "Open a file" CTA. Static pages
// don't ship the app bundle, so the picked file is stashed in IndexedDB and the
// app (loaded via `?open=local`) picks it up on boot — see lib/pending-open.ts,
// which owns the same DB/store/key names. Everything stays on-device.
//
// Usage: <r-button data-open-local="/editor?locale=zh-CN&open=local">…</r-button>
// The attribute value is the app URL to navigate to after stashing the file.
(function () {
  var DB_NAME = 'document-handoff';
  var STORE = 'files';
  var KEY = 'pending';

  function stashFile(file) {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        req.result.createObjectStore(STORE);
      };
      req.onerror = function () {
        reject(req.error);
      };
      req.onsuccess = function () {
        var db = req.result;
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(file, KEY);
        tx.oncomplete = function () {
          db.close();
          resolve();
        };
        tx.onerror = function () {
          db.close();
          reject(tx.error);
        };
      };
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var buttons = document.querySelectorAll('[data-open-local]');
    if (!buttons.length) return;

    var input = document.createElement('input');
    input.type = 'file';
    // Keep in sync with the app's picker (lib/document.ts).
    input.accept = '.docx,.xlsx,.pptx,.doc,.xls,.ppt,.csv,.pdf';
    input.style.display = 'none';
    document.body.appendChild(input);

    var targetHref = '/editor?open=local';

    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        targetHref = btn.getAttribute('data-open-local') || targetHref;
        input.value = '';
        input.click();
      });
    });

    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (!file) return;
      stashFile(file)
        .then(function () {
          location.href = targetHref;
        })
        .catch(function () {
          // IndexedDB unavailable (e.g. some private-browsing modes): fall back
          // to the app homepage where the user can pick the file again.
          location.href = targetHref.replace(/([?&])open=local(&?)/, function (_m, sep, tail) {
            return tail ? sep : '';
          });
        });
    });
  });
})();
