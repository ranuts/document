import { defineConfig, devices } from '@playwright/test';

// Override when several E2E runs share a machine (parallel sessions each
// killing/rebuilding "the" preview server on 4173 turn each other's runs
// into ERR_CONNECTION_REFUSED / LoadingScriptError findings).
const PORT = Number(process.env.E2E_PORT || 4173);

export default defineConfig({
  testDir: 'test/e2e',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
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
    command: `./node_modules/.bin/vite build && ./node_modules/.bin/vite preview --host 127.0.0.1 --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
