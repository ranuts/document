import { buildXlsx, toBase64, zipEntryText } from './lib/ooxml';
import { expect, test } from './lib/l0';

declare function post(type: string, payload?: Record<string, unknown>): Promise<any>;

/**
 * Frozen panes + autofilter (matrix section B "冻结窗格"): features SheetJS
 * cannot emit, hand-built here. Frozen panes threw a burst of
 * "getBoundingClientRect is not a function" in an earlier v9 build when
 * applied from the UI (docs/explorations/2026-08-09-...); the L0 fixture
 * would flag that today. Both the file-borne state and an API toggle must
 * be clean and survive a save.
 */
test.describe('xlsx frozen panes / autofilter (real editor)', () => {
  test.describe.configure({ timeout: 120_000 });

  const workbook = () =>
    toBase64(
      buildXlsx({
        rows: [
          ['id', 'name', 'city'],
          [1, 'alice', 'Shanghai'],
          [2, 'bob', 'Beijing'],
          [3, '李雷', '深圳'],
        ],
        freeze: { rows: 1, cols: 1 },
        autoFilterRef: 'A1:C4',
      }),
    );

  test.beforeEach(async ({ page }) => {
    await page.goto('/embed-demo.html');
    await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });
  });

  test('a workbook with frozen panes and an autofilter opens and keeps both after a save', async ({ page }) => {
    const b64 = await page.evaluate(async (src) => {
      const bin = atob(src);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      await post('document:open-buffer', { fileName: 'panes.xlsx', buffer: bytes.buffer, readonly: false });
      const saved = await post('document:save', {});
      const out = new Uint8Array(await saved.file.arrayBuffer());
      let s = '';
      for (let i = 0; i < out.length; i += 0x8000)
        s += String.fromCharCode.apply(null, Array.from(out.subarray(i, i + 0x8000)));
      return btoa(s);
    }, workbook());
    const bytes = new Uint8Array(Buffer.from(b64, 'base64'));
    const sheet = zipEntryText(bytes, 'xl/worksheets/sheet1.xml') || '';
    expect(sheet).toMatch(/<pane[^>]*state="frozen"/);
    expect(sheet).toMatch(/xSplit="1"/);
    expect(sheet).toMatch(/ySplit="1"/);
    expect(sheet).toMatch(/<autoFilter ref="A1:C4"/);
  });

  test('toggling freeze panes through the SDK API is clean and persists', async ({ page }) => {
    const result = await page.evaluate(
      async (src) => {
        const bin = atob(src);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        // Same workbook without panes: freeze via API, then save.
        await post('document:open-buffer', { fileName: 'freeze-api.xlsx', buffer: bytes.buffer, readonly: false });
        const visit = (win: Window): any => {
          try {
            const a = (win as any).Asc?.editor;
            if (a && typeof a.asc_freezePane === 'function' && a.isDocumentLoadComplete && a.isLoadFullApi) return a;
          } catch {
            /* cross-origin */
          }
          for (let i = 0; i < win.frames.length; i++) {
            const f = visit(win.frames[i]);
            if (f) return f;
          }
          return null;
        };
        const t = Date.now();
        let api = visit(window);
        while (!api && Date.now() - t < 60_000) {
          await new Promise((r) => setTimeout(r, 300));
          api = visit(window);
        }
        if (!api) return { error: 'no api' };
        // Select B2 so the freeze splits above/left of it, then toggle.
        api.asc_selectRange?.('B2');
        api.asc_freezePane();
        await new Promise((r) => setTimeout(r, 1500));
        const frozen = api.asc_getSheetViewSettings?.()?.asc_getIsFreezePane?.() ?? null;
        const saved = await post('document:save', {});
        const out = new Uint8Array(await saved.file.arrayBuffer());
        let s = '';
        for (let i = 0; i < out.length; i += 0x8000)
          s += String.fromCharCode.apply(null, Array.from(out.subarray(i, i + 0x8000)));
        return { frozen, b64: btoa(s) };
      },
      toBase64(
        buildXlsx({
          rows: [
            ['a', 'b'],
            [1, 2],
            [3, 4],
          ],
        }),
      ),
    );
    expect(result.error).toBeUndefined();
    const sheet = zipEntryText(new Uint8Array(Buffer.from(result.b64!, 'base64')), 'xl/worksheets/sheet1.xml') || '';
    expect(sheet).toMatch(/<pane[^>]*state="frozen"/);
  });
});
