import { expect, test } from './lib/l0';

/**
 * The landing page warms the editor while the visitor reads it.
 *
 * The problem it solves, measured: the landing page is 0.5 MB, and the first
 * open that follows pulls ~34 MB. The page sits idle for the whole of that
 * download, and it is the one page every visitor passes through.
 *
 * Two properties matter and neither is visible from the page itself:
 *
 *  1. The warmed bytes must land in the SERVICE WORKER's cache, not just the
 *     HTTP cache. The worker serves the vendored tree cache-first, so an entry
 *     it does not hold is re-requested even when the browser still has a copy.
 *     This is what makes the *second* visit free, which is the whole promise.
 *
 *  2. The core list must stay true. It is the set of files every format loads
 *     regardless of what gets opened; if a vendor bump renumbers the font
 *     catalog, warming the old indices is wasted bandwidth AND the real ones
 *     stay cold. So the list is checked against what an actual open requests.
 */

const CORE_FONTS = ['/fonts/059', '/fonts/060', '/fonts/061', '/fonts/062'];

/** Read the SW cache: which of these paths does it hold? */
const cachedPaths = (page: import('@playwright/test').Page, paths: string[]) =>
  page.evaluate(async (wanted) => {
    const held: string[] = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        const path = new URL(request.url).pathname;
        if (wanted.includes(path) && !held.includes(path)) held.push(path);
      }
    }
    return held.sort();
  }, paths);

test.describe('landing page warm-up', () => {
  test.describe.configure({ timeout: 240_000 });

  /**
   * Every editor, not just the shared core. Their disk sizes (57 MB for all
   * three) overstate the cost badly: compressed they are 11.95 MB, which is why
   * warming all three beats betting on one format.
   */
  test('every editor engine ends up cached, not just the shared core', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#landing-hero')).toBeVisible();
    await page.evaluate(() => navigator.serviceWorker.ready);

    // Driven directly rather than waiting on idle timing, which is unbounded.
    await page.evaluate(() => (window as any).__landingPrefetch.warmEverything());

    // Polled, not asserted outright. The page's promise settles when the last
    // response has been read; the worker's cache.put runs on its own side and
    // finishes shortly after. Demanding both at the same instant made this fail
    // in CI on the queue's final file -- true of the assertion, not the feature.
    const missing = async () =>
      page.evaluate(async () => {
        const lp = (window as any).__landingPrefetch;
        const wanted: string[] = lp.CORE.concat(...lp.ENGINES.map(lp.formatUrls));
        const held = new Set<string>();
        for (const name of await caches.keys()) {
          const cache = await caches.open(name);
          for (const request of await cache.keys()) held.add(new URL(request.url).pathname);
        }
        return wanted.filter((u) => !held.has(u));
      });

    await expect.poll(async () => (await missing()).length, { timeout: 120_000 }).toBe(0);

    const shape = await page.evaluate(() => {
      const lp = (window as any).__landingPrefetch;
      return { engines: lp.ENGINES, total: lp.CORE.length + lp.ENGINES.length * lp.formatUrls('docx').length };
    });
    expect(shape.engines, 'all three editors must be warmed').toEqual(['docx', 'xlsx', 'pptx']);
    // Sanity: the core (8) plus four files per editor.
    expect(shape.total).toBe(8 + 3 * 4);
  });

  test('the core assets end up in the service worker cache without any interaction', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#landing-hero')).toBeVisible();

    // The warm-up deliberately waits for the worker: bytes fetched before it
    // controls the page would only reach the HTTP cache.
    await page.evaluate(() => navigator.serviceWorker.ready);

    const core = await page.evaluate(() => (window as any).__landingPrefetch.CORE as string[]);
    expect(core, 'the landing page must expose its core warm-up list').toContain(
      '/sdkjs/common/libfont/engine/fonts.wasm',
    );
    for (const font of CORE_FONTS) {
      expect(core, 'the shared font catalog entries belong in the core list').toContain(font);
    }

    // No hover, no click: this is the background layer doing its job.
    //
    // Polled once a second, not at Playwright's default 100 ms. Reading the
    // cache is not free and it contends with the writer: on Firefox a poll at
    // the default rate kept the worker's put of the last (9.4 MB) core file
    // from ever completing, and the assertion sat at 7 of 8 for its whole
    // three-minute budget. Slowing the observer down makes it land in seconds.
    await expect
      .poll(async () => (await cachedPaths(page, core)).length, { timeout: 180_000, intervals: [1000] })
      .toBe(core.length);
  });

  /**
   * The list is only worth warming if it is what an open actually asks for.
   * A vendor bump that renumbers the catalog would leave this warming four
   * files nobody wants while the real ones stay cold -- silently, since a
   * prefetch has no visible failure mode.
   */
  test('every core font entry is one a real open requests, in all three editors', async ({ page }) => {
    const seen = new Set<string>();
    page.on('response', (res) => {
      const path = new URL(res.url()).pathname;
      if (/^\/fonts\/\d{3}$/.test(path)) seen.add(path);
    });

    for (const kind of ['docx', 'xlsx', 'pptx']) {
      await page.goto(`/editor?new=${kind}`);
      await page
        .waitForFunction(
          () => {
            const frame = document.querySelector('iframe');
            try {
              return (frame?.contentWindow as any)?.Asc?.editor?.isDocumentLoadComplete === true;
            } catch {
              return false;
            }
          },
          null,
          { timeout: 120_000 },
        )
        .catch(() => {});
      await page.waitForTimeout(1500);
    }

    for (const font of CORE_FONTS) {
      expect(
        seen.has(font),
        `${font} is warmed as a shared catalog entry but no editor requested it -- the catalog was probably renumbered by a vendor bump`,
      ).toBe(true);
    }
  });

  /**
   * The point of all of it: after the landing page has been warmed, opening a
   * document does not go back to the network for the core files.
   */
  test('after warming, opening a document does not re-request the core files', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#landing-hero')).toBeVisible();
    await page.evaluate(() => navigator.serviceWorker.ready);
    const core = await page.evaluate(() => (window as any).__landingPrefetch.CORE as string[]);
    // Once a second, for the reason spelled out in the test above.
    await expect
      .poll(async () => (await cachedPaths(page, core)).length, { timeout: 180_000, intervals: [1000] })
      .toBe(core.length);

    // Warm the engines too, then watch what still leaves the page.
    await page.evaluate(() => (window as any).__landingPrefetch.warmEverything());
    const watched = core.concat(
      await page.evaluate(() => (window as any).__landingPrefetch.formatUrls('docx') as string[]),
    );

    const fromNetwork: string[] = [];
    page.on('response', (res) => {
      const path = new URL(res.url()).pathname;
      if (watched.includes(path) && !res.fromServiceWorker()) fromNetwork.push(path);
    });

    await page.goto('/editor?new=docx');
    await page
      .waitForFunction(
        () => {
          const frame = document.querySelector('iframe');
          try {
            return (frame?.contentWindow as any)?.Asc?.editor?.isDocumentLoadComplete === true;
          } catch {
            return false;
          }
        },
        null,
        { timeout: 120_000 },
      )
      .catch(() => {});

    expect(fromNetwork, `warmed files fetched from the network anyway: ${fromNetwork.join(', ')}`).toEqual([]);
  });
});
