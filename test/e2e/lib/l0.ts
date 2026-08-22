import { test as base, expect, type Page, type TestInfo } from '@playwright/test';

/**
 * L0 liveness fixture (docs/superpowers/plans/2026-08-15-v9-test-coverage-strategy.md, section 3).
 *
 * Every E2E test gets this automatically. It turns "the editor reported an
 * error but the test happened to pass anyway" into a hard failure:
 *
 *   - `asc_onError` fired by any SDK instance in any (same-origin) frame;
 *   - the OnlyOffice fatal dialog ("An error occurred during the work with
 *     the document") visible in any frame at the end of the test;
 *   - uncaught page errors;
 *   - console.error lines that are not on the noise allowlist.
 *
 * The corpus campaign's first run had 25/25 real files "passing" the open
 * step while sitting on a spinner forever after a failed import that never
 * surfaced anywhere a test looked; that class of silent failure is what
 * this fixture exists to catch.
 *
 * Tests that intentionally provoke an error call `l0.expectAscError(...)`
 * (required), `l0.allowAscError(...)` (allowed, not required),
 * `l0.allowFrameError(...)` or `l0.allowConsole(...)` so the expectation is
 * explicit.
 */

export type AscError = { id: string; level: string; href: string };
export type FrameError = { kind: 'unhandledrejection' | 'error'; message: string; href: string };

// Console noise that is not a defect. Keep this list short and commented:
// each entry hides a whole class of output from every test.
const CONSOLE_ALLOWLIST: RegExp[] = [
  // Vendor probes for a spellcheck engine / license server that a
  // serverless build never has; the request fails by design.
  /spellcheck|dictionaries|license/i,
  // Chromium reports blocked/aborted subresource fetches (e.g. an image
  // proxy we deliberately do not run) as console errors.
  /Failed to load resource|net::ERR_/i,
  // Our own onError toast path logs the event before surfacing it; the
  // asc_onError hook already reports the same fact with more detail.
  /^\[OO\] editor error:/,
  // Firefox logs this whenever an <img>/CSS sprite load is aborted mid-way,
  // e.g. when an editor iframe is torn down while its toolbar sprite is
  // still streaming; the same file decodes fine (probed 2026-08-15).
  /Image corrupt or truncated/,
];

const FATAL_DIALOG_PATTERN = /error occurred during the work|与文档工作|критическ/i;

declare global {
  interface Window {
    __l0?: { ascErrors: AscError[]; frameErrors: FrameError[]; hooked: WeakSet<object> };
  }
}

const INIT_SCRIPT = () => {
  // Runs at document start in every frame. Registers an asc_onError
  // listener on each SDK instance exactly once and pushes into the top
  // window's collector (all editor frames are same-origin).
  const top = window.top as Window;
  const bucket = (top.__l0 ??= { ascErrors: [], frameErrors: [], hooked: new WeakSet() });
  // Playwright's pageerror does not surface unhandled rejections raised
  // inside the editor iframes, and that is exactly how the vendor's open
  // conversion fails ("Document conversion failed: ...", leaving the load
  // spinner up forever). Capture them per frame.
  const describe = (reason: unknown): string => {
    const r = reason as { message?: unknown } | null;
    return String((r && typeof r === 'object' && 'message' in r ? r.message : reason) ?? '').slice(0, 500);
  };
  window.addEventListener('unhandledrejection', (event) => {
    bucket.frameErrors.push({ kind: 'unhandledrejection', message: describe(event.reason), href: location.pathname });
  });
  window.addEventListener('error', (event) => {
    const err = event.error as { stack?: unknown } | undefined;
    const stack =
      typeof err?.stack === 'string'
        ? ' @ ' + err.stack.split('\n').slice(1, 4).join(' <- ').replace(/\s+/g, ' ').slice(0, 300)
        : '';
    bucket.frameErrors.push({
      kind: 'error',
      message: describe(event.error ?? event.message) + stack,
      href: location.pathname,
    });
  });
  const tryHook = () => {
    const api = (window as unknown as { Asc?: { editor?: Record<string, unknown> } }).Asc?.editor;
    if (!api || typeof api.sendEvent !== 'function' || bucket.hooked.has(api)) return;
    bucket.hooked.add(api);
    // Wrap sendEvent rather than asc_registerCallback: every asc_onError
    // (the SDK's own and the ones our guards inject) goes through it, and
    // a callback registered during early boot can be dropped by the SDK's
    // handler reset (observed on Firefox).
    const orig = api.sendEvent as (...args: unknown[]) => unknown;
    api.sendEvent = function (this: unknown, name: unknown, ...args: unknown[]) {
      if (name === 'asc_onError') {
        bucket.ascErrors.push({ id: String(args[0]), level: String(args[1]), href: location.pathname });
      }
      return orig.call(this, name, ...args);
    };
  };
  // Poll until the SDK instance exists. Deliberately NOT cleared on pagehide:
  // Firefox reuses the Window when an iframe navigates from its initial
  // about:blank, so the old document's pagehide would clear the interval the
  // new document's init script just armed and the hook would never install.
  setInterval(tryHook, 250);
};

