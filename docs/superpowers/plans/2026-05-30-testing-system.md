# Testing System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a gradual Vitest and Playwright testing system with coverage and CI integration.

**Architecture:** Vitest covers pure and lightweight browser-facing TypeScript under `test/unit`. Playwright covers smoke and iframe API behavior under `test/e2e` using Vite's dev server. CI keeps lint fast and adds coverage plus E2E artifacts without requiring full OnlyOffice editing automation.

**Tech Stack:** Vitest, @vitest/coverage-v8, jsdom, Playwright, Vite, GitHub Actions, pnpm.

---

## File Structure

- Modify `package.json` to add test scripts and dev dependencies.
- Create `vitest.config.ts` for jsdom unit tests, aliases, setup file, coverage thresholds, and include patterns.
- Create `test/setup/vitest.ts` for browser API shims used by unit tests.
- Create `test/unit/document-utils.test.ts` for document type and MIME behavior.
- Create `test/unit/i18n.test.ts` for language and fallback behavior.
- Create `test/unit/onlyoffice-editor.test.ts` for readonly and save error branches with a mocked editor.
- Create `playwright.config.ts` for E2E server, traces, screenshots on failure, and stable viewport.
- Create `test/e2e/app-smoke.spec.ts` for homepage and static asset smoke checks.
- Create `test/e2e/embed-api.spec.ts` for iframe API error behavior that does not require opening a real document.
- Modify `.github/workflows/ci.yml` to run coverage and E2E checks and upload reports on failure.

### Task 1: Add Test Dependencies And Scripts

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Add package scripts and dev dependencies**

Update `package.json` so `scripts` contains:

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage",
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui"
}
```

Add these dev dependencies:

```json
{
  "@playwright/test": "^1.60.0",
  "@vitest/coverage-v8": "^4.0.15",
  "jsdom": "^27.3.0",
  "vitest": "^4.0.15"
}
```

- [ ] **Step 2: Install dependencies**

Run:

```bash
pnpm install
```

Expected: `pnpm-lock.yaml` updates and the command exits 0.

- [ ] **Step 3: Verify existing checks still run**

Run:

```bash
pnpm run tsc
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "test: add testing dependencies"
```

### Task 2: Configure Vitest

**Files:**
- Create: `vitest.config.ts`
- Create: `test/setup/vitest.ts`

- [ ] **Step 1: Create Vitest config**

Create `vitest.config.ts`:

```ts
import path, { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  resolve: {
    alias: {
      '@/lib': resolve(__dirname, 'lib'),
      '@/store': resolve(__dirname, 'store'),
      '@/assets': resolve(__dirname, 'assets'),
      '@/types': resolve(__dirname, 'types'),
      '@/styles': resolve(__dirname, 'styles'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['test/setup/vitest.ts'],
    include: ['test/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      thresholds: {
        lines: 35,
        branches: 25,
        functions: 35,
        statements: 35,
      },
      include: ['lib/**/*.ts'],
      exclude: ['lib/empty_bin.ts', 'lib/file-types.ts', 'lib/document-types.ts'],
    },
  },
});
```

- [ ] **Step 2: Create test setup**

Create `test/setup/vitest.ts`:

```ts
import { vi } from 'vitest';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

URL.createObjectURL = vi.fn(() => 'blob:vitest-document');
URL.revokeObjectURL = vi.fn();
```

- [ ] **Step 3: Verify Vitest runs with no tests**

Run:

```bash
pnpm test -- --passWithNoTests
```

Expected: exit 0 with no test files found or no tests run.

- [ ] **Step 4: Commit**

```bash
git add vitest.config.ts test/setup/vitest.ts
git commit -m "test: configure vitest"
```

### Task 3: Add Unit Tests For Pure Logic

**Files:**
- Create: `test/unit/document-utils.test.ts`
- Create: `test/unit/i18n.test.ts`

- [ ] **Step 1: Inspect exported APIs**

Run:

```bash
sed -n '1,220p' lib/document-utils.ts
sed -n '1,220p' lib/i18n.ts
```

Expected: identify exported function names before writing tests.

- [ ] **Step 2: Write document utility tests**

Create `test/unit/document-utils.test.ts` using the actual exported names from `lib/document-utils.ts`. The tests must cover document type classification, MIME lookup, and unknown extension fallback. Use this shape:

```ts
import { describe, expect, it } from 'vitest';
import { getDocumentType, getMimeTypeFromExtension } from '../../lib/document-utils';

