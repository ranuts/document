import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from './lib/l0';
import { settleEditor } from './lib/visual';

/**
 * A tab whose service worker is an older build moves itself onto the new one,
 * without asking and without being told to.
 *
 * Why it has to: a deploy that changed the vendored tree leaves its worker
 * WAITING, because activating it deletes the caches the outgoing build is
 * still reading from. Nothing promotes it while a document is open, and the
 * editor route practically always has one -- so the tab keeps being served the
 * old vendor tree even though the page and its bundle came from the network
 * and are new. When that old tree names files the deploy deleted, the result
 * is not a stale page but a broken one: the font sweep's reverted build kept
 * rendering garbled text for a day after the revert had shipped, and reloading
 * did not help.
 *
 * The test deploys a second build the only way a static preview can: it
 * rewrites the vendor stamp inside the served sw.js, which is exactly what
 * bin/build.sh does when the vendored tree changes.
 *
 * That rewrite is visible to the whole origin, so this case is `@serial`: run
 * beside others it replaces THEIR service worker mid-test too, which wipes the
 * cache under them (an editor mid-load then fails to fetch spell.wasm, and the
 * cache-first case stops seeing its cached asset). It is skipped where the
 * served files are not on this disk -- the Docker image and any run against a
 * deployed site.
 */
const PORT = process.env.E2E_PORT ?? '4173';
const OUT_DIR = process.env.E2E_PORT ? `dist-e2e-${PORT}` : 'dist';
const SW_PATH = resolve(process.cwd(), OUT_DIR, 'sw.js');

/** Ask whichever worker controls this page which build it is. */
const controllerVendorVersion = (page: import('@playwright/test').Page) =>
  page.evaluate(async () => {
    const controller = navigator.serviceWorker.controller;
    if (!controller) return null;
    return await new Promise<string | null>((done) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = (event) => done((event.data?.vendorVersion as string) ?? null);
      setTimeout(() => done(null), 3000);
      controller.postMessage({ type: 'VERSION' }, [channel.port2]);
    });
  });

test.describe('a stale build heals itself @serial', () => {
  test.describe.configure({ timeout: 240_000 });
  // The container and a deployed site serve their own copy; there is nothing
  // here to rewrite, and no way to deploy a second build mid-run.
  test.skip(!existsSync(SW_PATH), 'needs the locally built site this run is serving');

  let original = '';
  test.beforeAll(() => {
    original = readFileSync(SW_PATH, 'utf8');
  });
  test.afterAll(() => {
    if (original) writeFileSync(SW_PATH, original);
  });

  test('a new vendor build takes over on the next load, silently', async ({ page }) => {
    await page.goto('/editor?new=docx');
    await settleEditor(page);
    // The worker only controls the page from the load after it installed.
    await page.reload();
    await settleEditor(page);
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, undefined, { timeout: 30_000 });
    const before = await controllerVendorVersion(page);
    expect(before, 'the page is controlled by a worker that reports its build').toBeTruthy();

    // Deploy: same site, new vendor stamp.
    writeFileSync(SW_PATH, original.replace(/const VENDOR_VERSION = [^;]+;/, "const VENDOR_VERSION = 'e2e-next';"));

    await page.reload();
    // No click, no prompt: the page notices the build it is being served is not
    // the one that is installed, and reloads itself into the new one.
    await page.waitForFunction(
      async () => {
        const controller = navigator.serviceWorker.controller;
        if (!controller) return false;
        return await new Promise<boolean>((done) => {
          const channel = new MessageChannel();
          channel.port1.onmessage = (event) => done(event.data?.vendorVersion === 'e2e-next');
          setTimeout(() => done(false), 1000);
          controller.postMessage({ type: 'VERSION' }, [channel.port2]);
        });
      },
      undefined,
      { timeout: 90_000 },
    );
    await settleEditor(page);
    expect(await controllerVendorVersion(page)).toBe('e2e-next');
    expect(await page.locator('#update-notice').count(), 'nothing was shown to the reader').toBe(0);
  });
});
