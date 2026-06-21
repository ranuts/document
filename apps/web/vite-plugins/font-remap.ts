import fs from 'node:fs/promises';
import path from 'node:path';
import type { Connect, Plugin, ResolvedConfig } from 'vite';

// Intercept /fonts/<file> HTTP requests and serve the remapped font file.
// This works at the HTTP layer so it catches ALL font requests regardless
// of JS context (main thread XHR, fetch(), Web Worker, WASM emscripten).
// Without this, DejaVuSans.ttf is loaded directly (bypassing the JS-level
// XHR patch in the iframe) and used as the FreeType rendering face, causing
// split-brain: HarfBuzz shapes with NotoSansSC (CJK GIDs) but FreeType
// renders with DejaVuSans (Latin GIDs), producing garbled characters.
//
// The generateBundle hook applies the same remapping to the production build
// so that static hosting (e.g. GitHub Pages) serves the correct font content
// without needing a server-side middleware.
export function fontRemapMiddleware(): Plugin {
  let publicDir = '';
  let cachedMap: Record<string, string> | null = null;

  async function loadMap(): Promise<Record<string, string>> {
    if (cachedMap !== null) return cachedMap;
    try {
      const raw = await fs.readFile(path.join(publicDir, 'font-map.json'), 'utf-8');
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

    const targetPath = path.join(publicDir, 'fonts', mapped);
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
    configResolved(config: ResolvedConfig) {
      publicDir = config.publicDir;
    },
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
    // Emit remapped font files into the production build so static hosts
    // (GitHub Pages, Nginx, etc.) serve the correct font without middleware.
    // Each src font is emitted with its original filename but the mapped
    // file's bytes, so the SDK's direct HTTP requests hit the right data.
    async generateBundle() {
      const map = await loadMap();
      // Cache mapped file contents to avoid re-reading the same target file.
      const contentCache = new Map<string, Buffer>();

      for (const [src, dst] of Object.entries(map)) {
        if (dst.toLowerCase() === src) continue; // identity mapping, skip

        let data = contentCache.get(dst);
        if (!data) {
          try {
            data = await fs.readFile(path.join(publicDir, 'fonts', dst));
            contentCache.set(dst, data);
          } catch {
            continue; // target font not found, skip this entry
          }
        }

        this.emitFile({
          type: 'asset',
          fileName: `fonts/${src}`,
          source: new Uint8Array(data),
        });
      }
    },
  };
}