export class L0Collector {
  readonly consoleErrors: string[] = [];
  readonly pageErrors: string[] = [];
  private readonly consoleAllow: RegExp[] = [...CONSOLE_ALLOWLIST];
  private readonly frameAllow: RegExp[] = [];
  private expectedAsc: Array<(e: AscError) => boolean> = [];
  private allowedAsc: Array<(e: AscError) => boolean> = [];

  constructor(private readonly page: Page) {}

  async attach(): Promise<void> {
    await this.page.addInitScript(INIT_SCRIPT);
    this.page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      if (this.consoleAllow.some((re) => re.test(text))) return;
      this.consoleErrors.push(text);
    });
    this.page.on('pageerror', (err) => this.pageErrors.push(String(err?.message || err)));
  }

  /** Allow console.error lines matching `re` for this test only. */
  allowConsole(re: RegExp): void {
    this.consoleAllow.push(re);
  }

  /** Allow uncaught errors / rejections (frame-level and page-level) matching `re` for this test only. */
  allowFrameError(re: RegExp): void {
    this.frameAllow.push(re);
  }

  /**
   * Allow (but do not require) asc_onError events matching `pred` -- for
   * suites that legitimately provoke informational errors they cannot predict
   * per test (e.g. the seeded monkey: `l0.allowAscError((e) => e.level === '0')`).
   * Critical errors stay failures unless matched here explicitly.
   */
  allowAscError(pred: (e: AscError) => boolean): void {
    this.allowedAsc.push(pred);
  }

  /** Declare that an asc_onError with this id is expected (and required). */
  expectAscError(id: number | string): void {
    const want = String(id);
    this.expectedAsc.push((e) => e.id === want);
  }

  async frameErrors(): Promise<FrameError[]> {
    if (this.page.isClosed()) return [];
    try {
      return await this.page.evaluate(() => (window.__l0?.frameErrors ?? []).slice());
    } catch {
      return [];
    }
  }

  async ascErrors(): Promise<AscError[]> {
    if (this.page.isClosed()) return [];
    try {
      return await this.page.evaluate(() => (window.__l0?.ascErrors ?? []).slice());
    } catch {
      return [];
    }
  }

  /** Text of a visible OnlyOffice fatal dialog in any frame, or null. */
  async fatalDialog(): Promise<string | null> {
    if (this.page.isClosed()) return null;
    try {
      return await this.page.evaluate((patternSource) => {
        const pattern = new RegExp(patternSource, 'i');
        const visit = (win: Window): string | null => {
          try {
            for (const el of Array.from(win.document.querySelectorAll('.asc-window, .modal, [role="dialog"]'))) {
              const he = el as HTMLElement;
              if (he.offsetParent !== null && pattern.test(he.textContent || '')) {
                return (he.textContent || '').trim().slice(0, 200);
              }
            }
          } catch {
            /* cross-origin */
          }
          for (let i = 0; i < win.frames.length; i++) {
            const found = visit(win.frames[i]);
            if (found) return found;
          }
          return null;
        };
        return visit(window);
      }, FATAL_DIALOG_PATTERN.source);
    } catch {
      return null;
    }
  }

  async assertClean(testInfo: TestInfo): Promise<void> {
    // A test that already failed has its own, more specific message; the L0
    // report is attached for diagnosis but must not mask it.
    const errors = await this.ascErrors();
    const dialog = await this.fatalDialog();
    const frameErrors = (await this.frameErrors()).filter((e) => !this.frameAllow.some((re) => re.test(e.message)));
    // Firefox also reports iframe rejections through Playwright's pageerror;
    // the same allowance covers both channels.
    const pageErrors = this.pageErrors.filter((m) => !this.frameAllow.some((re) => re.test(m)));
    const unexpectedAsc = errors.filter(
      (e) => !this.expectedAsc.some((m) => m(e)) && !this.allowedAsc.some((m) => m(e)),
    );
    const missingAsc = this.expectedAsc.filter((m) => !errors.some(m)).length;

    const report = {
      ascErrors: errors,
      fatalDialog: dialog,
      frameErrors,
      pageErrors,
      consoleErrors: this.consoleErrors,
    };
    const dirty =
      unexpectedAsc.length ||
      missingAsc ||
      dialog ||
      frameErrors.length ||
      pageErrors.length ||
      this.consoleErrors.length;
    if (dirty) {
      await testInfo.attach('l0-report', { body: JSON.stringify(report, null, 2), contentType: 'application/json' });
    }
    if (testInfo.status !== testInfo.expectedStatus) return;

    expect(unexpectedAsc, `L0: unexpected asc_onError ${JSON.stringify(unexpectedAsc)}`).toEqual([]);
    expect(missingAsc, 'L0: an expected asc_onError never fired').toBe(0);
    expect(dialog, `L0: fatal editor dialog visible: ${dialog}`).toBeNull();
    expect(frameErrors, `L0: uncaught errors inside editor frames ${JSON.stringify(frameErrors)}`).toEqual([]);
    expect(pageErrors, `L0: uncaught page errors ${JSON.stringify(pageErrors)}`).toEqual([]);
    expect(this.consoleErrors, `L0: console.error output ${JSON.stringify(this.consoleErrors)}`).toEqual([]);
  }
}

