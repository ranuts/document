import { expect, test } from '@playwright/test';

/**
 * Regression suite driving the real editor (OnlyOffice Personal vendor)
 * through the embed postMessage API via embed-demo.html -- the exact
 * scenarios that were verified manually during the v9 migration and its
 * issue sweep (docs/explorations/2026-08-11-v9-vendor-swap-*.md and
 * 2026-08-12-v9-pure-ui-and-issue-regression-sweep.md).
 *
 * The demo page provides two globals the tests lean on:
 *   - post(type, payload): sends an embed-API message to the editor iframe
 *     and resolves with the reply payload (45 s internal timeout);
 *   - XLSX (SheetJS): used to build and parse workbook fixtures in-page, so
 *     no binary fixture files need to live in the repo.
 */

declare const XLSX: any;
declare function post(type: string, payload?: Record<string, unknown>): Promise<any>;

test.describe('embed regression (real editor)', () => {
  // Each test boots the real editor iframe and loads the ~9 MB x2t WASM for
  // the save round-trip -- far heavier than the smoke tests sharing this
  // suite, so give them their own generous timeout.
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async ({ page }) => {
    await page.goto('/embed-demo.html');
    await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });
  });

  test('opens a multi-sheet workbook from a buffer and saves it back intact (#113, #31)', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([
          ['alpha', 1],
          ['beta', 2],
        ]),
        'First',
      );
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['gamma', 3]]), 'Second');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['delta', 4]]), 'Third');
      const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

      await post('document:open-buffer', {
        fileName: 'multi-sheet.xlsx',
        buffer: new Uint8Array(data).buffer,
        readonly: false,
      });
      const saved = await post('document:save', {});

      const parsed = XLSX.read(new Uint8Array(await saved.file.arrayBuffer()), { type: 'array' });
      const sheets: Record<string, string> = {};
      for (const name of parsed.SheetNames) {
        sheets[name] = XLSX.utils.sheet_to_csv(parsed.Sheets[name]).trim();
      }
      return { fileName: saved.file.name as string, sheets };
    });

    expect(result.fileName).toBe('multi-sheet.xlsx');
    expect(Object.keys(result.sheets)).toEqual(['First', 'Second', 'Third']);
    expect(result.sheets['First']).toBe('alpha,1\nbeta,2');
    expect(result.sheets['Second']).toBe('gamma,3');
    expect(result.sheets['Third']).toBe('delta,4');
  });

  test('exports a spreadsheet as PDF through the canvas render pipeline (#28)', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['pdf export test', 42]]), 'Sheet1');
      const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

      await post('document:open-buffer', {
        fileName: 'pdf-source.xlsx',
        buffer: new Uint8Array(data).buffer,
        readonly: false,
      });
      const saved = await post('document:save', { targetExt: 'PDF' });

      const bytes = new Uint8Array(await saved.file.arrayBuffer());
      const magic = new TextDecoder().decode(bytes.slice(0, 5));
      return { fileName: saved.file.name as string, size: bytes.byteLength, magic };
    });

    expect(result.fileName).toBe('pdf-source.pdf');
    expect(result.magic).toBe('%PDF-');
    expect(result.size).toBeGreaterThan(500);
  });

  test('opens a CSV and saves it back as CSV with the data intact (#13, #33)', async ({ page }) => {
    const original = 'name,score\nalice,90\nbob,85';
    const result = await page.evaluate(async (csvText) => {
      await post('document:open-buffer', {
        fileName: 'roundtrip.csv',
        buffer: new TextEncoder().encode(csvText).buffer,
        mimeType: 'text/csv',
        readonly: false,
      });
      const saved = await post('document:save', { targetExt: 'CSV' });
      return { fileName: saved.file.name as string, type: saved.file.type as string, text: await saved.file.text() };
    }, original);

    expect(result.fileName).toBe('roundtrip.csv');
    expect(result.type).toBe('text/csv');
    expect(result.text.trim()).toBe(original);
  });

  test('readonly open reports readonly state and refuses to save (#25, #87)', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['view only']]), 'Sheet1');
      const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

      const opened = await post('document:open-buffer', {
        fileName: 'readonly.xlsx',
        buffer: new Uint8Array(data).buffer,
        readonly: true,
      });
      const state = await post('document:get-state', {});
      let saveError = '';
      try {
        await post('document:save', {});
      } catch (error) {
        saveError = String((error as Error).message || error);
      }
      return { opened, state, saveError };
    });

    expect(result.opened.readonly).toBe(true);
    expect(result.state).toEqual({ readonly: true, hasDocument: true });
    expect(result.saveError).not.toBe('');
  });
});
