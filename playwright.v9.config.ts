import { defineConfig, devices } from '@playwright/test';

// E2E config for the v9 build variant (OnlyOffice Personal vendor in
// public-v9/). Kept separate from playwright.config.ts so the default v7
// suite is untouched; run with `pnpm run test:e2e:v9`.
//
// Every test boots the real editor iframe and most also load the ~9 MB x2t
// WASM inside it for the save round-trip, so per-test timeouts are generous
// and tests run serially to keep a single editor's boot from starving the
// others of CPU.
export default defineConfig({
  testDir: 'test/e2e-v9',
  timeout: 120_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report-v9', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4174',
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
  webServer: {
    command:
      './node_modules/.bin/vite build --mode v9 && ./node_modules/.bin/vite preview --mode v9 --host 127.0.0.1 --port 4174',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
