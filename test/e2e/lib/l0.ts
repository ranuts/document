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
 * or `l0.allowConsole(...)` so the expectation is explicit.
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
    bucket.frameErrors.push({
      kind: 'error',
      message: describe(event.error ?? event.message),
      href: location.pathname,
    });
  });
  const tryHook = () => {
    const api = (window as unknown as { Asc?: { editor?: Record<string, unknown> } }).Asc?.editor;
    if (!api || typeof api.asc_registerCallback !== 'function' || bucket.hooked.has(api)) return;
    bucket.hooked.add(api);
    (api.asc_registerCallback as (name: string, cb: (...args: unknown[]) => void) => void)(
      'asc_onError',
      (id: unknown, level: unknown) => {
        bucket.ascErrors.push({ id: String(id), level: String(level), href: location.pathname });
      },
    );
  };
  const timer = setInterval(tryHook, 250);
  window.addEventListener('pagehide', () => clearInterval(timer));
};

export class L0Collector {
  readonly consoleErrors: string[] = [];
  readonly pageErrors: string[] = [];
  private readonly consoleAllow: RegExp[] = [...CONSOLE_ALLOWLIST];
  private readonly frameAllow: RegExp[] = [];
  private expectedAsc: Array<(e: AscError) => boolean> = [];

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

  /** Allow uncaught frame errors / rejections matching `re` for this test only. */
  allowFrameError(re: RegExp): void {
    this.frameAllow.push(re);
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
    const unexpectedAsc = errors.filter((e) => !this.expectedAsc.some((m) => m(e)));
    const missingAsc = this.expectedAsc.filter((m) => !errors.some(m)).length;

    const report = {
      ascErrors: errors,
      fatalDialog: dialog,
      frameErrors,
      pageErrors: this.pageErrors,
      consoleErrors: this.consoleErrors,
    };
    const dirty =
      unexpectedAsc.length ||
      missingAsc ||
      dialog ||
      frameErrors.length ||
      this.pageErrors.length ||
      this.consoleErrors.length;
    if (dirty) {
      await testInfo.attach('l0-report', { body: JSON.stringify(report, null, 2), contentType: 'application/json' });
    }
    if (testInfo.status !== testInfo.expectedStatus) return;

    expect(unexpectedAsc, `L0: unexpected asc_onError ${JSON.stringify(unexpectedAsc)}`).toEqual([]);
    expect(missingAsc, 'L0: an expected asc_onError never fired').toBe(0);
    expect(dialog, `L0: fatal editor dialog visible: ${dialog}`).toBeNull();
    expect(frameErrors, `L0: uncaught errors inside editor frames ${JSON.stringify(frameErrors)}`).toEqual([]);
    expect(this.pageErrors, `L0: uncaught page errors ${JSON.stringify(this.pageErrors)}`).toEqual([]);
    expect(this.consoleErrors, `L0: console.error output ${JSON.stringify(this.consoleErrors)}`).toEqual([]);
  }
}

export const test = base.extend<{ l0: L0Collector }>({
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
