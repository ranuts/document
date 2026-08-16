import { expect, test } from './lib/l0';

declare const XLSX: any;
declare function post(type: string, payload?: Record<string, unknown>): Promise<any>;

/**
 * Cold open + first save under a throttled link (L4, matrix section C
 * "网络"). The first save pays for the ~10 MB x2t.wasm.gz plus the import;
 * on a mainland-to-CDN link that measured 26-50 s and used to trip the old
 * 60 s save timeout ("Save request timed out" while the file was still on
 * its way). Emulate a slow but common profile with CDP and assert the whole
 * cold path stays inside the product's budget. Nightly-class (SLOW_NET=1):
 * it deliberately takes a minute or two.
 */
test.describe('slow network budget (real editor)', () => {
  test.skip(!process.env.SLOW_NET, 'SLOW_NET not set -- throttled-network budget is a nightly suite');
  // CDP throttling applies to the page's network stack; a service worker is a
  // separate worker target and its fetches would bypass it. Block the SW so
  // every byte (wasm, sdk, fonts) really crosses the throttled link.
  test.use({ serviceWorkers: 'block' });
  test.describe.configure({ timeout: 400_000 });

  for (const profile of [
    // ~4 Mbps down, 1 Mbps up, 150 ms RTT: a modest mobile / cross-border link.
    { name: '4mbps-150ms', download: (4 * 1024 * 1024) / 8, upload: (1024 * 1024) / 8, latency: 150 },
  ]) {
    test(`cold open + first save within budget on ${profile.name}`, async ({ page, context }) => {
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        downloadThroughput: profile.download,
        uploadThroughput: profile.upload,
        latency: profile.latency,
      });

      const t0 = Date.now();
      await page.goto('/embed-demo.html');
      await expect(page.locator('#status')).toHaveText('ready', { timeout: 180_000 });
      const readyMs = Date.now() - t0;

      const result = await page.evaluate(async () => {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['slow', 'net']]), 'S');
        const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const t1 = Date.now();
        await post('document:open-buffer', {
          fileName: 'slow.xlsx',
          buffer: new Uint8Array(data).buffer,
          readonly: false,
        });
        const t2 = Date.now();
        const saved = await post('document:save', {});
        return { openMs: t2 - t1, saveMs: Date.now() - t2, size: saved.size as number };
      });

      test.info().annotations.push({
        type: 'slow-network',
        description: `${profile.name}: page ready ${readyMs} ms, open ${result.openMs} ms, first save ${result.saveMs} ms`,
      });
      console.log(`SLOW-NET ${profile.name}: ready=${readyMs}ms open=${result.openMs}ms save=${result.saveMs}ms`);
      expect(result.size).toBeGreaterThan(500);
      // Budget: the whole cold path (page + editor + wasm + import + export)
      // must finish well inside the save request's 180 s allowance.
      expect(readyMs + result.openMs + result.saveMs).toBeLessThan(150_000);
    });
  }
});
