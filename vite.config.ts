import fs from 'node:fs';
import path, { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

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

// `vite --mode v9` / `vite build --mode v9` switches to the OnlyOffice 9.3.0
// "Web Mode" build variant: a different publicDir (v9's SDK assets instead of
// v7's) and output dir, so it never touches the default v7 dev/build/deploy
// path. lib/onlyoffice-editor.ts reads the same `mode` via import.meta.env.MODE
// to pick its document-loading strategy (see OO_VARIANT there).
export default defineConfig(({ mode }) => {
  const isV9 = mode === 'v9';
  const publicDirName = isV9 ? 'public-v9' : 'public';

  return {
    base: './',
    publicDir: publicDirName,
    build: {
      outDir: isV9 ? 'dist-v9' : 'dist',
    },
    plugins: [cleanUrls(publicDirName)],
    resolve: {
      alias: {
        '@/lib': resolve(__dirname, 'lib'),
        '@/store': resolve(__dirname, 'store'),
        '@/assets': resolve(__dirname, 'assets'),
        '@/types': resolve(__dirname, 'types'),
        '@/styles': resolve(__dirname, 'styles'),
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
  };
});
