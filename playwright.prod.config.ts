import { defineConfig, devices } from '@playwright/test';

/**
 * Production smoke: the core suites against the deployed site, not a local
 * build (matrix section C "线上站"). Serial and patient: the first x2t.wasm.gz
 * fetch (~10 MB) dominates and parallel workers would starve each other.
 *   PROD_URL=https://edit.chaxus.com pnpm exec playwright test -c playwright.prod.config.ts
 */
const PROD_URL = process.env.PROD_URL || 'https://edit.chaxus.com';

export default defineConfig({
  testDir: 'test/e2e',
  testMatch: [
    'app-smoke.spec.ts',
    'embed-regression.spec.ts',
    'embed-save-default.spec.ts',
    'main-site.spec.ts',
    'open-failure.spec.ts',
    'html-as-xls.spec.ts',
    'sw-warm.spec.ts',
    'format-parity.spec.ts',
    'font-cache.spec.ts',
    'pdf-route.spec.ts',
    'pdf-roundtrip.spec.ts',
  ],
  timeout: 300_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 1,
  outputDir: 'test-results-prod',
  reporter: [['list'], ['html', { outputFolder: 'playwright-report-prod', open: 'never' }]],
  use: {
    baseURL: PROD_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 900 },
  },
});
