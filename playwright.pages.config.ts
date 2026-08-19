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

// wrangler's workerd has been observed to die mid-run on CI when a browser
// aborts a large download (sdk-all.js) while several workers hammer it
// ("kj/async-io-unix.c++ ... Connection reset by peer"), after which every
// test fails with ECONNREFUSED. Two mitigations: run the suites serially so
// concurrent aborts don't pile up, and supervise the dev server in a restart
// loop (bin/serve-pages-dev.sh, which also pins the compatibility date) so a
// crash costs one retried test instead of the whole job.
const SERVE = `sh ./bin/serve-pages-dev.sh ${PORT}`;

export default defineConfig({
  ...base,
  outputDir: 'test-results-pages',
  reporter: [['list'], ['html', { outputFolder: 'playwright-report-pages', open: 'never' }]],
  fullyParallel: false,
  workers: 1,
  retries: 1,
  use: { ...base.use, baseURL: `http://127.0.0.1:${PORT}` },
  webServer: {
    command: `sh ./bin/build.sh && (${SERVE})`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
