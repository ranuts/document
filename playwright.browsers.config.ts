import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

/**
 * Cross-browser projects (matrix section C "WebKit / Firefox"). Kept out of
 * the PR-time config: the real editor + x2t.wasm is heavy and Chromium is
 * the gate; WebKit/Firefox run nightly to catch engine-specific breakage.
 *   E2E_PORT=4175 pnpm exec playwright test -c playwright.browsers.config.ts
 */
export default defineConfig({
  ...base,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report-browsers', open: 'never' }]],
  // Nightly signal, not a gate: one retry turns load-dependent one-offs
  // (Firefox EditingError -25 on a 20k-row sheet under parallel load) into
  // "flaky" in the report instead of red, while a real regression still fails.
  retries: 1,
  workers: 2,
  projects: [
    { name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 900 } } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 900 } } },
  ],
});
