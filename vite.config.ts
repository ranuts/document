import fs from 'node:fs/promises';
import path, { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import type { Connect, Plugin } from 'vite';

// Serve a minimal Engine.IO v4 + Socket.IO v4 handshake for OnlyOffice polling.
//
// Protocol details:
//   Engine.IO v4 framing: "{byteLen}:{packet}" where packet = "{eiotype}{data}"
//     eiotype 0 = open, 4 = message, 6 = noop
//   Socket.IO v4 runs on top of Engine.IO type 4:
//     "40{json}"  = namespace CONNECT (json must include socket sid in v4)
//     "42[...]"   = EVENT
//
// First GET (no ?sid): send open-packet + socket.io namespace-connect.
// Subsequent GETs (?sid=fakesid): send noop so the client keeps polling.
// POST: acknowledge the client's socket.io frames with "ok".
//
// After the handshake the client will POST auth events; we respond "ok" to each.
// The document is loaded separately via asc_openDocumentFromBytes in onAppReady.
function onlyofficeEngineIOHandshake(): Plugin {
  const SID = 'fakesid';
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    if (req.url && /\/doc\/[^/]+\/c\//.test(req.url)) {
      const url = new URL(req.url, 'http://localhost');
      const hasSid = url.searchParams.has('sid');
      res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
      res.setHeader('Cache-Control', 'no-store');
      if (req.method === 'POST') {
        // Acknowledge any client-to-server socket.io packets
        res.end('ok');
        return;
      }
      if (!hasSid) {
        // First GET: Engine.IO open packet + Socket.IO v4 namespace connect
        // Socket.IO v4 requires the namespace connect to include {"sid":"..."} json
        const open = JSON.stringify({ sid: SID, upgrades: [], pingInterval: 25000, pingTimeout: 5000 });
        const nsConnect = `40{"sid":"${SID}"}`;
        const body = `${1 + open.length}:0${open}${nsConnect.length}:${nsConnect}`;
        res.end(body);
      } else {
        // Subsequent GETs: Engine.IO noop keeps the long-poll cycle alive
        res.end('1:6');
      }
      return;
    }
    if (req.url && /(^|\/)document_editor_service_worker\.js(?:\?|$)/.test(req.url)) {
      res.statusCode = 404;
      res.setHeader('Cache-Control', 'no-store');
      res.end();
      return;
    }
    next();
  };

  return {
    name: 'onlyoffice-engineio-handshake',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

// Intercept /fonts/<file> HTTP requests and serve the remapped font file.
// This works at the HTTP layer so it catches ALL font requests regardless
// of JS context (main thread XHR, fetch(), Web Worker, WASM emscripten).
// Without this, DejaVuSans.ttf is loaded directly (bypassing the JS-level
// XHR patch in the iframe) and used as the FreeType rendering face, causing
// split-brain: HarfBuzz shapes with NotoSansSC (CJK GIDs) but FreeType
// renders with DejaVuSans (Latin GIDs), producing garbled characters.
function fontRemapMiddleware(): Plugin {
  const FONT_MAP_PATH = path.join(__dirname, 'public', 'font-map.json');
  const FONTS_DIR = path.join(__dirname, 'public', 'fonts');
  let cachedMap: Record<string, string> | null = null;

  async function loadMap(): Promise<Record<string, string>> {
    if (cachedMap !== null) return cachedMap;
    try {
      const raw = await fs.readFile(FONT_MAP_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as Record<string, string>;
      delete parsed['_comment'];
      cachedMap = parsed;
    } catch {
      cachedMap = {};
    }
    return cachedMap;
  }

  const middleware: Connect.NextHandleFunction = async (req, res, next) => {
    if (!req.url || req.method !== 'GET') return next();
    const match = /^\/fonts\/([^?#]+)/.exec(req.url);
    if (!match) return next();

    const filename = match[1].toLowerCase();
    const map = await loadMap();
    const mapped = map[filename];
    if (!mapped || mapped.toLowerCase() === filename) return next();

    const targetPath = path.join(FONTS_DIR, mapped);
    try {
      const data = await fs.readFile(targetPath);
      console.log(`[vite:font-remap] ${filename} → ${mapped} (${data.length} bytes)`);
      res.setHeader('Content-Type', 'font/truetype');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.end(data);
    } catch {
      next();
    }
  };

  return {
    name: 'font-remap',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

// Patch editor index.html in Web Mode (no AscDesktopEditor):
//  - Rewrite ascdesktop://fonts/ → /fonts/ so the font XHR succeeds
//  - Suppress "Connection is lost" warning (expected — no real server)
function onlyofficeWebModePatch(): Plugin {
  const EDITOR_HTML = /\/web-apps\/apps\/(documenteditor|presentationeditor|spreadsheeteditor)\/main\/index\.html/;
  const FONT_MAP_PATH = path.join(__dirname, 'public', 'font-map.json');

  // Cache the font map so we only read it once per server lifecycle.
  // The map is embedded synchronously into every editor iframe HTML response,
  // eliminating the async-fetch race condition where Chinese fonts fell back to
  // DejaVuSans.ttf because the fetch hadn't resolved when OnlyOffice requested them.
  let cachedFontMap: string | null = null;

  async function loadFontMap(): Promise<string> {
    if (cachedFontMap !== null) return cachedFontMap;
    try {
      const raw = await fs.readFile(FONT_MAP_PATH, 'utf-8');
      // Strip JSON comments (lines starting with "_comment") for safe JS embedding
      const map = JSON.parse(raw) as Record<string, string>;
      delete map['_comment'];
      cachedFontMap = JSON.stringify(map);
    } catch {
      cachedFontMap = '{}';
    }
    return cachedFontMap;
  }

  function buildPatch(embeddedFontMap: string): string {
    return `<script>
(function () {
  console.log('[OO vite-patch] running in', window.location.href);

  // ── AscDesktopEditor polyfill ─────────────────────────────────────────────
  // OnlyOffice Web Apps SDK assumes it runs inside the Desktop App, which
  // provides window.AscDesktopEditor for native OS operations (file dialogs,
  // local file I/O, etc.).  Without it, any toolbar action that involves
  // file selection (Insert Image, Insert Video, Insert Audio, open a .docx
  // as reference, …) crashes immediately with "Cannot read properties of
  // undefined (reading 'OpenFilenameDialog')".
  //
  // We supply browser-native equivalents:
  //   • OpenFilenameDialog  →  <input type="file"> picker
  //   • LocalFileGetImageUrl →  URL.createObjectURL (blob URL)
  //   • AddVideo / AddAudio  →  blob URL forwarded to SDK callback
  //   • Everything else      →  safe no-op stubs
  (function installAscDesktopEditor() {
    if (window.AscDesktopEditor) return;
    var _map = {}, _seq = 0;

    function pickFile(acc, multi, cb) {
      var inp = document.createElement('input');
      inp.type = 'file';
      inp.multiple = !!multi;
      if (acc) inp.accept = acc;
      inp.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;';
      document.body.appendChild(inp);
      function done() { try { document.body.removeChild(inp); } catch(e) {} }
      inp.addEventListener('change', function() {
        done();
        var files = inp.files;
        if (!files || !files.length) return;
        var paths = [];
        for (var i = 0; i < files.length; i++) {
          var f = files[i], key = 'asc-local-' + (++_seq) + '-' + f.name;
          _map[key] = { url: URL.createObjectURL(f), file: f };
          paths.push(key);
        }
        cb(multi ? paths : paths[0]);
      });
      inp.addEventListener('cancel', done);
      inp.click();
    }

    function filterToAccept(f) {
      if (f === 'images') return 'image/png,image/jpeg,image/gif,image/bmp,image/tiff,image/webp,image/svg+xml,.png,.jpg,.jpeg,.gif,.bmp,.tif,.tiff,.webp,.svg';
      if (f === 'video')  return 'video/*,.mp4,.webm,.avi,.mov,.mkv,.wmv,.m4v';
      if (f === 'audio')  return 'audio/*,.mp3,.wav,.ogg,.aac,.m4a,.wma,.flac';
      if (f === 'word')   return '.docx,.doc,.odt,.rtf,.txt';
      if (f === 'cell')   return '.xlsx,.xls,.ods,.csv';
      return '';
    }

    function getUrl(key) { var e = _map[key]; return e ? e.url : key; }
    function noop() {}
    function noopFalse() { return false; }
    function noopEmpty() { return ''; }
    function noopArr() { return []; }

    window.AscDesktopEditor = {
      OpenFilenameDialog:            function(f, m, cb) { pickFile(filterToAccept(f), m, cb); },
      LocalFileGetImageUrl:          function(k) { return getUrl(k); },
      LocalFileGetImageUrlCorrect:   function(k, cb) { var u = getUrl(k); if (typeof cb === 'function') cb(u); return u; },
      AddVideo:  function(k, cb) { var e = _map[k]; if (typeof cb === 'function') cb(e ? 0 : 1, e ? { url: e.url, name: e.file.name } : null); },
      AddAudio:  function(k, cb) { var e = _map[k]; if (typeof cb === 'function') cb(e ? 0 : 1, e ? { url: e.url, name: e.file.name } : null); },
      onDocumentModifiedChanged:     noop,
      LocalFileSave:                 function() { setTimeout(function() { if (typeof window.DesktopOfflineAppDocumentEndSave === 'function') window.DesktopOfflineAppDocumentEndSave(0, null, null); }, 0); },
      LocalFileSaveChanges:          noop,
      LocalFileGetOpenChangesCount:  function() { return 0; },
      LocalFileGetSaved:             noopFalse,
      LocalFileGetSourcePath:        noopEmpty,
      LocalFileGetRelativePath:      noopFalse,
      LocalStartOpen:                noop,
      // word SDK: download a list of remote URLs and return {url: localPath} map
      DownloadFiles: function(urls, _extra, cb) {
        if (!urls || !urls.length) { if (typeof cb === 'function') cb({}); return; }
        var result = {}, done = 0, total = urls.length;
        urls.forEach(function(url) {
          fetch(url, { mode: 'cors' })
            .then(function(r) { return r.ok ? r.blob() : Promise.reject(r.status); })
            .then(function(blob) {
              var name = (url.split('/').pop() || 'file').split('?')[0];
              var key = 'asc-dl-' + (++_seq) + '-' + name;
              _map[key] = { url: URL.createObjectURL(blob), file: new File([blob], name) };
              result[url] = key;
            })
            .catch(function() { result[url] = ''; })
            .then(function() { if (++done === total && typeof cb === 'function') cb(result); });
        });
      },
      SetAdvancedOptions:            noop,
      SetDocumentName:               noop,
      SetFullscreen:                 noop,
      SetLocalRestrictions:          noop,
      SaveQuestion:                  function(cb) { if (typeof cb === 'function') cb(0); },
      // app.js calls i=window.desktop||window.AscDesktopEditor; i.execCommand(cmd,data)
      // synchronously on load — missing this crashes SDK before onAppReady fires.
      execCommand:                   noop,
      // Called after execCommand("doc:onready") to populate recent files list in native UI.
      LocalFileRecents:              noopArr,
      CheckNeedWheel:                noopFalse,
      CheckUserId:                   noop,
      convertFile:                   noop,
      GetDropFiles:                  noopArr,
      getEngineVersion:              noopEmpty,
      GetImageBase64:                function() { return ''; },
      // SDK calls JSON.parse(GetInstallPlugins()) and expects an array of 2 entries
      // with {url, pluginsData:[]} — empty arrays cause the loop to skip safely.
      GetInstallPlugins:             function() { return '[{"url":"","pluginsData":[]},{"url":"","pluginsData":[]}]'; },
      GetOpenedFile:                 noopEmpty,
      GetSupportedScaleValues:       noopArr,
      isBlockchainSupport:           noopFalse,
      IsFilePrinting:                noopFalse,
      IsImageFile:                   function(p) { return /\\.(png|jpe?g|gif|bmp|tiff?|webp|svg)$/i.test(String(p)); },
      IsLocalFile:                   noopFalse,
      IsLocalFileExist:              noopFalse,
      IsSupportMedia:                noopFalse,
      isSupportNetworkFunctionality: noopFalse,
      isSupportPlugins:              noopFalse,
      LoadFontBase64:                function(n, cb) { if (typeof cb === 'function') cb(''); },
      NativeViewerOpen:              noop,
      startExternalConvertation:     noop,
      ViewCertificate:               noop,
      buildCryptedEnd:               noop,
      buildCryptedStart:             noop,
      CryptoMode:                    0,
      Crypto_GetLocalImageBase64:    function(p, cb) { if (typeof cb === 'function') cb(''); },
      PreloadCryptoImage:            noop,
      // sdk-all-min.js: a.AscDesktopEditor && a.AscDesktopEditor.CreateEditorApi(this)
      // registers the Asc API object with the Desktop host; safe noop in browser.
      CreateEditorApi:               noop,
      // Remaining stubs — called conditionally or only on user action,
      // stubbed to prevent TypeErrors if SDK calls them without feature guards.
      CallInAllWindows:              noop,
      CallMediaPlayerCommand:        noop,
      CompareDocumentFile:           noop,
      CompareDocumentUrl:            noop,
      emulateCloudPrinting:          noop,
      endReporter:                   noop,
      GetDefaultCertificate:         function() { return null; },
      getDictionariesPath:           noopEmpty,
      GetEncryptedHeader:            function() { return 'ENCRYPTED;'; },
      GetFontThumbnailHeight:        function() { return 0; },
      GetImageFormat:                noopEmpty,
      GetImageOriginalSize:          function() { return { W: 0, H: 0 }; },
      IsCachedPdfCloudPrintFileInfo: noopFalse,
      IsProtectionSupport:           noopFalse,
      IsSignaturesSupport:           noopFalse,
      isSupportMacroses:             noopFalse,
      loadLocalFile:                 noop,
      LoadJS:                        noop,
      MergeDocumentFile:             noop,
      MergeDocumentUrl:              noop,
      OnSave:                        noop,
      onDocumentContentReady:        noop,
      onFileLockedClose:             noop,
      openExternalReference:         noop,
      OpenFileCrypt:                 noop,
      OpenWorkbook:                  noop,
      PluginInstall:                 noop,
      PluginUninstall:               noop,
      Print:                         noop,
      Print_End:                     noop,
      Print_Page:                    noop,
      Print_Start:                   noop,
      RemoveAllSignatures:           noop,
      RemoveFile:                    noop,
      RemoveSignature:               noop,
      ResaveFile:                    noop,
      SelectCertificate:             noop,
      sendFromReporter:              noop,
      sendSystemMessage:             noop,
      sendToReporter:                noop,
      SetPdfCloudPrintFileInfo:      noop,
      Sign:                          noop,
      SpellCheck:                    noop,
      startReporter:                 noop,
    };
    console.log('[OO] AscDesktopEditor polyfill installed');
  })();

  // Rewrite ascdesktop://fonts/<file> → /fonts/<mapped-file>.
  // Font map is embedded at serve time (no async fetch) so every XHR is
  // rewritten synchronously — no race where fonts fall back to DejaVuSans
  // before the map loads (which caused garbled CJK in documents).
  (function patchFontUrls() {
    var FALLBACK = 'DejaVuSans.ttf';
    var fontMap = ${embeddedFontMap};

    var origOpen = window.XMLHttpRequest.prototype.open;
    window.XMLHttpRequest.prototype.open = function(method, url) {
      if (typeof url === 'string' && url.indexOf('ascdesktop://fonts/') === 0) {
        var bs = String.fromCharCode(92);
        var fp = url.slice(19);
        var ls = Math.max(fp.lastIndexOf('/'), fp.lastIndexOf(bs));
        var fn = fp.slice(ls + 1).toLowerCase();
        var mapped = fontMap[fn];
        arguments[1] = '/fonts/' + (mapped || FALLBACK);
      } else if (typeof url === 'string' && url.indexOf('/fonts/') !== -1) {
        // SDK may also request fonts via direct /fonts/<name> path (web mode)
        var fi = url.lastIndexOf('/fonts/') + 7;
        var fn2 = url.slice(fi).toLowerCase();
        var mapped2 = fontMap[fn2];
        if (mapped2) arguments[1] = '/fonts/' + mapped2;
      }
      return origOpen.apply(this, arguments);
    };
  })();

  // Redirect /media/word/media/<file> image requests to pre-extracted blob URLs.
  // The SDK constructs image URLs as fia+"/media/"+path (fia="" in Web Mode),
  // producing /media/word/media/image1.png.  Since these are Image object requests
  // (sec-fetch-dest: image), XHR prototype patching cannot intercept them.
  // Instead we patch HTMLImageElement.prototype.src to redirect before the browser
  // sends the network request.  Blob URLs are published by the parent page in
  // window.__mediaCache = { "media/image1.png": "blob://..." }.
  (function patchImageUrls() {
    var srcDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    if (!srcDesc || !srcDesc.set) return;
    var origSet = srcDesc.set;
    Object.defineProperty(HTMLImageElement.prototype, 'src', {
      set: function(url) {
        if (typeof url === 'string' && url.indexOf('/media/') !== -1) {
          var parts = url.split('/');
          var fname = parts[parts.length - 1].split('?')[0];
          var cache = window.parent && window.parent.__mediaCache;
          if (cache && fname) {
            var blobUrl = cache['media/' + fname];
            if (blobUrl) {
              console.log('[OO vite-patch] image redirect', fname, '->', blobUrl.slice(0, 60));
              url = blobUrl;
            }
          }
        }
        origSet.call(this, url);
      },
      get: srcDesc.get,
      configurable: true,
      enumerable: srcDesc.enumerable,
    });
  })();

  // Suppress "Connection is lost" dialog — expected in offline Web Mode (no real server).
  // Investigation showed CoAuthoringDisconnect uses Common.UI.alert, not Common.UI.warning.
  //
  // IMPORTANT: app.js chains .alert(s).$window.attr(...) — if we return undefined
  // from alert(), the chain crashes with "Cannot read properties of undefined
  // (reading '$window')".  We must return a mock dialog object instead.
  (function suppressConnectionLost() {
    var ui = window.Common && window.Common.UI;
    if (!ui || typeof ui.warning !== 'function' || typeof ui.alert !== 'function' || ui.__dlgSuppressed) {
      setTimeout(suppressConnectionLost, 200);
      return;
    }
    ui.__dlgSuppressed = true;

    // Build a chainable no-op that satisfies .$window.attr(...) and similar chains.
    var jq = {};
    ['attr','on','off','show','hide','css','addClass','removeClass','find','remove',
     'val','text','html','prop','data','trigger','focus','blur','one','click'].forEach(function(m) {
      jq[m] = function() { return jq; };
    });
    jq.length = 0;
    var MOCK_DIALOG = { $window: jq, close: function() {}, show: function() {}, hide: function() {}, remove: function() {} };

    function shouldSuppress(opts) {
      var msg = opts && opts.msg;
      if (typeof msg !== 'string') return false;
      return msg.indexOf('Connection is lost') !== -1 || msg.indexOf('error occurred during the work') !== -1;
    }
    var origWarning = ui.warning.bind(ui);
    ui.warning = function(opts) {
      if (shouldSuppress(opts)) return MOCK_DIALOG;
      return origWarning.apply(ui, arguments);
    };
    // CoAuthoringDisconnect error goes through Common.UI.alert
    var origAlert = ui.alert.bind(ui);
    ui.alert = function(opts) {
      if (shouldSuppress(opts)) return MOCK_DIALOG;
      return origAlert.apply(ui, arguments);
    };
  })();
})();
</script>`;
  }

  const middleware: Connect.NextHandleFunction = async (req, res, next) => {
    if (!req.url || !EDITOR_HTML.test(req.url)) return next();
    const reqPath = req.url.split('?')[0];
    const filePath = path.join(__dirname, 'public') + reqPath;
    console.log('[vite:oo-patch] intercepting', reqPath);
    try {
      const [html, embeddedFontMap] = await Promise.all([
        fs.readFile(filePath, 'utf-8'),
        loadFontMap(),
      ]);
      if (res.writableEnded) {
        console.warn('[vite:oo-patch] response already sent by another middleware — patch missed!');
        return;
      }
      const PATCH = buildPatch(embeddedFontMap);
      const injected = html.replace('<head>', `<head>\n${PATCH}`);
      const patched = injected !== html;
      console.log('[vite:oo-patch] injected:', patched, 'bytes:', injected.length);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.end(injected);
    } catch (e) {
      console.error('[vite:oo-patch] readFile failed:', filePath, String(e));
      next();
    }
  };

  return {
    name: 'onlyoffice-web-mode-patch',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

// Hide #seo-content before first paint to eliminate flash-of-unstyled-content
// when navigating between pages. JS removes it and renders the landing panel.
// noscript re-shows it so crawlers without JS still see the content.
function injectCriticalStyle(): Plugin {
  const style = `<style>#seo-content{display:none}</style><noscript><style>#seo-content{display:block}</style></noscript>`;
  return {
    name: 'inject-critical-style',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return html.replace('<head>', `<head>\n${style}`);
      },
    },
  };
}

// Inject Google Analytics into every HTML page at build time.
// Only active in production — dev mode skips it to keep the console clean.
function injectGtag(): Plugin {
  const GTAG_ID = 'G-VQCV194W8Q';
  const snippet = `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${GTAG_ID}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${GTAG_ID}');
</script>`;
  return {
    name: 'inject-gtag',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        if (ctx.server) return html; // skip in dev
        return html.replace('</head>', `${snippet}\n</head>`);
      },
    },
  };
}

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

export default defineConfig({
  root: 'pages',
  base: './',
  publicDir: resolve(__dirname, 'public'),
  plugins: [onlyofficeEngineIOHandshake(), fontRemapMiddleware(), onlyofficeWebModePatch(), injectCriticalStyle(), injectGtag()],
  server: {
    fs: {
      // Allow Vite to serve src/ which lives outside the pages/ root
      allow: [__dirname],
    },
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'pages/index.html'),
        privateDocumentEditor: resolve(__dirname, 'pages/private-document-editor/index.html'),
        docxEditor: resolve(__dirname, 'pages/docx-editor/index.html'),
        xlsxEditor: resolve(__dirname, 'pages/xlsx-editor/index.html'),
        pptxEditor: resolve(__dirname, 'pages/pptx-editor/index.html'),
        csvEditor: resolve(__dirname, 'pages/csv-editor/index.html'),
        onlyofficeWasm: resolve(__dirname, 'pages/onlyoffice-wasm/index.html'),
        embedDocumentEditor: resolve(__dirname, 'pages/embed-document-editor/index.html'),
        selfHostedDocumentEditor: resolve(__dirname, 'pages/self-hosted-document-editor/index.html'),
        // zh-cn pages
        zhCnMain: resolve(__dirname, 'pages/zh-cn/index.html'),
        zhCnDocxEditor: resolve(__dirname, 'pages/zh-cn/docx-editor/index.html'),
        zhCnXlsxEditor: resolve(__dirname, 'pages/zh-cn/xlsx-editor/index.html'),
        zhCnPptxEditor: resolve(__dirname, 'pages/zh-cn/pptx-editor/index.html'),
        zhCnCsvEditor: resolve(__dirname, 'pages/zh-cn/csv-editor/index.html'),
        zhCnPrivateDocumentEditor: resolve(__dirname, 'pages/zh-cn/private-document-editor/index.html'),
        zhCnOnlyofficeWasm: resolve(__dirname, 'pages/zh-cn/onlyoffice-wasm/index.html'),
        zhCnEmbedDocumentEditor: resolve(__dirname, 'pages/zh-cn/embed-document-editor/index.html'),
        zhCnSelfHostedDocumentEditor: resolve(__dirname, 'pages/zh-cn/self-hosted-document-editor/index.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@/lib': resolve(__dirname, 'src/lib'),
      '@/store': resolve(__dirname, 'src/store'),
      '@/types': resolve(__dirname, 'src/types'),
      '@/styles': resolve(__dirname, 'src/styles'),
    },
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@import "@/styles/base.css";`,
      },
    },
  },
});
