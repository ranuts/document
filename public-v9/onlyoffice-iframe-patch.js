/**
 * OnlyOffice iframe patch — injected into each editor iframe before any SDK scripts.
 *
 * Provides six things that OnlyOffice's Web/Desktop-oriented SDK needs to run
 * against a purely static host with no document server behind it:
 *   1. window.AscDesktopEditor  — native OS file-dialog & I/O polyfill
 *   2. AddImageUrl remote-URL resolution — "Insert > Image > From URL" (#72):
 *      once AscDesktopEditor exists, the SDK swaps in a synchronous AddImageUrl
 *      that can't resolve raw http(s) URLs on its own (see the patch itself for
 *      the full mechanism); pre-resolve them via DownloadFiles first, and bypass
 *      the collaborative-editing-lock check (Cf(1)) that uHa's insert branch is
 *      gated behind -- meaningless in a single-user, no-server session.
 *   3. XHR font URL rewrite     — ascdesktop://fonts/ → /fonts/<mapped>
 *   4. Engine.IO/Socket.IO XHR mock — fakes the collaboration-server handshake the
 *      SDK's socket.io client makes to /doc/{id}/c/, so it settles into "connected,
 *      no server" instead of retrying forever. There is no dev-server middleware
 *      equivalent to fall back on here (this file runs unchanged in production),
 *      so the mock has to be complete on its own. Also blocks the client's separate
 *      real WebSocket connection attempt to the same endpoint -- left unblocked,
 *      its repeated failures leak an unpaired start/end-action nesting counter
 *      that eventually blocks ALL document edits, including plain typing (not
 *      just the collaboration-lock-gated cases in item 2). A low-frequency
 *      watchdog clamps that counter back to 0 if it ever gets stuck via some
 *      other, still-unidentified leak site -- this SDK is too large to find
 *      and patch every individual one. The same watchdog also clears the status
 *      bar's "数据加载中" label when it's stuck with nothing actually pending --
 *      a different symptom of the same class of problem.
 *   5. Image URL redirect       — /media/…/image.png → parent.__mediaCache blob URL,
 *      both for on-screen <img src> and for the SDK's own exporter, which fetches
 *      each embedded image via a real XHR GET to /media/<file> when building the
 *      saved .docx/.xlsx/.pptx zip.
 *   6. Style-gallery CJK caption overlay (word editor only) — the paragraph
 *      style-gallery dropdown's preview icons are drawn by the SDK's own internal
 *      glyph renderer, which silently drops CJK glyphs (Latin letters/digits still
 *      render); overlay each icon's correct caption ourselves with the browser's
 *      native, unaffected canvas text APIs instead of trying to fix the SDK's
 *      internal renderer.
 *
 * Dialog suppression (Common.UI.alert/.warning) is handled from onlyoffice-editor.ts
 * via same-origin iframe access in onAppReady; the below is a defence-in-depth fallback.
 */
