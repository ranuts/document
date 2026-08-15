import { defineConfig, devices } from '@playwright/test';

// Override when several E2E runs share a machine (parallel sessions each
// killing/rebuilding "the" preview server on 4173 turn each other's runs
// into ERR_CONNECTION_REFUSED / LoadingScriptError findings).
// E2E_BASE_URL=https://edit.chaxus.com runs the suites against a deployed
// site instead of a local build (production smoke): no webServer is started.
const REMOTE = process.env.E2E_BASE_URL;
const PORT = Number(process.env.E2E_PORT || 4173);
// A non-default port also gets its own build output and results directory:
// two runs sharing dist/ and test-results/ wipe each other's artifacts
// (Playwright clears outputDir at start; vite build rewrites dist mid-serve).
const ISOLATED = Boolean(process.env.E2E_PORT);
const OUT_DIR = ISOLATED ? `dist-e2e-${PORT}` : 'dist';
const RESULTS_DIR = ISOLATED ? `test-results-${PORT}` : 'test-results';

export default defineConfig({
  testDir: 'test/e2e',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  outputDir: RESULTS_DIR,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: REMOTE || `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
    },
  ],
  webServer: REMOTE
    ? undefined
    : {
        command: `./node_modules/.bin/vite build --outDir ${OUT_DIR} && ./node_modules/.bin/vite preview --outDir ${OUT_DIR} --host 127.0.0.1 --port ${PORT}`,
        url: `http://127.0.0.1:${PORT}`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
