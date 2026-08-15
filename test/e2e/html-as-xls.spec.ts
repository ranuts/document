import { expect, test } from './lib/l0';

declare const XLSX: any;
declare function post(type: string, payload?: Record<string, unknown>): Promise<any>;

/**
 * An HTML <table> saved under a spreadsheet extension (the usual "export to
 * Excel" of web systems) must open and round-trip. The vendor x2t.wasm has
 * its HTML importer stubbed out (missing CHtmlFile2) and aborts on such
 * bytes; the app now sniffs them and parses the table with SheetJS instead.
 * Corpus campaign defect #5.
 */
test.describe('HTML table disguised as .xls (real editor)', () => {
  test.describe.configure({ timeout: 120_000 });

  test('opens the table and saves it back as a real workbook with the cells intact', async ({ page }) => {
    await page.goto('/embed-demo.html');
    await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });

    const result = await page.evaluate(async () => {
      const html =
        '<html><head><meta charset="utf-8"></head><body>' +
        '<table border="1"><tr><td>name</td><td>score</td></tr>' +
        '<tr><td>alice</td><td>90</td></tr><tr><td>李雷</td><td>85</td></tr></table>' +
        '</body></html>';
      const opened = await post('document:open-buffer', {
        fileName: 'export.xls',
        buffer: new TextEncoder().encode(html).buffer,
        readonly: false,
      });
      const saved = await post('document:save', {});
      const wb = XLSX.read(new Uint8Array(await saved.file.arrayBuffer()), { type: 'array' });
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]).trim();
      return { opened, name: saved.file.name as string, csv };
    });

    expect(result.opened.readonly).toBe(false);
    expect(result.name).toBe('export.xlsx');
    expect(result.csv).toBe('name,score\nalice,90\n李雷,85');
  });
});
