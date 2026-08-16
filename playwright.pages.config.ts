import { defineConfig } from '@playwright/test';
import base from './playwright.config';

/**
 * The same suites against the DEPLOY artifact served with the host's own
 * semantics: `bin/build.sh` (the real deploy build, not a bare vite build)
 * served by `wrangler pages dev`, which reproduces Cloudflare Pages'
 * `/index.html` -> directory 308, `_headers` and `_redirects`. This is the
 * layer that would have caught "PDF blank on the live site" and "fonts
 * without a cache rule" before merge. PR CI job `e2e-pages`.
 *   pnpm exec playwright test -c playwright.pages.config.ts
 */
const PORT = Number(process.env.PAGES_PORT || 8788);

export default defineConfig({
  ...base,
  outputDir: 'test-results-pages',
  reporter: [['list'], ['html', { outputFolder: 'playwright-report-pages', open: 'never' }]],
  use: { ...base.use, baseURL: `http://127.0.0.1:${PORT}` },
  webServer: {
    command: `sh ./bin/build.sh && pnpm dlx wrangler@latest pages dev dist --port ${PORT} --ip 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
