import { defineConfig, devices } from '@playwright/test';

// Runs the SAME e2e suite (test/e2e) against the production Docker image
// instead of the vite preview server, proving the container serves the full
// editor correctly end to end (static-web-server file serving, the gzipped
// x2t WASM, extensionless indexed fonts, the embed save round-trip...).
//
// The image must exist as `document:e2e` before the run -- use
// `pnpm run test:e2e:docker`, which builds it first, or build manually with
// `pnpm run docker:build`.
export default defineConfig({
  testDir: 'test/e2e',
  timeout: 120_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report-docker', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:8090',
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
    // Foreground `docker run` so Playwright owns the lifecycle. The kill it
    // sends on shutdown does not always reach the container, so the wrapper
    // (bin/test-e2e-docker.sh) and CI both force-remove the container --
    // never reuse one, or a stale image could be served silently.
    command: 'docker run --rm --name document-e2e-docker -p 8090:80 document:e2e',
    url: 'http://127.0.0.1:8090',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
