import fs from 'node:fs';
import path, { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

// Dev-only: resolve clean URLs to the static .html files under public/ so the
// landing pages (e.g. /offline-document-editor, /zh-CN/open/docx) work in
// `pnpm dev` exactly like on Cloudflare Pages in production, where extensionless
// URLs auto-resolve. Without this the nav links 404 / no-op in dev.
const cleanUrlsDev = (): Plugin => ({
  name: 'clean-urls-dev',
  apply: 'serve',
  configureServer(server) {
    const pub = path.join(__dirname, 'public');
    server.middlewares.use((req, _res, next) => {
      const pathname = (req.url ?? '/').split('?')[0];
      if (pathname === '/' || pathname.includes('.')) return next();
      const candidate = pathname.endsWith('/') ? `${pathname}index.html` : `${pathname}.html`;
      if (fs.existsSync(path.join(pub, candidate))) req.url = candidate;
      next();
    });
  },
});

export default defineConfig({
  base: './',
  publicDir: 'public',
  plugins: [cleanUrlsDev()],
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
});
