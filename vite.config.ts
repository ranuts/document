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

  // Suppress "Connection is lost" dialog — expected in offline Web Mode (no real server).
  // Investigation showed CoAuthoringDisconnect uses Common.UI.alert, not Common.UI.warning.
  (function suppressConnectionLost() {
    var ui = window.Common && window.Common.UI;
    if (!ui || typeof ui.warning !== 'function' || typeof ui.alert !== 'function' || ui.__dlgSuppressed) {
      setTimeout(suppressConnectionLost, 200);
      return;
    }
    ui.__dlgSuppressed = true;
    function shouldSuppress(opts) {
      var msg = opts && opts.msg;
      if (typeof msg !== 'string') return false;
      return msg.indexOf('Connection is lost') !== -1 || msg.indexOf('error occurred during the work') !== -1;
    }
    var origWarning = ui.warning.bind(ui);
    ui.warning = function(opts) {
      if (shouldSuppress(opts)) return;
      return origWarning.apply(ui, arguments);
    };
    // CoAuthoringDisconnect error goes through Common.UI.alert
    var origAlert = ui.alert.bind(ui);
    ui.alert = function(opts) {
      if (shouldSuppress(opts)) return;
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