describe('document utils', () => {
  it('classifies common document extensions', () => {
    expect(getDocumentType('docx')).toBe('word');
    expect(getDocumentType('xlsx')).toBe('cell');
    expect(getDocumentType('pptx')).toBe('slide');
  });

  it('normalizes extension casing for MIME lookup', () => {
    expect(getMimeTypeFromExtension('XLSX')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
  });

  it('falls back for unknown extensions', () => {
    expect(getMimeTypeFromExtension('unknown')).toBe('application/octet-stream');
  });
});
```

- [ ] **Step 3: Write i18n tests**

Create `test/unit/i18n.test.ts` using the actual exported names from `lib/i18n.ts`. Cover default language, known translation lookup, and fallback key behavior. Use this shape and adjust only if exports differ:

```ts
import { describe, expect, it } from 'vitest';
import { getOnlyOfficeLang, t } from '../../lib/i18n';

describe('i18n', () => {
  it('returns an OnlyOffice language code', () => {
    expect(['en', 'zh']).toContain(getOnlyOfficeLang());
  });

  it('returns a known translation', () => {
    expect(t('documentLoaded')).not.toBe('documentLoaded');
  });

  it('falls back to the key for unknown translations', () => {
    expect(t('missing.translation.key')).toBe('missing.translation.key');
  });
});
```

- [ ] **Step 4: Run tests and fix API mismatches**

Run:

```bash
pnpm test
```

Expected: tests pass. If an export name differs, update imports to match the actual exported API without changing production behavior.

- [ ] **Step 5: Commit**

```bash
git add test/unit/document-utils.test.ts test/unit/i18n.test.ts
git commit -m "test: cover document utilities"
```

### Task 4: Add Unit Tests For Editor Error Branches

**Files:**
- Create: `test/unit/onlyoffice-editor.test.ts`

- [ ] **Step 1: Write failing tests for readonly and save errors**

Create `test/unit/onlyoffice-editor.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getReadonlyMode, requestSaveDocument, setReadonlyMode } from '../../lib/onlyoffice-editor';

declare global {
  interface Window {
    editor?: {
      sendCommand: ReturnType<typeof vi.fn>;
      downloadAs?: ReturnType<typeof vi.fn>;
      destroyEditor: ReturnType<typeof vi.fn>;
    };
  }
}

describe('onlyoffice editor public controls', () => {
  beforeEach(() => {
    window.editor = undefined;
  });

  it('sends rights changes when readonly mode is toggled', () => {
    const sendCommand = vi.fn();
    window.editor = {
      sendCommand,
      destroyEditor: vi.fn(),
    };

    setReadonlyMode(true);

    expect(getReadonlyMode()).toBe(true);
    expect(sendCommand).toHaveBeenCalledWith({
      command: 'processRightsChange',
      data: {
        enabled: false,
        message: 'Readonly mode',
      },
    });
  });

  it('rejects save requests when no document is open', async () => {
    await expect(requestSaveDocument()).rejects.toThrow('No document is open');
  });

  it('rejects save requests when the current document is readonly', async () => {
    window.editor = {
      sendCommand: vi.fn(),
      downloadAs: vi.fn(),
      destroyEditor: vi.fn(),
    };
    setReadonlyMode(true);

    await expect(requestSaveDocument()).rejects.toThrow('Current document is readonly');
  });
});
```

- [ ] **Step 2: Run the focused test**

Run:

```bash
pnpm test -- test/unit/onlyoffice-editor.test.ts
```

Expected: tests pass. If module-level readonly state leaks, add `setReadonlyMode(false)` in `beforeEach` after assigning a mocked editor.

- [ ] **Step 3: Run coverage**

Run:

```bash
pnpm run test:coverage
```

Expected: exit 0 and coverage report generated.

- [ ] **Step 4: Commit**

```bash
git add test/unit/onlyoffice-editor.test.ts
git commit -m "test: cover editor control errors"
```

### Task 5: Configure Playwright

**Files:**
- Create: `playwright.config.ts`
- Create: `test/e2e/app-smoke.spec.ts`

- [ ] **Step 1: Create Playwright config**

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'test/e2e',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
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
    command: 'pnpm run build && pnpm exec vite preview --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

- [ ] **Step 2: Create homepage smoke tests**

Create `test/e2e/app-smoke.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('homepage loads without page errors', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');

  await expect(page.locator('#control-panel-container')).toBeVisible();
  await expect(page.locator('#iframe')).toBeAttached();
  expect(pageErrors).toEqual([]);
});