/**
 * Wait until the server under test answers again.
 *
 * Only used where the server can go away mid-run: `wrangler pages dev` is
 * killed by workerd aborting on a large response (which is why that suite is
 * single-worker in the first place), and bin/serve-pages-dev.sh restarts it --
 * about 20 s. Playwright does not notice: its webServer readiness check ran
 * once at startup, and a retry fires immediately, so the retry lands on the
 * same dead port and the whole shard goes red for a server that was back
 * seconds later.
 *
 * Bounded: if the server never comes back the test fails on its own timeout,
 * with the same evidence it would have had anyway.
 */
const SERVER_WAIT_MS = 60_000;

/** One request, swallowing the connection error a dead port raises. */
async function serverAnswers(baseURL: string): Promise<boolean> {
  try {
    await fetch(baseURL, { method: 'GET' });
    return true;
  } catch {
    return false;
  }
}

async function waitForServer(baseURL: string): Promise<void> {
  const deadline = Date.now() + SERVER_WAIT_MS;
  for (;;) {
    if (await serverAnswers(baseURL)) return;
    if (Date.now() > deadline) throw new Error(`server at ${baseURL} did not come back within ${SERVER_WAIT_MS}ms`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

export const test = base.extend<{ l0: L0Collector; serverUp: void }, { projectName: string }>({
  // The name of the project a test is running under. `browserName` cannot
  // stand in for it: a spec that does `test.use({ ...devices['Pixel 5'] })`
  // pulls in the device's `defaultBrowserType: 'chromium'`, so under the
  // nightly's webkit/firefox projects `browserName` reads 'chromium' while
  // the project is not -- a `browserName !== 'chromium'` guard then never
  // fires and Playwright tries to launch a browser that job never installed.
  projectName: [
    // Playwright rejects anything but a destructuring pattern in this position
    // ("First argument must use the object destructuring pattern"); empty is
    // how a fixture says it depends on no other fixture.
    // eslint-disable-next-line no-empty-pattern
    async ({}, use, workerInfo) => {
      await use(workerInfo.project.name);
    },
    { scope: 'worker' },
  ],
  // Opt-in per config (playwright.pages.config.ts sets the variable): every
  // other suite is served by something that does not fall over mid-run, and
  // waiting there would only hide a server that failed to start.
  serverUp: [
    async ({ baseURL }, use, testInfo) => {
      if (process.env.E2E_WAIT_FOR_SERVER && baseURL && !(await serverAnswers(baseURL))) {
        // Pay for the wait out of extra time rather than out of the test's own
        // budget: the default is 30 s, so a 20 s restart would otherwise leave
        // 10 s to open a document in and the case would fail anyway -- just
        // with a less honest message.
        testInfo.setTimeout(testInfo.timeout + SERVER_WAIT_MS);
        await waitForServer(baseURL);
      }
      await use();
    },
    { auto: true },
  ],
  l0: [
    async ({ page }, use, testInfo) => {
      const collector = new L0Collector(page);
      await collector.attach();
      await use(collector);
      await collector.assertClean(testInfo);
    },
    { auto: true },
  ],
});

export { expect };
