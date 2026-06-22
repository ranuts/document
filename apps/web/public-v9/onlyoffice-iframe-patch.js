/**
 * OnlyOffice iframe patch — injected into each editor iframe before any SDK scripts.
 *
 * Provides three things that OnlyOffice's Desktop-only SDK needs in a pure-browser env:
 *   1. window.AscDesktopEditor  — native OS file-dialog & I/O polyfill
 *   2. XHR font URL rewrite     — ascdesktop://fonts/ → /fonts/<mapped>
 *   3. Image URL redirect       — /media/…/image.png → parent.__mediaCache blob URL
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

  // ── 3. XHR font URL rewrite ──────────────────────────────────────────────────────
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

  // ── 4. Image URL redirect ────────────────────────────────────────────────────────
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

  // ── 5. Dialog suppression (fallback) ────────────────────────────────────────────
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
    function suppress(opts) {
      var msg = opts && opts.msg;
      return (
        typeof msg === 'string' &&
        (msg.indexOf('Connection is lost') !== -1 || msg.indexOf('error occurred during the work') !== -1)
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