test('manifest and service worker assets are reachable', async ({ request }) => {
  const manifest = await request.get('/manifest.json');
  expect(manifest.ok()).toBe(true);

  const serviceWorker = await request.get('/sw.js');
  expect(serviceWorker.ok()).toBe(true);
});
```

- [ ] **Step 3: Run E2E smoke tests**

Run:

```bash
pnpm run test:e2e -- test/e2e/app-smoke.spec.ts
```

Expected: Chromium project passes.

- [ ] **Step 4: Commit**

```bash
git add playwright.config.ts test/e2e/app-smoke.spec.ts
git commit -m "test: add playwright smoke tests"
```

### Task 6: Add Embed API E2E Coverage

**Files:**
- Create: `test/e2e/embed-api.spec.ts`

- [ ] **Step 1: Write embed error behavior test**

Create `test/e2e/embed-api.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('embed mode reports save error when no document is open', async ({ page }) => {
  await page.goto('/?embed=1');

  const responsePromise = page.evaluate(
    () =>
      new Promise<{ type: string; payload?: { message?: string } }>((resolve) => {
        window.addEventListener(
          'message',
          (event) => {
            const data = event.data;
            if (data && data.id === 'e2e-save-empty') {
              resolve(data);
            }
          },
          { once: true },
        );

        window.postMessage(
          {
            id: 'e2e-save-empty',
            type: 'document:save',
            payload: { targetExt: 'XLSX' },
          },
          window.location.origin,
        );
      }),
  );

  await expect(responsePromise).resolves.toMatchObject({
    type: 'document:error',
    payload: {
      message: 'No document is open',
    },
  });
});
```

- [ ] **Step 2: Run embed E2E test**

Run:

```bash
pnpm run test:e2e -- test/e2e/embed-api.spec.ts
```

Expected: Chromium project passes.

- [ ] **Step 3: Run all E2E tests**

Run:

```bash
pnpm run test:e2e
```

Expected: all E2E tests pass.

- [ ] **Step 4: Commit**

```bash
git add test/e2e/embed-api.spec.ts
git commit -m "test: cover embed api errors"
```

### Task 7: Add CI Test Jobs

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add coverage to validation job**

In `.github/workflows/ci.yml`, after `Run oxlint and TypeScript checks`, add:

```yaml
      - name: Run unit tests with coverage
        run: pnpm run test:coverage
```

- [ ] **Step 2: Add E2E job**

Add a new job after `lint`:

```yaml
  e2e:
    name: E2E
    runs-on: ubuntu-latest
    needs: lint

    steps:
      - name: Checkout code
        uses: actions/checkout@v6

      - uses: pnpm/action-setup@v6
        name: Install pnpm
        with:
          run_install: false

      - name: Setup Node.js
        uses: actions/setup-node@v6
        with:
          node-version: "22"
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Install Playwright browsers
        run: pnpm exec playwright install --with-deps chromium

      - name: Run E2E tests
        run: pnpm run test:e2e

      - name: Upload Playwright report
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

- [ ] **Step 3: Verify CI YAML**

Run:

```bash
pnpm run lint:ts
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run coverage and e2e tests"
```

### Task 8: Final Verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run frozen install**

Run:

```bash
pnpm install --frozen-lockfile
```

Expected: exit 0.

- [ ] **Step 2: Run lint and type checks**

Run:

```bash
pnpm run lint:ts
```

Expected: exit 0. Existing warnings are acceptable only if the command exits 0.

- [ ] **Step 3: Run coverage**

Run:

```bash
pnpm run test:coverage
```

Expected: exit 0 and thresholds pass.

- [ ] **Step 4: Run E2E tests**

Run:

```bash
pnpm run test:e2e
```

Expected: exit 0.

- [ ] **Step 5: Run production build**

Run:

```bash
pnpm run build
```

Expected: exit 0.

- [ ] **Step 6: Commit final adjustments**

If final verification required any fixes:

```bash
git add .
git commit -m "test: stabilize testing system"
```

If no fixes were needed, do not create an empty commit.

## Self-Review

- Spec coverage: unit tests, coverage, E2E smoke tests, minimal snapshots, CI integration, and non-goals are represented.
- Placeholder scan: no TBD or TODO instructions remain.
- Type consistency: scripts, paths, config names, and test command names are consistent across tasks.
