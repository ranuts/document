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
  });
});
