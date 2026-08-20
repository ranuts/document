import { expect, test } from './lib/l0';
import { waitForEditorReady } from './actions/editor';

/**
 * The vendored editor must be served cache-first (public/sw.js, branch 4b).
 *
 * Under stale-while-revalidate every entry was revalidated with
 * `cache: 'no-cache'`, so a warm profile still sent 46 requests for /sdkjs/ and
 * /web-apps/ files it already held on a second open of a .docx. The font
 * catalog had already been carved out of that path (it stalled a CJK deck on
 * "Loading presentation" for minutes in production); the rest of the tree had
 * the same disease.
 *
 * What makes cache-first correct is that the runtime cache is named after the
 * vendor CONTENT, not the build: the name changes if and only if a byte under
 * sdkjs/ web-apps/ fonts/ changes, our own patches included. So a matching
 * cache name implies matching bytes, and a stale entry is unreachable.
 * `sw-warm.spec.ts` guards that naming; this guards the strategy that rests on it.
 *
 * Reverse-verified: putting the vendor branch back on stale-while-revalidate
 * makes the sentinel assertion below fail.
 */
test.describe('vendored editor cache strategy', () => {
  test.describe.configure({ timeout: 180_000 });

  test('a cached vendor asset is answered without revalidating it over the network', async ({ page }) => {
    // Cold open populates the cache. The first navigation is uncontrolled, so
    // reload once to get a page the service worker actually serves.
    await page.goto('/editor?new=docx');
    await waitForEditorReady(page);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await waitForEditorReady(page);
    expect(
      await page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
      'the editor page must be SW-controlled on the second load',
    ).toBe(true);

    // Both strategies hand back the cached copy, so the response cannot tell
    // them apart. The observable difference is what happens to the cache ENTRY:
    // stale-while-revalidate overwrites it from the network, cache-first never
    // reaches the network at all. Plant a sentinel and see whether it survives.
    // (Counting requests from the test cannot see this either -- the SW's own
    // revalidation fetches never surface as page-level request events.)
    const result = await page.evaluate(async () => {
      const runtime = (await caches.keys()).find((name) => name.startsWith('document-editor-runtime-'));
      if (!runtime) return { error: 'no runtime cache' };
      const cache = await caches.open(runtime);
      const request = (await cache.keys()).find((entry) => {
        const path = new URL(entry.url).pathname;
        return path.startsWith('/sdkjs/') && path.endsWith('.js') && !path.includes('/spell/');
      });
      if (!request) return { error: 'no cached /sdkjs/*.js entry to probe' };

      const sentinel = '/* sw vendor cache-first sentinel */';
      const path = new URL(request.url).pathname;
      await cache.put(request, new Response(sentinel, { headers: { 'Content-Type': 'text/javascript' } }));

      const served = await (await fetch(path)).text();
      // Give a background revalidation, if there were one, time to land.
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const after = await (await cache.match(request))?.text();
      return { served, after, sentinel, path };
    });

    expect(result.error, `probe could not run: ${result.error}`).toBeUndefined();
    expect(result.served, 'the SW must answer a vendor URL from its cache').toBe(result.sentinel);
    expect(
      result.after,
      `the cached entry for ${result.path} was overwritten, so the SW revalidated it over the network`,
    ).toBe(result.sentinel);
  });
});
