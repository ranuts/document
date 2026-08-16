import { buildPptx, toBase64 } from './lib/ooxml';
import { expect, test } from './lib/l0';
import { settleEditor } from './lib/visual';

declare function post(type: string, payload?: Record<string, unknown>): Promise<any>;

/**
 * Font delivery regression guard (found live on edit.chaxus.com: the indexed
 * font catalog /fonts/NNN had no cache rule and the service worker's
 * stale-while-revalidate re-downloaded every multi-MB font on every open --
 * a deck's serial font queue took minutes). On the SECOND open in the same
 * page every font response must come from the service worker cache (or the
 * CDN cache when run against production), and the open must be quick.
 * Runs locally and in the production smoke.
 */
test('fonts are served from cache on the second open', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto('/embed-demo.html');
  await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });

  const open = async () => {
    const t0 = Date.now();
    await page.evaluate(
      async (b64) => {
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        await post('document:open-buffer', { fileName: 'fonts.pptx', buffer: bytes.buffer, readonly: false });
      },
      toBase64(buildPptx('Font cache 字体缓存')),
    );
    await settleEditor(page, 1000, 180_000);
    return Date.now() - t0;
  };

  // First open: cold, fonts come from the network (or CDN); just settle.
  await open();

  // Second open: observe every font response.
  const fonts: Array<{ url: string; sw: boolean; cf: string | null; status: number }> = [];
  const listener = (res: import('@playwright/test').Response) => {
    if (/\/fonts\/\d{3}(\?|$)/.test(res.url())) {
      fonts.push({
        url: res.url(),
        sw: res.fromServiceWorker(),
        cf: res.headers()['cf-cache-status'] ?? null,
        status: res.status(),
      });
    }
  };
  page.on('response', listener);
  const secondMs = await open();
  page.off('response', listener);

  test.info().annotations.push({
    type: 'font-cache',
    description: `${fonts.length} font responses on second open in ${secondMs} ms; sw=${fonts.filter((f) => f.sw).length}, cf-hit=${fonts.filter((f) => f.cf === 'HIT').length}`,
  });
  console.log(
    `FONT-CACHE second open ${secondMs}ms, ${fonts.length} font responses`,
    JSON.stringify(fonts.slice(0, 5)),
  );

  const uncached = fonts.filter((f) => !(f.sw || f.cf === 'HIT'));
  expect(uncached, `font responses not served from cache: ${JSON.stringify(uncached.slice(0, 5))}`).toEqual([]);
  expect(secondMs).toBeLessThan(60_000);
});
