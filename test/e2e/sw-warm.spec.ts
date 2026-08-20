import { expect, test } from './lib/l0';

declare const XLSX: any;
declare function post(type: string, payload?: Record<string, unknown>): Promise<any>;

/**
 * Environment dimension "service worker already controls the page" (matrix
 * section C, escape table row 1). Every other E2E runs on a cold profile
 * where the first navigation is uncontrolled; returning users always load
 * through the SW, and the campaign's live report (fatal dialog on a real
 * deck) is suspected to come from that path. Warm the SW, reload so it
 * controls the demo page and every editor frame, then open + save.
 */
test.describe('warm service worker (real editor)', () => {
  test.describe.configure({ timeout: 150_000 });

  test('opens and round-trips a workbook when the SW controls the page', async ({ page }) => {
    await page.goto('/embed-demo.html');
    await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });
    // Let the SW install/activate, then reload into a controlled document.
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      if (!reg.active) throw new Error('service worker never activated');
    });
    await page.reload();
    await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });
    const controlled = await page.evaluate(() => Boolean(navigator.serviceWorker.controller));
    expect(controlled, 'the demo page must be SW-controlled on the second load').toBe(true);

    const result = await page.evaluate(async () => {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([
          ['warm', 'sw'],
          ['a', 1],
        ]),
        'S',
      );
      const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      await post('document:open-buffer', {
        fileName: 'warm.xlsx',
        buffer: new Uint8Array(data).buffer,
        readonly: false,
      });
      const saved = await post('document:save', {});
      const out = XLSX.read(new Uint8Array(await saved.file.arrayBuffer()), { type: 'array' });
      const frameControlled = (() => {
        const visit = (win: Window): boolean | null => {
          try {
            if (win.location.pathname.includes('/web-apps/apps/'))
              return Boolean(win.navigator.serviceWorker.controller);
          } catch {
            return null;
          }
          for (let i = 0; i < win.frames.length; i++) {
            const r = visit(win.frames[i]);
            if (r !== null) return r;
          }
          return null;
        };
        return visit(window);
      })();
      return {
        name: saved.file.name as string,
        csv: XLSX.utils.sheet_to_csv(out.Sheets[out.SheetNames[0]]).trim(),
        frameControlled,
      };
    });
    expect(result.frameControlled, 'the editor frame itself must be SW-controlled').toBe(true);
    expect(result.name).toBe('warm.xlsx');
    expect(result.csv).toBe('warm,sw\na,1');

    // The runtime cache -- now populated with vendor assets by the open above --
    // must be named after the vendor stamp, not the build stamp. Keyed by the
    // build, every deploy would look like a vendor change, no deploy could
    // activate on its own, and a shipped fix would wait for the user to close
    // every tab of the site (GitHub #144). Read the stamp out of the served
    // worker rather than hardcoding it, so this holds for a `vite build`
    // (stamp `dev`) and for a real bin/build.sh build (a content hash) alike.
    const stamp = await page.evaluate(async () => {
      const source = await (await fetch('/sw.js', { cache: 'no-store' })).text();
      const declared = /VENDOR_VERSION = '([^']*)'/.exec(source)?.[1] ?? null;
      // Same fallback the worker itself applies to an un-substituted stamp.
      const vendor = declared === null ? null : declared.includes('PLACEHOLDER') ? 'dev' : declared;
      const maxItems = Number(/MAX_RUNTIME_ITEMS = (\d+)/.exec(source)?.[1] ?? 0);
      const runtime = (await caches.keys()).filter((name) => name.startsWith('document-editor-runtime-'));
      const entries = runtime.length ? (await (await caches.open(runtime[0])).keys()).length : 0;
      const vendorEntries = runtime.length
        ? (await (await caches.open(runtime[0])).keys()).filter((request) =>
            /^\/(?:sdkjs|web-apps|fonts)\//.test(new URL(request.url).pathname),
          ).length
        : 0;
      return { vendor, runtime, maxItems, entries, vendorEntries };
    });
    expect(stamp.vendor, 'sw.js must declare a vendor stamp').not.toBeNull();
    expect(stamp.runtime, 'the open must have populated exactly one runtime cache').toHaveLength(1);
    expect(stamp.runtime[0]).toBe(`document-editor-runtime-${stamp.vendor}`);

    // Headroom under MAX_RUNTIME_ITEMS, measured rather than assumed.
    //
    // Naming the runtime cache after the vendor content means nothing empties
    // it on a normal deploy any more: `pruneAppAssets` skips itself while a
    // window is open, and a vendor-unchanged deploy now activates during
    // install, i.e. always under a live window. So the retired builds'
    // `/assets/<hash>` entries accumulate until the next activation that
    // happens with every tab closed. What keeps that safe is `limitCacheSize`
    // evicting app entries before vendor ones -- but only while the vendor
    // half alone stays well under the cap. Measured here after a full open
    // (~340 entries of which ~300 are vendor); the bound is deliberately loose
    // and exists to fail loudly if a vendor bump doubles the working set.
    expect(stamp.maxItems, 'sw.js must declare MAX_RUNTIME_ITEMS').toBeGreaterThan(0);
    expect(stamp.entries, 'the open must have populated the runtime cache').toBeGreaterThan(0);
    expect(
      stamp.vendorEntries,
      `vendor entries (${stamp.vendorEntries}) must stay far below MAX_RUNTIME_ITEMS (${stamp.maxItems}), ` +
        'or the trim starts evicting the binaries it was added to protect',
    ).toBeLessThan(stamp.maxItems / 2);
  });

  /**
   * The update policy the landing page now carries (public/sw-register.js)
   * rests on one thing the page cannot answer by itself: whether any other
   * window is open, because activating a new worker deletes the outgoing
   * build's caches under it. sw.js answers that over a transferred port, and
   * this is that protocol against the real worker.
   */
  test('the landing page can ask the worker what it controls', async ({ page, context }) => {
    await page.goto('/');
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      if (!reg.active) throw new Error('service worker never activated');
    });
    // Second load: the page is controlled, so it has a controller to ask.
    await page.reload();
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

    type Answer = { count: number; editors: number } | null;
    const ask = (target: typeof page): Promise<Answer> =>
      target.evaluate(
        () =>
          new Promise<Answer>((resolve) => {
            const controller = navigator.serviceWorker.controller;
            if (!controller) return resolve(null);
            const channel = new MessageChannel();
            const timer = setTimeout(() => resolve(null), 5_000);
            channel.port1.onmessage = (event) => {
              clearTimeout(timer);
              const data = event.data as { count?: unknown; editors?: unknown } | undefined;
              resolve(
                typeof data?.count === 'number' && typeof data.editors === 'number'
                  ? { count: data.count, editors: data.editors }
                  : null,
              );
            };
            controller.postMessage({ type: 'CLIENT_COUNT' }, [channel.port2]);
          }),
      );

    // Alone on a landing page: promotion is safe, and the answer must say so.
    expect(await ask(page)).toEqual({ count: 1, editors: 0 });

    // A second LANDING tab raises the count but not the editor count: it has
    // no session an activation could spoil, so promotion stays allowed.
    const secondLanding = await context.newPage();
    await secondLanding.goto('/');
    await expect.poll(() => secondLanding.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    await expect.poll(async () => (await ask(page))?.count).toBeGreaterThan(1);
    expect((await ask(page))?.editors).toBe(0);
    await secondLanding.close();

    // An editor window is the one that must block it -- it may have a document
    // open, and it is deliberately not reloaded when a new worker takes over.
    const editor = await context.newPage();
    await editor.goto('/editor?new=docx');
    await expect.poll(() => editor.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    await expect.poll(async () => (await ask(page))?.editors).toBe(1);
    await editor.close();

    // And falls back once it closes, so a later visit can update again.
    await expect.poll(async () => await ask(page)).toEqual({ count: 1, editors: 0 });
  });
});
