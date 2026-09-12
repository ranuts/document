/**
 * x2t in a realm we can throw away.
 *
 * x2t declares a 283 MB initial heap and the module measures ~340 MB after an
 * open (test/e2e/wasm-memory.spec.ts). In the editor frame that heap is
 * resident for the life of the frame: x2t.js is an unwrapped classic script, so
 * `wasmMemory` / `HEAPU8` are properties of the frame's global and nothing can
 * drop them. `X2TConverter.prototype.destroy` exists and only clears a JS
 * reference.
 *
 * Here it is transient. The frame proxies `AscCommon.x2t`'s two conversion
 * methods to this worker (lib/onlyoffice/guards/x2t-worker.ts), and terminating
 * the worker tears the whole realm down -- heap included -- between
 * conversions. Conversion also stops blocking the frame's main thread.
 *
 * The conversion code itself is not reimplemented here. x2t_helper.js is loaded
 * as-is and branches on `typeof document` in the three places that differ
 * (script loading, fonts, download). Two definitions of what a conversion is
 * would drift, and that file is where every format code, the doc/xls/ppt
 * two-step, the PDF-changes merge and the exit-code classification live.
 */
/* global importScripts, AscCommon */
'use strict';

importScripts('x2t_helper.js');

// The instance x2t_helper.js creates on import, with its paths pinned to this
// worker's own directory: the defaults are relative to the editor frame's
// document, which is not where this script lives.
var converter = AscCommon.x2t;
converter.SCRIPT_PATH = new URL('x2t.js', self.location.href).href;
converter.WASM_PATH = new URL('x2t.wasm.br', self.location.href).href;

/**
 * Media crosses as bytes in both directions. Blob URLs are realm-bound in
 * practice and the frame is the side that has to hold them, so it mints them
 * from what comes back (see readMediaFiles in x2t_helper.js).
 */
function transferablesOf(result) {
  var transfer = [];
  var seen = new Set();
  var add = function (value) {
    if (!value) return;
    var buffer = value instanceof ArrayBuffer ? value : value.buffer;
    if (buffer instanceof ArrayBuffer && !seen.has(buffer)) {
      seen.add(buffer);
      transfer.push(buffer);
    }
  };
  add(result && result.binary);
  var media = (result && result.media) || {};
  for (var key in media) {
    if (Object.prototype.hasOwnProperty.call(media, key)) add(media[key] && media[key].bytes);
  }
  return transfer;
}

var OPERATIONS = {
  convertToBin: function (payload) {
    return converter.convertToBin(payload.data, payload.fileName, payload.fileExt);
  },
  convertFromBin: function (payload) {
    return converter.convertFromBin(payload.request);
  },
};

self.onmessage = function (event) {
  var message = event.data || {};
  var id = message.id;
  var operation = OPERATIONS[message.op];

  if (!operation) {
    self.postMessage({ id: id, ok: false, error: 'Unknown x2t worker operation: ' + message.op });
    return;
  }

  // The list of fonts this conversion needs is frame state (which faces the
  // open document flagged NeedStyles), so it arrives with every request. Only
  // the list: the worker fetches the files itself off the same cache, which is
  // what keeps the boundary cheap -- the bytes are 4.6 MB for a trivial Latin
  // document and 25.4 MB for a CJK PDF export.
  converter.setFontSources(message.fonts || []);

  Promise.resolve()
    .then(function () {
      return operation(message.payload || {});
    })
    .then(function (result) {
      self.postMessage({ id: id, ok: true, result: result }, transferablesOf(result));
    })
    .catch(function (error) {
      // Message text only: a host classifies open failures on it
      // (lib/onlyoffice/open-failure.ts) and an Error does not survive
      // structured clone with its prototype intact anyway.
      self.postMessage({ id: id, ok: false, error: (error && error.message) || String(error) });
    });
};

self.postMessage({ ready: true });
