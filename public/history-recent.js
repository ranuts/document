// "Continue last time" on the static landing pages.
//
// The landing pages ship no app bundle, but a recovery point nobody is told
// about is not a recovery: the common way back to this site is the homepage,
// the day after, with the editor tab long closed. Reading one metadata row out
// of IndexedDB costs a couple of kilobytes of plain script -- the same shape as
// open-local.js next door -- and gives that visit a way back to the work.
//
// Bytes are never touched here, only the row: the file name, when it changed,
// and whether it ever reached the disk. The DB/store names must stay in step
// with lib/history/db.ts, which owns the schema.
(function () {
  var DB_NAME = 'document-history';
  var STORE = 'docs';

  function readNewest(callback) {
    if (typeof indexedDB === 'undefined') return callback(null);
    var request;
    try {
      request = indexedDB.open(DB_NAME);
    } catch (error) {
      return callback(null);
    }
    // Never create or upgrade from here: a landing page that has never opened a
    // document should leave no database behind at all.
    request.onupgradeneeded = function () {
      try {
        request.transaction.abort();
      } catch (error) {
        /* the open below resolves with an error either way */
      }
      callback(null);
    };
    request.onerror = function () {
      callback(null);
    };
    request.onsuccess = function () {
      var db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.close();
        return callback(null);
      }
      try {
        var tx = db.transaction(STORE, 'readonly');
        var all = tx.objectStore(STORE).getAll();
        all.onsuccess = function () {
          var rows = all.result || [];
          rows.sort(function (a, b) {
            return b.updatedAt - a.updatedAt;
          });
          db.close();
          callback(rows[0] || null);
        };
        all.onerror = function () {
          db.close();
          callback(null);
        };
      } catch (error) {
        db.close();
        callback(null);
      }
    };
  }

  document.addEventListener('DOMContentLoaded', function () {
    var slot = document.querySelector('[data-recent-slot]');
    if (!slot) return;

    readNewest(function (doc) {
      if (!doc || !doc.id || !doc.title) return;

      var locale = slot.getAttribute('data-recent-locale') || '';
      var suffix = locale ? '&locale=' + encodeURIComponent(locale) : '';

      // Only the resume link is drawn here. The retention note and the link to
      // /history are in the served HTML: they are true whether or not this
      // browser is holding anything, and a promise about someone's data should
      // not depend on a script having run.
      var resume = document.createElement('a');
      resume.className = 'recent-resume';
      resume.href = '/editor?saved=' + encodeURIComponent(doc.id) + suffix;
      resume.textContent = (slot.getAttribute('data-recent-label') || 'Continue') + ' ' + doc.title;

      slot.appendChild(resume);
      slot.hidden = false;
    });
  });
})();
