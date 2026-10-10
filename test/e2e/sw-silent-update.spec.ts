import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from './lib/l0';
import { settleEditor } from './lib/visual';
import { stampOfflineAssets } from '../../bin/offline-assets.mjs';

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
    return await new Promise<string | null>((resolve) => {
      const channel = new MessageChannel();
      let settled = false;
      const done = (value: string | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        channel.port1.close();
        channel.port2.close();
        resolve(value);
      };
      const timer = setTimeout(() => done(null), 3000);
      channel.port1.onmessage = (event) => done((event.data?.vendorVersion as string) ?? null);
      controller.postMessage({ type: 'VERSION' }, [channel.port2]);
    });
  });

test.describe('a stale build heals itself @serial', () => {
  test.describe.configure({ timeout: 240_000 });
  // The container and a deployed site serve their own copy; there is nothing
  // here to rewrite, and no way to deploy a second build mid-run.
  test.skip(!existsSync(SW_PATH), 'needs the locally built site this run is serving');

  let original = '';
  let baseline = '';
  test.beforeAll(async () => {
    original = readFileSync(SW_PATH, 'utf8');
    // Vite preview omits the service-worker postprocessing used by bin/build.sh.
    // Exercise a deployable worker: stable cache identity and complete app precache.
    if (original.includes('const APP_ASSETS_TO_CACHE = []; // BUILD_APP_ASSETS')) {
      await stampOfflineAssets(resolve(process.cwd(), OUT_DIR));
    }
    baseline = readFileSync(SW_PATH, 'utf8')
      .replaceAll('SW_VERSION_PLACEHOLDER', 'e2e-original')
      .replaceAll('VENDOR_VERSION_PLACEHOLDER', 'e2e-original');
    writeFileSync(SW_PATH, baseline);
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

    const changeKey = 'e2e-sw-controller-change';
    const observeControllerChanges = (key: string) => {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        sessionStorage.setItem(key, String(Number(sessionStorage.getItem(key) ?? '0') + 1));
      });
    };
    await page.evaluate((key) => sessionStorage.removeItem(key), changeKey);
    await page.evaluate(observeControllerChanges, changeKey);
    await page.addInitScript(observeControllerChanges, changeKey);

    // Observe both the departing page and the next one before deploying: an
    // update may activate before the new page starts running its init script.
    writeFileSync(SW_PATH, baseline.replace(/const VENDOR_VERSION = [^;]+;/, "const VENDOR_VERSION = 'e2e-next';"));
    await page.reload();
    let queriedChange: string | null = null;
    // No click, no prompt: the page notices the build it is being served is not
    // the one that is installed, and reloads itself into the new one.
    await expect
      .poll(
        async () => {
          try {
            // VERSION messages keep an outgoing worker busy. Chromium waits
            // for renderer idleness before activation, so polling that worker
            // can prevent the takeover this test is trying to observe.
            // Read a new controller only once per observed change; the counter
            // survives the app's automatic reload.
            const change = await page.evaluate((key) => sessionStorage.getItem(key), changeKey);
            if (!change || change === queriedChange) return null;
            const version = await controllerVendorVersion(page);
            if (version !== null) queriedChange = change;
            return version;
          } catch (error) {
            // The behavior under test deliberately reloads the page. A VERSION
            // request can race that navigation; observe the next controller.
            if (error instanceof Error && error.message.includes('Execution context was destroyed')) return null;
            throw error;
          }
        },
        { timeout: 90_000, intervals: [100, 250, 500] },
      )
      .toBe('e2e-next')
      .catch(async (error) => {
        try {
          const state = await page.evaluate(async (key) => {
            const registration = await navigator.serviceWorker.getRegistration();
            const controller = navigator.serviceWorker.controller;
            const waiting = registration?.waiting;
            const query = (worker: ServiceWorker | null | undefined, type: string) =>
              new Promise<unknown>((resolve) => {
                if (!worker) return resolve(null);
                const channel = new MessageChannel();
                let settled = false;
                const done = (value: unknown) => {
                  if (settled) return;
                  settled = true;
                  clearTimeout(timer);
                  channel.port1.close();
                  channel.port2.close();
                  resolve(value);
                };
                const timer = setTimeout(() => done('timeout'), 3000);
                channel.port1.onmessage = (event) => done(event.data);
                try {
                  worker.postMessage({ type }, [channel.port2]);
                } catch (failure) {
                  done(String(failure));
                }
              });
            const workerState = (worker: ServiceWorker | null | undefined) =>
              worker ? { state: worker.state, scriptURL: worker.scriptURL } : null;
            const states = {
              controller: workerState(controller),
              active: workerState(registration?.active),
              waiting: workerState(waiting),
              installing: workerState(registration?.installing),
            };
            const [controllerVersion, waitingVersion, clients] = await Promise.all([
              query(controller, 'VERSION'),
              query(waiting, 'VERSION'),
              query(controller, 'CLIENT_COUNT'),
            ]);
            return {
              states,
              controllerVersion,
              waitingVersion,
              clients,
              healMarker: sessionStorage.getItem('sw-heal-reloaded'),
              controllerChanges: sessionStorage.getItem(key),
            };
          }, changeKey);
          const json = JSON.stringify(state, null, 2);
          console.log('SWFAIL', json);
          await test.info().attach('sw-failure-state.json', { body: json, contentType: 'application/json' });
        } catch (diagnosticError) {
          console.log('SW failure-state collection failed:', String(diagnosticError));
        }
        throw error;
      });
    await settleEditor(page);
    expect(await controllerVendorVersion(page)).toBe('e2e-next');
    expect(await page.locator('#update-notice').count(), 'nothing was shown to the reader').toBe(0);
  });
});
