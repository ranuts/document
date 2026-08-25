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

  /** Put one value under the handoff key, resolving when the write commits. */
  function put(value) {
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
        try {
          tx.objectStore(STORE).put(value, KEY);
        } catch (error) {
          db.close();
          reject(error);
          return;
        }
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

  // The bytes plus the three fields a File carries that the app needs back.
  // Read lazily -- see stashFile.
  function toRecord(file) {
    return file.arrayBuffer().then(function (buffer) {
      return {
        name: file.name,
        type: file.type,
        lastModified: file.lastModified,
        bytes: new Uint8Array(buffer),
      };
    });
  }

  /** Read back whatever is under the handoff key. */
  function get() {
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
        var read = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
        read.onsuccess = function () {
          db.close();
          resolve(read.result);
        };
        read.onerror = function () {
          db.close();
          reject(read.error);
        };
      };
    });
  }

  /**
   * Hand the picked file to the app, by reference where that is possible.
   *
   * The File goes in first because storing it costs nothing: it is a reference
   * to bytes already on disk, and the app opens it with createObjectURL
   * without ever reading it into memory. Only if the store will not keep a
   * File is the document read -- doing that unconditionally would put a stall
   * between the file dialog and the navigation for every visitor, and on a
   * large enough file `arrayBuffer()` rejects, landing on the exact empty
   * editor this is here to prevent.
   *
   * The write is CONFIRMED rather than trusted, because "it did not throw" is
   * not the same as "the file is in there". Safari refuses loudly -- it cannot
   * structured-clone a File or a Blob into IndexedDB, and it says so by
   * accepting the put and then failing the transaction with a null error,
   * which is what left the handoff silently broken there: the landing page
   * took its "IndexedDB unavailable" fallback and the visitor arrived at an
   * empty editor holding nothing of what they had just picked. An engine that
   * refuses QUIETLY, keeping an empty object where the File went, would
   * reproduce the same symptom past any check of the write alone. Reading a
   * reference back costs nothing.
   *
   * lib/pending-open.ts reads both shapes back.
   */
  function stashBytes(file) {
    return toRecord(file).then(put);
  }

  function stashFile(file) {
    // Two-argument `then`, not `.catch`: a `.catch` hung off the end would
    // also catch the fallback failing and run it a second time, reading the
    // document into memory twice over on the one path where memory is already
    // the thing going wrong.
    return put(file)
      .then(get)
      .then(
        function (stored) {
          return stored instanceof Blob ? undefined : stashBytes(file);
        },
        function () {
          return stashBytes(file);
        },
      );
  }

  // Test hook: test/unit/pending-open-handoff.test.ts drives the stash and
  // reads it back through lib/pending-open.ts, which is the only way the two
  // halves of the record shape stay pinned to each other.
  window.__openLocal = { stashFile: stashFile, DB_NAME: DB_NAME, STORE: STORE, KEY: KEY };

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
