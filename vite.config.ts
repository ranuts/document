import fs from 'node:fs';
import path, { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { PAGES, generate as generatePages } from './bin/build-pages.mjs';
import { generate as generateLlmsFull } from './bin/llms-full.mjs';

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

// Resolve clean URLs to the static .html files under publicDir so the landing
// pages (e.g. /offline-document-editor, /zh-CN/open/docx) work in `pnpm dev`
// and `vite preview` exactly like on Cloudflare Pages in production, where
// extensionless URLs auto-resolve and /dir 308-redirects to /dir/. Without
// this the nav links 404 / no-op locally.
const cleanUrls = (publicDirName: string): Plugin => {
  const middlewareFor = (root: string) => {
    return (
      req: import('node:http').IncomingMessage,
      res: import('node:http').ServerResponse,
      next: () => void,
    ): void => {
      const [pathname, query] = (req.url ?? '/').split('?');
      if (pathname === '/' || pathname.includes('.')) return next();
      // Vite HTML entries at the project root (/editor -> editor.html) resolve
      // like the static pages under public/ do; Cloudflare Pages does the same.
      if (fs.existsSync(path.join(__dirname, `${pathname}.html`))) {
        req.url = `${pathname}.html${query ? `?${query}` : ''}`;
        return next();
      }
      if (!pathname.endsWith('/') && fs.existsSync(path.join(root, pathname, 'index.html'))) {
        // directory URL without slash: redirect like Cloudflare Pages does
        res.writeHead(308, { Location: `${pathname}/${query ? `?${query}` : ''}` });
        res.end();
        return;
      }
      const candidate = pathname.endsWith('/') ? `${pathname}index.html` : `${pathname}.html`;
      if (fs.existsSync(path.join(root, candidate))) req.url = candidate + (query ? `?${query}` : '');
      next();
    };
  };
  return {
    name: 'clean-urls',
    configureServer(server) {
      server.middlewares.use(middlewareFor(path.join(__dirname, publicDirName)));
    },
    configurePreviewServer(server) {
      server.middlewares.use(middlewareFor(path.join(__dirname, path.basename(server.config.build.outDir))));
    },
  };
};

// The x2t WASM is stored as brotli bytes under its plain `.wasm` name, so the
// browser decodes it at the network layer and `instantiateStreaming` can
// compile it straight off the response (see public/_headers for why). Vite
// serves public/ and dist/ as plain files and would hand over the compressed
// bytes unlabelled, so dev and preview need the same declaration Cloudflare
// Pages and static-web-server get from their own config.
const BROTLI_ASSETS = ['/sdkjs/common/wasm/x2t/x2t.wasm.br'];

const precompressedAssets = (): Plugin => {
  const middleware = (
    req: import('node:http').IncomingMessage,
    res: import('node:http').ServerResponse,
    next: () => void,
  ): void => {
    const pathname = (req.url ?? '/').split('?')[0];
    if (BROTLI_ASSETS.includes(pathname)) {
      // Content-Encoding only: the loader labels the response
      // application/wasm itself, and a compressible Content-Type is exactly
      // what makes wrangler re-compress the file (see public/_headers).
      res.setHeader('Content-Encoding', 'br');
    }
    next();
  };
  return {
    name: 'precompressed-assets',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
};

// Render the markdown-sourced pages (/help, /changelog, ... see
// bin/build-pages.mjs) into publicDir before Vite copies it. The outputs are
// gitignored: generating at build/dev time means a CHANGELOG or help edit
// can never leave a stale committed copy behind (two concurrently merged
// PRs used to be able to). Dev regenerates when a source markdown changes.
const generatedPages = (): Plugin => {
  const sources = new Set<string>();
  for (const page of PAGES) for (const src of Object.values(page.sources)) sources.add(path.resolve(__dirname, src));
  const run = () => {
    const outputs = generatePages();
    // After the markdown pages: llms-full.txt is assembled from the rendered
    // pages, so /help and /changelog have to exist before it is written.
    generateLlmsFull();
    return outputs.length;
  };
  return {
    name: 'generated-pages',
    buildStart() {
      run();
    },
    configureServer(server) {
      run();
      for (const src of sources) server.watcher.add(src);
      server.watcher.on('change', (file) => {
        if (sources.has(path.resolve(file))) {
          run();
          server.ws.send({ type: 'full-reload' });
        }
      });
    },
  };
};

export default defineConfig(() => {
  const publicDirName = 'public';

  return {
    base: './',
    publicDir: publicDirName,
    build: {
      outDir: 'dist',
      // Three HTML entries: / (static landing, no editor bundle), /editor (the
      // app) and /history (the local library, which reads IndexedDB metadata
      // and never loads the editor stack).
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          editor: resolve(__dirname, 'editor.html'),
          history: resolve(__dirname, 'history.html'),
        },
      },
    },
    plugins: [generatedPages(), precompressedAssets(), cleanUrls(publicDirName)],
    resolve: {
      // One wildcard, matching tsconfig's `"@/*": ["./*"]`, so `@/lib/x`
      // resolves the same way for tsc and for the bundler. The five
      // directory-specific aliases that used to live here pointed at
      // `store/` and `assets/`, which do not exist in this repo.
      alias: { '@': __dirname },
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
    },
  };
});