(function () {
  console.log('[OO patch] running in', window.location.href);

  // Derive deployment root from this script's URL so the patch works regardless
  // of the base path (e.g. /document/9.3.0/ on GitHub Pages vs / locally).
  var _base = (document.currentScript && document.currentScript.src)
    ? document.currentScript.src.replace(/[^/]+$/, '')
    : '/';

  // ── 1. Font map (fetched early; will resolve before SDK requests any fonts) ────
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

  // ── 2. AscDesktopEditor polyfill ────────────────────────────────────────────────
  // OnlyOffice SDK assumes it runs inside the Desktop App, which provides
  // window.AscDesktopEditor for native OS operations.  We supply browser-native
  // equivalents so toolbar actions (Insert Image, Insert Video, etc.) work.
  (function installAscDesktopEditor() {
    if (window.AscDesktopEditor) return;
    var _map = {},
      _seq = 0;

    function pickFile(acc, multi, cb) {
      var inp = document.createElement('input');
      inp.type = 'file';
      inp.multiple = !!multi;
      if (acc) inp.accept = acc;
      inp.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;';
      document.body.appendChild(inp);
      function done() {
        try {
          document.body.removeChild(inp);
        } catch (e) {}
      }
      inp.addEventListener('change', function () {
        done();
        var files = inp.files;
        if (!files || !files.length) return;
        var paths = [];
        for (var i = 0; i < files.length; i++) {
          var f = files[i],
            key = 'asc-local-' + ++_seq + '-' + f.name;
          _map[key] = { url: URL.createObjectURL(f), file: f };
          paths.push(key);
        }
        cb(multi ? paths : paths[0]);
      });
      inp.addEventListener('cancel', done);
      inp.click();
    }

    function filterToAccept(f) {
      if (f === 'images')
        return 'image/png,image/jpeg,image/gif,image/bmp,image/tiff,image/webp,image/svg+xml,.png,.jpg,.jpeg,.gif,.bmp,.tif,.tiff,.webp,.svg';
      if (f === 'video') return 'video/*,.mp4,.webm,.avi,.mov,.mkv,.wmv,.m4v';
      if (f === 'audio') return 'audio/*,.mp3,.wav,.ogg,.aac,.m4a,.wma,.flac';
      if (f === 'word') return '.docx,.doc,.odt,.rtf,.txt';
      if (f === 'cell') return '.xlsx,.xls,.ods,.csv';
      return '';
    }

    function getUrl(k) {
      var e = _map[k];
      return e ? e.url : k;
    }
    function noop() {}
    function noopFalse() {
      return false;
    }
    function noopEmpty() {
      return '';
    }
    function noopArr() {
      return [];
    }

    window.AscDesktopEditor = {
      // File dialogs
      OpenFilenameDialog: function (f, m, cb) {
        pickFile(filterToAccept(f), m, cb);
      },
      LocalFileGetImageUrl: function (k) {
        return getUrl(k);
      },
      LocalFileGetImageUrlCorrect: function (k, cb) {
        var u = getUrl(k);
        if (typeof cb === 'function') cb(u);
        return u;
      },
      AddVideo: function (k, cb) {
        var e = _map[k];
        if (typeof cb === 'function') cb(e ? 0 : 1, e ? { url: e.url, name: e.file.name } : null);
      },
      AddAudio: function (k, cb) {
        var e = _map[k];
        if (typeof cb === 'function') cb(e ? 0 : 1, e ? { url: e.url, name: e.file.name } : null);
      },

      // Local file management
      onDocumentModifiedChanged: noop,
      LocalFileSave: function () {
        setTimeout(function () {
          if (typeof window.DesktopOfflineAppDocumentEndSave === 'function')
            window.DesktopOfflineAppDocumentEndSave(0, null, null);
        }, 0);
      },
      LocalFileSaveChanges: noop,
      LocalFileGetOpenChangesCount: function () {
        return 0;
      },
      LocalFileGetSaved: noopFalse,
      LocalFileGetSourcePath: noopEmpty,
      LocalFileGetRelativePath: noopFalse,
      LocalStartOpen: noop,

      // word SDK: download remote URLs and return {url: localBlobKey} map
      DownloadFiles: function (urls, _extra, cb) {
        if (!urls || !urls.length) {
          if (typeof cb === 'function') cb({});
          return;
        }
        var result = {},
          done = 0,
          total = urls.length;
        urls.forEach(function (url) {
          fetch(url, { mode: 'cors' })
            .then(function (r) {
              return r.ok ? r.blob() : Promise.reject(r.status);
            })
            .then(function (blob) {
              var name = (url.split('/').pop() || 'file').split('?')[0];
              var key = 'asc-dl-' + ++_seq + '-' + name;
              _map[key] = { url: URL.createObjectURL(blob), file: new File([blob], name) };
              result[url] = key;
            })
            .catch(function () {
              result[url] = '';
            })
            .then(function () {
              if (++done === total && typeof cb === 'function') cb(result);
            });
        });
      },

      // UI / system integration stubs
      SetAdvancedOptions: noop,
      SetDocumentName: noop,
      SetFullscreen: noop,
      SetLocalRestrictions: noop,
      SaveQuestion: function (cb) {
        if (typeof cb === 'function') cb(0);
      },
      CheckNeedWheel: noopFalse,
      CheckUserId: noop,
      GetDropFiles: noopArr,
      GetOpenedFile: noopEmpty,
      GetSupportedScaleValues: function () {
        return [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.5, 4, 4.5, 5];
      },
      NativeViewerOpen: noop,
      SetPdfCloudPrintFileInfo: noop,
      IsCachedPdfCloudPrintFileInfo: noopFalse,

      // SDK init — app.js calls execCommand synchronously on load before onAppReady.
      // Missing this crashes SDK init; LocalFileRecents is called right after.
      execCommand: noop,
      LocalFileRecents: noopArr,

      // sdk-all-min.js: AscDesktopEditor && AscDesktopEditor.CreateEditorApi(this)
      // Registers the Asc API object with the Desktop host; safe noop in browser.
      CreateEditorApi: noop,

      // Crypto / signatures
      buildCryptedEnd: noop,
      buildCryptedStart: noop,
      CryptoMode: 0,
      Crypto_GetLocalImageBase64: function (p, cb) {
        if (typeof cb === 'function') cb('');
      },
      PreloadCryptoImage: noop,
      GetEncryptedHeader: function () {
        return 'ENCRYPTED;';
      },
      GetDefaultCertificate: function () {
        return null;
      },
      SelectCertificate: noop,
      Sign: noop,
      RemoveAllSignatures: noop,
      RemoveSignature: noop,
      IsProtectionSupport: noopFalse,
      IsSignaturesSupport: noopFalse,
      ViewCertificate: noop,
      isBlockchainSupport: noopFalse,

      // Fonts / images
      GetFontThumbnailHeight: function () {
        return 0;
      },
      getDictionariesPath: noopEmpty,
      GetImageBase64: function () {
        return '';
      },
      GetImageFormat: noopEmpty,
      GetImageOriginalSize: function () {
        return { W: 0, H: 0 };
      },
      IsImageFile: function (p) {
        return /\.(png|jpe?g|gif|bmp|tiff?|webp|svg)$/i.test(String(p));
      },
      IsFilePrinting: noopFalse,
      IsLocalFile: noopFalse,
      IsLocalFileExist: noopFalse,
      LoadFontBase64: function (n, cb) {
        if (typeof cb === 'function') cb('');
      },
      LoadJS: noop,

      // Media / plugins
      IsSupportMedia: noopFalse,
      isSupportNetworkFunctionality: noopFalse,
      isSupportPlugins: noopFalse,
      isSupportMacroses: noopFalse,
      // JSON string with 2 entries — SDK does JSON.parse(GetInstallPlugins())[0].url
      GetInstallPlugins: function () {
        return '[{"url":"","pluginsData":[]},{"url":"","pluginsData":[]}]';
      },
      PluginInstall: noop,
      PluginUninstall: noop,

      // Printing
      Print: noop,
      Print_Start: noop,
      Print_Page: noop,
      Print_End: noop,
      emulateCloudPrinting: noop,

      // Collaboration / reporting
      CallInAllWindows: noop,
      CallMediaPlayerCommand: noop,
      sendSystemMessage: noop,
      sendFromReporter: noop,
      sendToReporter: noop,
      startReporter: noop,
      endReporter: noop,

      // Document operations
      CompareDocumentFile: noop,
      CompareDocumentUrl: noop,
      MergeDocumentFile: noop,
      MergeDocumentUrl: noop,
      OpenWorkbook: noop,
      OpenFileCrypt: noop,
      openExternalReference: noop,
      convertFile: noop,
      startExternalConvertation: noop,
      ResaveFile: noop,
      RemoveFile: noop,
      OnSave: noop,
      onDocumentContentReady: noop,
      onFileLockedClose: noop,
      loadLocalFile: noop,
      SpellCheck: noop,
      getEngineVersion: noopEmpty,
    };
    console.log('[OO] AscDesktopEditor polyfill installed');
  })();

  // ── 3. Image insert (URL + local file) via the Desktop-mode AddImageUrl override (#72) ─

  // The SDK detects window.AscDesktopEditor (the polyfill above) and, at init time,
  // replaces AddImageUrl on the editor instance's prototype with a version that
  // resolves each URL *synchronously* -- confirmed live via chrome-devtools MCP:
  //   function(a,b,d,e){a=a.map(f=>AscCommon.Ys.KS(AscDesktopEditor.LocalFileGetImageUrl(f)));this.uHa(a,e)}
  // Two compounding problems, both confirmed by instrumenting every step live:
  //   1. LocalFileGetImageUrl(url) only recognizes keys OpenFilenameDialog/
  //      DownloadFiles generated (_map[key]) and passes any other string straight
  //      through unresolved -- a raw http(s) URL comes back unchanged. Not a CORS
  //      problem (the target URL itself was confirmed to fetch fine), a
  //      synchronous-API-can't-fetch-asynchronously one.
  //   2. Even after DownloadFiles resolves a URL to a real local key (see the
  //      first attempt at this fix, superseded below), LocalFileGetImageUrl(key)
  //      correctly returns a `blob:` URL for it -- but Ys.KS() unconditionally
  //      *prepends* '/media/' onto whatever it's given, assuming its input is
  //      always a bare filename, not a full URL. Observed live:
  //      Ys.KS('blob:http://host/2dd6...') -> '/media/blob:http://host/2dd6...',
  //      a nonsense path -- not "/media/<filename>", which is the one shape our
  //      own image-URL-redirect patch (section 6 below) knows how to resolve via
  //      window.parent.__mediaCache. uHa() (the method that actually commits the
  //      image into the document) receives that garbage path and silently drops
  //      it: no error, no image, nothing in the saved file's word/media/.
  //
  // v7 has the same first-layer bug (AscCommon.G2, see onlyoffice-v7-iframe-
  // patch.js) but reaches it via a different path (a real Document Server round-
  // trip with a missing callback URL) since v7 has no AscDesktopEditor polyfill
  // to trigger this Desktop-mode branch at all -- v9's *second* layer (Ys.KS's
  // '/media/' assumption) has no v7 equivalent.
  //
  // Fix: don't route through the broken LocalFileGetImageUrl -> Ys.KS chain at
  // all. Fetch remote URLs via the already-working DownloadFiles; register the
  // result directly into window.parent.__mediaCache under the exact
  // 'media/<key>' path our own section-6 redirect reads from (the same
  // convention Ys.KS would have produced for a *bare filename* input -- we're
  // just doing that step ourselves instead of routing a blob: URL through it by
  // mistake), and call uHa() directly with that path already resolved.
  //
  // 2026-08-09 update: local files ("Insert Image" -> pick a file, not "Image
  // from URL") hit this exact same bug and were NOT covered by the original
  // fix above -- the key OpenFilenameDialog hands back already resolves to a
  // real blob: URL via LocalFileGetImageUrl (no DownloadFiles round-trip
  // needed), but it was still being routed through Ys.KS same as a downloaded
  // remote one, producing the identical '/media/blob:...' garbage path.
  // Confirmed live: silent failure, zero console output, Select-All /
  // Tab-cycle after the insert shows no new shape on the slide, network panel
  // shows a real GET to that literal garbage path returning 200 (the dev
  // server's SPA fallback, not actual image bytes). Local keys now go through
  // the same direct-registration path as remote ones below, just skipping the
  // DownloadFiles fetch since the blob URL is already in hand.
  //
  // AddImageUrl isn't just reassigned once: live testing showed the SDK
  // reassigns it on the prototype again on every document open, silently
  // clobbering a plain function-reference patch installed only once (confirmed:
  // patch flag survives, but proto.AddImageUrl.toString() reverts to the raw
  // desktop version between opens). Use an accessor property instead -- the
  // getter always returns our wrapper; the setter intercepts the SDK's own
  // reassignment attempts and stashes the value it tried to set as the "real"
  // implementation (kept only as a last-resort fallback if wrapped() itself
  // isn't callable), rather than letting it overwrite anything.
  //
  // A correctly-shaped '/media/<key>' path reaching uHa() still wasn't enough --
  // live tracing into uHa's internals (this.ep.Tba -> BJe -> AscCommon.Oe.Ug ->
  // Cf -> Dzc) found a THIRD, deeper problem: uHa's fallback branch (the one
  // meant for exactly this case -- no active selection object, ba/context
  // undefined) is gated behind `false === this.ta.Ga.Cf(W)` where W resolves to
  // 1. Cf(1) delegates to `ugb(...)`, whose very first guard is
  // `AscCommon.Uc.Tra()` -- true whenever a start/end-action nesting counter
  // (Uc.l5d, toggled by the SDK's own asc_onStartAction/asc_onEndAction pair)
  // is nonzero. Confirmed live: even forcing that counter back to 0 wasn't
  // sufficient (ugb's second check, a local function bound to real-time
  // co-authoring lock state, also came back falsy) -- Cf(1) is fundamentally a
  // "do I hold the collaborative-editing lock for this insert" check, and Web
  // Mode has no real Document Server to grant one. Confirmed via live
  // monkey-patch + save-and-inspect-the-zip round-trip that forcing Cf(1) to
  // report "not restricted" (false) is what actually lets uHa reach Dzc/VX and
  // commit the image into the document model -- nothing else in the chain was
  // still broken once this gate was bypassed. Scoped to arg===1 only (the
  // image/media-insert restriction type observed live) so unrelated Cf checks
  // (track changes, content-control locks, etc., which use different type
  // constants) are untouched.
  function patchImageInsertRestrictionCheck(api) {
    var Ga = api && api.ta && api.ta.Ga;
    if (!Ga) return;
    var proto = Object.getPrototypeOf(Ga);
    while (proto && !Object.prototype.hasOwnProperty.call(proto, 'Cf')) proto = Object.getPrototypeOf(proto);
    if (!proto || proto.__imageCfPatched) return;
    proto.__imageCfPatched = true;
    var origCf = proto.Cf;
    proto.Cf = function (type) {
      if (type === 1) return false;
      return origCf.apply(this, arguments);
    };
  }

  (function patchAddImageUrlForRemoteAndLocalUrls() {
    var api = window.Asc && window.Asc.editor;
    if (!api || typeof api.AddImageUrl !== 'function') {
      setTimeout(patchAddImageUrlForRemoteAndLocalUrls, 50);
      return;
    }
    var proto = Object.getPrototypeOf(api);
    if (proto.__addImageUrlPatched) return;
    proto.__addImageUrlPatched = true;

    function isRemote(u) {
      return typeof u === 'string' && /^https?:\/\//i.test(u);
    }

    // Registers a blob URL into both media maps the same way for every entry
    // this patch resolves itself (remote-downloaded or local-file-picker), so
    // uHa() gets a real '/media/<key>' path instead of Ys.KS's mangled one.
    // See "Also register for the SAVE path" below for why both maps matter.
    function registerMedia(mediaPath, blobUrl) {
      try {
        if (window.parent && window.parent.__mediaCache) window.parent.__mediaCache[mediaPath] = blobUrl;
        // Also register for the SAVE path: x2t/writeMediaFiles reads from
        // the top page's `media` map (via __registerSaveMedia), a
        // separate object from __mediaCache (display-only). Without this,
        // the image shows on screen but the saved .docx's word/media/
        // entry is whatever fetching '/media/<key>' from the dev/prod
        // origin returns (a 404 page) instead of the real image bytes --
        // confirmed live via save + unzip.
        if (window.parent && window.parent.__registerSaveMedia) window.parent.__registerSaveMedia(mediaPath, blobUrl);
      } catch (ex) {}
    }

    var realImpl = proto.AddImageUrl; // whatever the SDK already assigned
    function wrapped(urls, b, d, e) {
      var self = this;
      if (!realImpl) return;
      // Local ("Image from file") entries hit this same broken chain: the key
      // OpenFilenameDialog produced already resolves to a real blob: URL via
      // LocalFileGetImageUrl (no download needed), but the SDK's own
      // AddImageUrl still runs it through Ys.KS, which mangles it into
      // '/media/blob:...' the exact same way it mangles a downloaded remote
      // URL -- confirmed live (silent failure, zero console output, network
      // panel shows a GET to that literal garbage path). Route local entries
      // through the same direct-registration fix as remote ones instead of
      // falling through to realImpl.
      patchImageInsertRestrictionCheck(self);
      var remote = urls.filter(isRemote);
      function finish(resultMap) {
        var resolved = urls.map(function (u) {
          if (isRemote(u)) {
            if (!resultMap[u]) {
              // Download failed: fall back to the SDK's own original
              // resolution so this entry behaves as it would have before
              // this patch (still broken, but no worse than upstream).
              return window.AscCommon.Ys.KS(window.AscDesktopEditor.LocalFileGetImageUrl(u));
            }
            var key = resultMap[u];
            var blobUrl = window.AscDesktopEditor.LocalFileGetImageUrl(key);
            var mediaPath = 'media/' + key;
            registerMedia(mediaPath, blobUrl);
            return '/' + mediaPath;
          }
          // Local file-picker key: already has a real blob URL, just needs
          // registering under its own key instead of being routed through
          // Ys.KS.
          var localBlobUrl = window.AscDesktopEditor.LocalFileGetImageUrl(u);
          if (typeof localBlobUrl === 'string' && localBlobUrl.indexOf('blob:') === 0) {
            var localMediaPath = 'media/' + u;
            registerMedia(localMediaPath, localBlobUrl);
            return '/' + localMediaPath;
          }
          return window.AscCommon.Ys.KS(localBlobUrl);
        });
        self.uHa(resolved, e);
      }
      if (remote.length) window.AscDesktopEditor.DownloadFiles(remote, null, finish);
      else finish({});
    }

    Object.defineProperty(proto, 'AddImageUrl', {
      configurable: true,
      get: function () {
        return wrapped;
      },
      set: function (fn) {
        realImpl = fn;
      },
    });
  })();

  // ── 4. Engine.IO/Socket.IO handshake mock ───────────────────────────────────────
  // The SDK's socket.io client polls GET/POST http(s)://host/doc/{sessionId}/c/
  // (Engine.IO v4 transport) expecting a real document/collaboration server. There
  // is none here, so we answer entirely client-side with the same bytes a minimal
  // Engine.IO v4 + Socket.IO v4 handshake would produce:
  //   first GET (no ?sid)  → "open" packet (type 0) + namespace CONNECT (type 40)
  //   subsequent GET ?sid= → "noop" packet (type 6), to keep the poll loop idle
  //   POST                 → "ok" (acks whatever the client just sent)
  // engine.io-client's polling transport uses XMLHttpRequest, not fetch, so
  // patching XHR is sufficient. The document itself is loaded separately via
  // asc_openDocumentFromBytes in onAppReady, independent of this connection.
  (function patchEngineIOHandshake() {
    var DOC_C_RE = /\/doc\/[^/]+\/c\//;
    var SID = 'fakesid';
    var NativeXHR = window.XMLHttpRequest;
    var origOpen = NativeXHR.prototype.open;
    var origSend = NativeXHR.prototype.send;

    function fakeResponse(xhr, body) {
      Object.defineProperty(xhr, 'readyState', { value: 4, configurable: true });
      Object.defineProperty(xhr, 'status', { value: 200, configurable: true });
      Object.defineProperty(xhr, 'statusText', { value: 'OK', configurable: true });
      Object.defineProperty(xhr, 'responseText', { value: body, configurable: true });
      Object.defineProperty(xhr, 'response', { value: body, configurable: true });
      if (typeof xhr.onreadystatechange === 'function') xhr.onreadystatechange();
      if (typeof xhr.onload === 'function') xhr.onload();
      try {
        xhr.dispatchEvent(new Event('readystatechange'));
        xhr.dispatchEvent(new Event('load'));
        xhr.dispatchEvent(new Event('loadend'));
      } catch (e) {}
    }

    NativeXHR.prototype.open = function (method, url) {
      this.__ooEngineIoUrl = typeof url === 'string' && DOC_C_RE.test(url) ? url : null;
      this.__ooEngineIoMethod = method;
      return origOpen.apply(this, arguments);
    };

    NativeXHR.prototype.send = function () {
      var url = this.__ooEngineIoUrl;
      if (!url) return origSend.apply(this, arguments);

      var xhr = this;
      var hasSid = new URL(url, window.location.href).searchParams.has('sid');
      setTimeout(function () {
        if (xhr.__ooEngineIoMethod === 'POST') {
          fakeResponse(xhr, 'ok');
          return;
        }
        if (!hasSid) {
          var open = JSON.stringify({ sid: SID, upgrades: [], pingInterval: 25000, pingTimeout: 5000 });
          var nsConnect = '40{"sid":"' + SID + '"}';
          fakeResponse(xhr, (1 + open.length) + ':0' + open + nsConnect.length + ':' + nsConnect);
        } else {
          fakeResponse(xhr, '1:6');
        }
      }, 0);
    };
  })();

  // ── 4b. Block real WebSocket connections to the collaboration endpoint ──────────
  // The Engine.IO handshake mock above answers XHR polling, but engine.io-client
  // separately tries a native `new WebSocket('ws://host/doc/{id}/c/?...')` too --
  // confirmed live (chrome-devtools MCP) that this attempt is real and fails
  // (there is no server), and each failure leaves an unpaired
  // asc_onStartAction/asc_onEndAction: AscCommon.Uc.l5d (a start/end-action
  // nesting counter) climbs by one and never comes back down. Once l5d is
  // nonzero, AscCommon.Uc.Tra() is true, which is the FIRST guard in every
  // restriction check (Cf -> ugb) gating document mutations -- not just the
  // image-insert path patched in section 3, ALL of them, including plain text
  // input. Confirmed by reproduction: typing into a fresh document does nothing
  // (no error, cursor doesn't advance) whenever l5d is stuck nonzero, and works
  // normally as soon as it's 0. The reconnect loop retries periodically, so
  // without this patch l5d eventually goes nonzero again even if manually reset
  // once. Fix: prevent the real WebSocket attempt from ever running, the same
  // "settle into connected, no server" approach as the XHR mock above -- the
  // client is left relying solely on the (working) polling transport.
  (function blockRealWebSocket() {
    var DOC_C_RE = /\/doc\/[^/]+\/c\//;
    var NativeWebSocket = window.WebSocket;
    if (!NativeWebSocket) return;
    function FakeWebSocket(url) {
      if (typeof url === 'string' && DOC_C_RE.test(url)) {
        throw new DOMException('blocked: no collaboration server in Web Mode', 'NetworkError');
      }
      return new (Function.prototype.bind.apply(NativeWebSocket, [null].concat([].slice.call(arguments))))();
    }
    FakeWebSocket.prototype = NativeWebSocket.prototype;
    FakeWebSocket.CONNECTING = NativeWebSocket.CONNECTING;
    FakeWebSocket.OPEN = NativeWebSocket.OPEN;
    FakeWebSocket.CLOSING = NativeWebSocket.CLOSING;
    FakeWebSocket.CLOSED = NativeWebSocket.CLOSED;
    window.WebSocket = FakeWebSocket;
  })();

  // ── 4c. Busy-counter watchdog (defense in depth) ─────────────────────────────────
  // Section 4b above fixes the confirmed WebSocket-driven leak of AscCommon.Uc.l5d
  // (a start/end-action nesting counter -- nonzero blocks ALL document mutations,
  // not just the collaboration-lock-gated ones section 3 patches around; see 4b's
  // comment for the full mechanism). lib/onlyoffice-editor.ts's
  // patchDesktopThemeCrash guards a second, independent leak source (a theme-picker
  // crash). Live testing found at least a THIRD leak trigger -- opening the
  // paragraph style gallery -- with no console error at all, so it isn't either of
  // the two known crashes; this SDK is too large to find and patch every individual
  // leak site one at a time. l5d only gates "is a document mutation currently
  // allowed" (AscCommon.Uc.Tra(), read by every Cf() restriction check); it has no
  // bearing on document/undo integrity, which is tracked completely separately, per
  // document, in Ga.Bd -- so periodically clamping l5d back to 0 when stuck is safe
  // in this single-user, no-real-collaboration-server context, even though it would
  // not be a safe blanket fix in a real multi-user desktop/server deployment. Runs
  // as a low-frequency safety net alongside (not instead of) the specific fixes
  // above -- 2s is comfortably longer than any real start/end-action pair in normal
  // use, which complete synchronously within a single call stack.
  //
  // Same interval also clears a stuck status bar "数据加载中" ("Loading...") label
  // (#label-action) -- confirmed live this is a DIFFERENT symptom of the same root
  // cause, not just the l5d counter. Main.stackLongActions (app.js's own
  // start/end-action bookkeeping, driving what setLongActionView shows) is a custom
  // stack object -- NOT a plain array/object (Object.keys() on it always returns
  // its 5 methods {push,pop,get,exist,length}, never the real entry count; call
  // .length() to get that). First seen stuck right after document load; confirmed
  // via stack.get(0) the leaked entry is consistently {id: 2, type: 0} -- this is
  // app.js's own `onLongActionBegin(Asc.c_oAscAsyncActionType.BlockInteraction,
  // LoadingDocument)` call from its native document-open flow (confirmed live by
  // reading its call site), whose matching end never fires in Web Mode (same
  // "depends on a real server round-trip" shape as everything else this file works
  // around) -- NOT Asc.c_oAscAsyncActionType.BlockInteraction's own enum value,
  // which is 1, not 0 (a first attempt at this fix matched on that symbolic
  // constant and silently never fired; match on the concrete {id,type} pair
  // instead of trusting the enum name). Reproduced a second time later just from
  // opening the numbering gallery, so this isn't a one-time startup fluke --
  // handled generally here rather than once at document-ready. Scoped to this
  // specific entry only (not "clear whatever's on top of the stack") since forcing
  // a real save/print/download action to end early, if one were ever legitimately
  // still in flight, could be worse than the stuck label it's meant to fix.
  (function watchBusyCounterLeak() {
    setInterval(function () {
      var Uc = window.AscCommon && window.AscCommon.Uc;
      if (Uc && Uc.l5d > 0) {
        console.warn('[OO] AscCommon.Uc.l5d stuck at', Uc.l5d, '-- resetting (patch section 4c watchdog)');
        Uc.l5d = 0;
      }
      try {
        var app = window.DE || window.SSE || window.PE;
        var mainCtrl = app && app.getController && app.getController('Main');
        var stack = mainCtrl && mainCtrl.stackLongActions;
        if (mainCtrl && stack && typeof stack.length === 'function') {
          while (stack.length() > 0) {
            var entry = stack.get(0);
            var isStuckLoading = entry && entry.type === 0 && entry.id === 2;
            // Asc.c_oAscAsyncAction.Disconnect (id 20): the SAME fake-disconnect
            // trigger that leaks appOptions.isDisconnected (below) also pushes this
            // long-action entry via each controller's own asc_onCoAuthoringDisconnect
            // handler. Its matching onLongActionEnd is what actually reverses the
            // cascade -- it's the SDK's own "connection restored" cleanup path
            // (confirmed live: fires "Connection is restored", re-enables Save/
            // Comments/Track changes/language menu -- all of which the isDisconnected
            // reset below does NOT touch, since those are locked by each controller's
            // own onApiCoAuthoringDisconnect handler, not by appOptions). type varies
            // by call site (seen both 0 and 1 live), so match on id alone here.
            var isStuckDisconnect = entry && entry.id === 20;
            if (!isStuckLoading && !isStuckDisconnect) break;
            console.warn(
              '[OO] stuck long-action',
              JSON.stringify(entry),
              '-- force-ending (patch section 4c watchdog)',
            );
            mainCtrl.onLongActionEnd(entry.type, entry.id);
          }
        }
      } catch (e) {}
      try {
        // A fourth, independent symptom of the same root cause: confirmed live
        // (reproduced from plain, ordinary UI actions -- e.g. just opening the
        // Insert > Table grid picker, not any of our own patches/experiments)
        // that mainCtrl.appOptions.isDisconnected can flip to true mid-session,
        // which cascades (via the SDK's own setMode()) into isEdit/canEdit both
        // going false -- silently turning the whole editor read-only with no
        // dialog (suppressCoAuthoringDisconnect in onlyoffice-editor.ts only
        // stops ONE side effect of this, hiding Download/Print/Edit buttons; it
        // doesn't touch isEdit). There is no real collaboration server here, so
        // this document can never legitimately need to be disconnected --
        // resetting these flags whenever the watchdog finds them stuck is safe
        // in this single-user context. asc_setViewMode(false) is also needed:
        // the appOptions flags are just the UI-facing mirror, the SDK's actual
        // edit-mode state is separate and doesn't follow from fixing them alone.
        var editorApp2 = window.DE || window.SSE || window.PE;
        var mainCtrl2 = editorApp2 && editorApp2.getController && editorApp2.getController('Main');
        if (mainCtrl2 && mainCtrl2.appOptions && mainCtrl2.appOptions.isDisconnected) {
          console.warn('[OO] appOptions.isDisconnected stuck true -- resetting (patch section 4c watchdog)');
          mainCtrl2.appOptions.isDisconnected = false;
          mainCtrl2.appOptions.isEdit = true;
          mainCtrl2.appOptions.canEdit = true;
          var api2 = window.Asc && window.Asc.editor;
          if (api2 && typeof api2.asc_setViewMode === 'function') api2.asc_setViewMode(false);
        }
      } catch (e) {}
      try {
        // A sixth symptom, confirmed live to compound with REPEATED real
        // triggers (a single Insert > Table use recovered fully via the checks
        // above; a second one in the same session left this residual behind):
        // several other controllers register their OWN independent
        // asc_onCoAuthoringDisconnect handler that calls their own
        // SetDisabled(true)/setDisabled(true) directly -- NOT through
        // stackLongActions, NOT through appOptions.isDisconnected, and not
        // undone by mainCtrl.onLongActionEnd's own cleanup (verified live:
        // calling that alone restores the Toolbar-level lock and the status
        // bar caption, but leaves these three untouched). Toolbar's own
        // editMode flag is a separate lock from the stack-based one already
        // handled above -- DisableToolbar(true,true) sets it directly from the
        // same disconnect handler. Each reset call below was individually
        // confirmed live to un-stick its target and is a no-op when not
        // needed, so it's safe to run unconditionally every tick.
        var editorApp3 = window.DE || window.SSE || window.PE;
        var toolbarCtrl3 = editorApp3 && editorApp3.getController && editorApp3.getController('Toolbar');
        if (toolbarCtrl3 && toolbarCtrl3.editMode === false) {
          console.warn('[OO] Toolbar.editMode stuck false -- resetting (patch section 4c watchdog)');
          toolbarCtrl3.editMode = true;
          var tbView3 = toolbarCtrl3.toolbar;
          if (tbView3 && tbView3.mode) tbView3.mode.isDisconnected = false;
          if (tbView3 && typeof tbView3.lockToolbar === 'function' && window.Common && window.Common.enumLock) {
            tbView3.lockToolbar(window.Common.enumLock.lostConnect, false);
          }
          if (typeof toolbarCtrl3.DisableToolbar === 'function') toolbarCtrl3.DisableToolbar(false, false);
        }
        var leftMenuCtrl3 = editorApp3 && editorApp3.getController && editorApp3.getController('LeftMenu');
        var leftMenuBtn3 = document.getElementById('left-btn-comments') || document.getElementById('left-btn-navigation');
        if (leftMenuCtrl3 && leftMenuBtn3 && leftMenuBtn3.className.indexOf('disabled') !== -1) {
          console.warn('[OO] LeftMenu stuck disabled -- resetting (patch section 4c watchdog)');
          leftMenuCtrl3.SetDisabled(false);
        }
        var statusbarCtrl3 = editorApp3 && editorApp3.getController && editorApp3.getController('Statusbar');
        if (statusbarCtrl3) {
          var btnTurnReview3 = statusbarCtrl3.btnTurnReview;
          var btnDocLang3 = statusbarCtrl3.btnDocLang;
          if (btnTurnReview3 && typeof btnTurnReview3.isDisabled === 'function' && btnTurnReview3.isDisabled()) {
            console.warn('[OO] Statusbar btnTurnReview stuck disabled -- resetting (patch section 4c watchdog)');
            btnTurnReview3.setDisabled(false);
          }
          if (btnDocLang3 && typeof btnDocLang3.isDisabled === 'function' && btnDocLang3.isDisabled()) {
            console.warn('[OO] Statusbar btnDocLang stuck disabled -- resetting (patch section 4c watchdog)');
            btnDocLang3.setDisabled(false);
          }
        }
      } catch (e) {}
      try {
        // A seventh symptom, found 2026-08-09 verifying the Header & Footer menu's
        // three siblings (Edit footer / Remove header / Remove footer) next to the
        // Edit Header crash fixed earlier the same day: Edit footer -> type -> Close
        // leaves the WHOLE document silently uneditable, with zero console output and
        // every other watchdog signal in this file (l5d, isDisconnected, Toolbar.editMode,
        // stackLongActions) reporting healthy -- confirmed via a header/footer A-B
        // comparison that the identical Edit header -> type -> Close sequence does NOT
        // reproduce this, so it isn't the Close button itself.
        //
        // Root cause (confirmed live, not guessed): AscCommon.Xr is the singleton that
        // owns the hidden off-screen <textarea id="area_id"> every keystroke actually
        // lands in -- Xr.zL is that element. Xr.qHc forces Xr.zL.readOnly = true
        // whenever set, overriding every other caller of Xr.tGb(false) (confirmed live
        // in sdk-all.js: `k.tGb=function(n){this.zL.readOnly=this.qHc?!0:n}`). Xr.qHc is
        // itself recomputed from Xr.zb.Vo (`k.Bwg=function(){...this.qHc=this.zb.Vo...}`,
        // where Xr.zb === the same window.Asc.editor api object everywhere else in this
        // file). api.Vo is a generic, temporary "suppress redraw" flag used all over
        // sdk-all.js as a save/restore pair (`var g=editor.Vo;editor.Vo=!0;<draw
        // something>;editor.Vo=g`) around dozens of unrelated internal render/thumbnail
        // operations -- too many call sites to find and fix the one specific leak (some
        // footer-close-triggered redraw whose restore never runs). Confirmed live that
        // api.Vo is stuck `true` right after the repro, and that api.appOptions.isEdit
        // stays `true` throughout (the SDK still thinks the document is editable -- it's
        // only this literal DOM readOnly attribute silently swallowing every keystroke).
        //
        // Fix mirrors the rest of this watchdog: don't chase the one broken call site
        // inside sdk-all.js, reset the flag it left behind. Gated on appOptions.isEdit
        // so a genuine readonly/view-mode document (?readonly=1, or setReadonlyMode(true))
        // is never overridden -- api.Vo legitimately supporting a real block is exactly
        // what isEdit=false would mean, and this watchdog only fires when isEdit is true.
        // Re-running Xr.Bwg() (the SDK's own qHc recompute) after resetting api.Vo, rather
        // than setting qHc/readOnly directly, keeps the rest of Bwg's fallback logic
        // (the Fm/xR/iEa switch) intact for any case this file's investigation didn't
        // cover.
        var editorApp4 = window.DE || window.SSE || window.PE;
        var mainCtrl4 = editorApp4 && editorApp4.getController && editorApp4.getController('Main');
        var api4 = window.Asc && window.Asc.editor;
        var Xr4 = window.AscCommon && window.AscCommon.Xr;
        if (
          mainCtrl4 &&
          mainCtrl4.appOptions &&
          mainCtrl4.appOptions.isEdit &&
          api4 &&
          api4.Vo &&
          Xr4 &&
          Xr4.zL &&
          Xr4.zL.readOnly &&
          typeof Xr4.Bwg === 'function'
        ) {
          console.warn('[OO] input-capture textarea stuck read-only (api.Vo leaked) -- resetting (patch section 4c watchdog)');
          api4.Vo = false;
          Xr4.Bwg();
        }
      } catch (e) {}
    }, 2000);
  })();

  // ── 5. XHR font URL rewrite ──────────────────────────────────────────────────────
  // Rewrites ascdesktop://fonts/<file> → /fonts/<mapped> using the font map
  // fetched above.  The XHR interceptor is installed synchronously; the fontMap
  // object is populated by the time the SDK actually requests any fonts (which
  // happens after editor init, well after the fetch resolves).
  (function patchFontUrls() {
    var FALLBACK = 'DejaVuSans.ttf';
    var origOpen = window.XMLHttpRequest.prototype.open;
    window.XMLHttpRequest.prototype.open = function (method, url) {
      if (typeof url === 'string') {
        if (url.indexOf('ascdesktop://fonts/') === 0) {
          var bs = String.fromCharCode(92);
          var fp = url.slice(19);
          var ls = Math.max(fp.lastIndexOf('/'), fp.lastIndexOf(bs));
          var fn = fp.slice(ls + 1).toLowerCase();
          arguments[1] = _base + 'fonts/' + (fontMap[fn] || FALLBACK);
        } else if (url.indexOf('/fonts/') !== -1) {
          var fi = url.lastIndexOf('/fonts/') + 7;
          var fn2 = url.slice(fi).toLowerCase();
          if (fontMap[fn2]) arguments[1] = _base + 'fonts/' + fontMap[fn2];
        }
      }
      return origOpen.apply(this, arguments);
    };
  })();

  // ── 6. Image URL redirect ────────────────────────────────────────────────────────
  // SDK constructs image URLs as /media/word/media/<file>.  Redirect these to
  // blob URLs pre-extracted from the OOXML ZIP and published by the parent page
  // in window.__mediaCache = { "media/image1.png": "blob://…" }.
  (function patchImageUrls() {
    var srcDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    if (!srcDesc || !srcDesc.set) return;
    var origSet = srcDesc.set;
    Object.defineProperty(HTMLImageElement.prototype, 'src', {
      set: function (url) {
        if (typeof url === 'string' && url.indexOf('/media/') !== -1) {
          var parts = url.split('/');
          var fname = parts[parts.length - 1].split('?')[0];
          var cache = window.parent && window.parent.__mediaCache;
          if (cache && fname) {
            var blobUrl = cache['media/' + fname];
            if (blobUrl) url = blobUrl;
          }
        }
        origSet.call(this, url);
      },
      get: srcDesc.get,
      configurable: true,
      enumerable: srcDesc.enumerable,
    });
  })();

  // ── 6b. Image URL redirect for the SDK's own exporter (downloadAs/Save) ─────────
  // <img src> above only covers on-screen rendering. Confirmed live (save + unzip
  // the result) that window.editor.downloadAs()/the toolbar Save button go through
  // the SDK's OWN internal OOXML exporter (not this project's x2t pipeline --
  // that's only reached via the embed/agent-driven requestSaveDocument path), and
  // that exporter fetches each image via a real XMLHttpRequest GET to
  // /media/<file> to embed its bytes into the zip. There is no file at that path
  // (it only ever existed as an AddImageUrl-resolved blob, see section 3) --  the
  // request falls through to the SPA and comes back as index.html, so the saved
  // .docx's word/media/ entry was literal HTML instead of the image (confirmed:
  // same content-length in every case, and content starting with "<!doctype").
  // Fix: same idea as the <img src> redirect above, but for XHR -- rewrite the
  // request URL itself to the cached blob: URL so the browser's own XHR
  // implementation loads it directly (blob: URLs are readable via a normal XHR).
  (function patchImageXhr() {
    var origOpen = window.XMLHttpRequest.prototype.open;
    window.XMLHttpRequest.prototype.open = function (method, url) {
      if (typeof url === 'string' && url.indexOf('/media/') !== -1) {
        var parts = url.split('/');
        var fname = parts[parts.length - 1].split('?')[0];
        var cache = window.parent && window.parent.__mediaCache;
        var blobUrl = cache && fname && cache['media/' + fname];
        if (blobUrl) arguments[1] = blobUrl;
      }
      return origOpen.apply(this, arguments);
    };
  })();

  // ── 6c. Paragraph style-gallery thumbnails: CJK captions don't render ───────────
  // The "开始" tab's style-gallery dropdown (Common.UI.ComboDataView, "combo-styles")
  // draws each entry's preview icon into an offscreen <canvas> per style
  // (AscCommonWord.pFf's inner "mpf" object: mub -> W_b -> FK -> ek -> qJh -> tBg ->
  // yFi). Confirmed live (chrome-devtools MCP) that the caption text reaching yFi is
  // always correct (the properly localized zh-CN display name, e.g. "标题 1" for
  // Heading 1) -- the bug is entirely inside the SDK's own drawing: it never calls
  // the native canvas fillText/strokeText APIs at all (instrumented and confirmed
  // zero calls), so it must rasterize glyphs through its own internal font/glyph
  // cache, and that cache silently drops CJK glyphs in this specific code path
  // (Latin letters and digits still render -- confirmed live that "Heading 1".."9"
  // show only their trailing ASCII digit, "标题" doesn't render, and "Normal"/"正文"
  // -- no digit to survive -- renders as a fully blank icon). No font XHR request
  // fires during this generation (confirmed live), so this isn't a missing/unmapped
  // font file the way most of this file's other font issues are -- some other,
  // still-unidentified internal cache is at fault, and it isn't reachable from here
  // to fix directly.
  //
  // Fix: don't try to fix the SDK's internal renderer -- overlay the caption
  // ourselves using the browser's own (unaffected) native canvas text APIs, which
  // we confirmed DO render CJK correctly once a CJK-capable font is available. Load
  // this project's own vendored NotoSansSC (already used for CJK document body text
  // elsewhere -- see the font map above) as a real FontFace, then wrap yFi to draw a
  // light backing rectangle plus the correct caption over the bottom of each icon
  // after the SDK's own (still useful for non-CJK locales, and for whatever
  // formatting hint it manages to draw, e.g. italic/underlined sample glyphs)
  // drawing finishes.
  //
  // yFi is patched on each individual "mpf" INSTANCE, not a shared prototype --
  // confirmed live that mpf carries its own *own-property* yFi (shadowing
  // whatever's on its prototype), so a prototype-level patch here would silently
  // never run. AscCommonWord.pFf's constructor is wrapped instead, so every fresh
  // "mpf" (there's one per pFf instance, and pFf itself is created lazily, once per
  // document, the first time the style gallery needs to generate) gets patched right
  // after construction, before the SDK's own first-generation pass can run.
  //
  // Scoped to the word editor only (AscCommonWord) -- cell/slide ship entirely
  // separate, independently-minified SDK bundles with their own internal names for
  // this same mechanism (if they even have an equivalent style gallery at all); this
  // hasn't been verified against either, so treat a similar report there as a
  // separate investigation, not "already covered by this patch."
  (function patchStyleGalleryCjkCaptions() {
    var CJK_FONT_FAMILY = 'OOStyleGalleryCJK';
    var cjkFontFace = null;
    try {
      cjkFontFace = new FontFace(CJK_FONT_FAMILY, 'url(' + _base + 'fonts/NotoSansSC-Regular.ttf)');
      cjkFontFace
        .load()
        .then(function (loaded) {
          document.fonts.add(loaded);
        })
        .catch(function (e) {
          console.warn('[OO] style-gallery CJK font failed to load, falling back to sans-serif', e);
        });
    } catch (e) {
      console.warn('[OO] FontFace unavailable for style-gallery CJK caption fix', e);
    }

    function patchMpf(mpf) {
      if (!mpf || mpf.__cjkCaptionPatched || typeof mpf.yFi !== 'function') return;
      mpf.__cjkCaptionPatched = true;
      var origYFi = mpf.yFi;
      mpf.yFi = function (d, e, f) {
        var result = origYFi.apply(this, arguments);
        try {
          var ctx = d && d.Pd;
          if (ctx && typeof f === 'string' && f.length) {
            var w = this.WBa,
              h = this.Swa;
            // w/h are the canvas's own raw pixel dimensions, not its CSS display
            // size (104x40 per the itemTemplate) -- confirmed live these render at
            // 2x (208x80), matching devicePixelRatio. A hardcoded "11px" font size
            // is 11 *canvas* px, which renders at roughly half the intended visual
            // size once the browser scales the bitmap down to the CSS box. Scale by
            // the actual canvas/CSS ratio so the overlay text reads at a normal,
            // legible size regardless of devicePixelRatio.
            // Covering only the bottom portion (leaving whatever the SDK's own
            // drawing left in the top area) was tried first, but that leftover
            // content (e.g. the heading-level numeral glyph some styles show) sits
            // right against our caption with no consistent gap -- confirmed live,
            // reads as visually "stuck together". Rather than chase per-style
            // vertical metrics to carve out a clean gap, replace the WHOLE icon
            // with just the caption, centered -- consistently clean across every
            // style instead of a hybrid that only sometimes has room to breathe.
            var scale = w / 104;
            var fontPx = Math.round(12 * scale);
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, w, h);
            ctx.font = fontPx + 'px "' + CJK_FONT_FAMILY + '", sans-serif';
            ctx.fillStyle = '#333333';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(f, w / 2, h / 2, w - 6 * scale);
            ctx.restore();
          }
        } catch (ex) {
          console.warn('[OO] style-gallery CJK caption overlay failed', ex);
        }
        return result;
      };
    }

    var attempts = 0;
    function tryPatch() {
      var Word = window.AscCommonWord;
      if (!Word || typeof Word.pFf !== 'function') {
        if (attempts++ < 100) setTimeout(tryPatch, 100);
        return;
      }
      if (Word.__pFfCjkCaptionPatched) return;
      Word.__pFfCjkCaptionPatched = true;

      var OrigPFf = Word.pFf;
      Word.pFf = function () {
        var inst = new OrigPFf();
        patchMpf(inst.mpf);
        return inst;
      };
    }
    tryPatch();
  })();

  // ── 7. Dialog suppression (fallback) ────────────────────────────────────────────
  // Primary suppression is in onlyoffice-editor.ts (suppressDialogsInFrame).
  // This polls as a defence-in-depth fallback for the "Connection is lost" dialog.
  (function suppressConnectionLost() {
    var ui = window.Common && window.Common.UI;
    if (!ui || typeof ui.alert !== 'function' || ui.__dlgSuppressed) {
      setTimeout(suppressConnectionLost, 200);
      return;
    }
    ui.__dlgSuppressed = true;
    var jq = {};
    [
      'attr',
      'on',
      'off',
      'show',
      'hide',
      'css',
      'addClass',
      'removeClass',
      'find',
      'remove',
      'val',
      'text',
      'html',
      'prop',
      'data',
      'trigger',
      'focus',
      'blur',
      'one',
      'click',
    ].forEach(function (m) {
      jq[m] = function () {
        return jq;
      };
    });
    jq.length = 0;
    var MOCK = {
      $window: jq,
      close: function () {},
      show: function () {},
      hide: function () {},
      remove: function () {},
    };
    // Locale-dependent (see the matching list in onlyoffice-editor.ts's
    // suppressDialogsInFrame, which is the primary suppression path -- this is
    // only a fallback).
    function suppress(opts) {
      var msg = opts && opts.msg;
      return (
        typeof msg === 'string' &&
        (msg.indexOf('Connection is lost') !== -1 ||
          msg.indexOf('error occurred during the work') !== -1 ||
          msg.indexOf('使用文档时出错') !== -1)
      );
    }
    var origAlert = ui.alert.bind(ui);
    ui.alert = function (opts) {
      return suppress(opts) ? MOCK : origAlert.apply(ui, arguments);
    };
    var origWarning = ui.warning && ui.warning.bind(ui);
    if (origWarning)
      ui.warning = function (opts) {
        return suppress(opts) ? MOCK : origWarning.apply(ui, arguments);
      };
  })();
})();
