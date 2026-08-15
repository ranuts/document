import { expect, test } from './lib/l0';

declare const XLSX: any;
declare function post(type: string, payload?: Record<string, unknown>): Promise<any>;

/**
 * Content-feature dimension for spreadsheets (matrix section B): features
 * that a real workbook carries and a minimal fixture never does. Each case
 * generates the workbook in-page with SheetJS, round-trips it through the
 * real editor and asserts the feature survived (L2), plus a coarse time
 * budget for the large sheet (L4).
 */
test.describe('xlsx feature round trips (real editor)', () => {
  test.describe.configure({ timeout: 180_000 });

  test.beforeEach(async ({ page }) => {
    await page.goto('/embed-demo.html');
    await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });
  });

  test('merged cells survive a round trip', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const ws = XLSX.utils.aoa_to_sheet([
        ['Merged title', '', ''],
        ['a', 'b', 'c'],
      ]);
      ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'M');
      const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      await post('document:open-buffer', {
        fileName: 'merges.xlsx',
        buffer: new Uint8Array(data).buffer,
        readonly: false,
      });
      const saved = await post('document:save', {});
      const out = XLSX.read(new Uint8Array(await saved.file.arrayBuffer()), { type: 'array' });
      const sheet = out.Sheets[out.SheetNames[0]];
      return { merges: sheet['!merges'] || [], a1: sheet.A1?.v, c2: sheet.C2?.v };
    });
    expect(result.merges).toEqual([{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }]);
    expect(result.a1).toBe('Merged title');
    expect(result.c2).toBe('c');
  });

  test('formulas survive a round trip and keep their computed value', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const ws = XLSX.utils.aoa_to_sheet([
        ['n'],
        [1],
        [2],
        [3],
        [{ t: 'n', f: 'SUM(A2:A4)' }],
        [{ t: 's', f: 'CONCATENATE("x",A2)' }],
      ]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'F');
      const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      await post('document:open-buffer', {
        fileName: 'formulas.xlsx',
        buffer: new Uint8Array(data).buffer,
        readonly: false,
      });
      const saved = await post('document:save', {});
      const out = XLSX.read(new Uint8Array(await saved.file.arrayBuffer()), { type: 'array' });
      const sheet = out.Sheets[out.SheetNames[0]];
      return { sumF: sheet.A5?.f, sumV: sheet.A5?.v, catF: sheet.A6?.f, catV: sheet.A6?.v };
    });
    expect(result.sumF).toBe('SUM(A2:A4)');
    expect(result.sumV).toBe(6);
    expect(result.catF).toBe('CONCATENATE("x",A2)');
    expect(result.catV).toBe('x1');
  });

  test('a 20k-row sheet round-trips without loss inside the time budget', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const rows: unknown[][] = [['id', 'name', 'amount', 'flag', 'note']];
      for (let i = 1; i <= 20000; i++) rows.push([i, `row ${i}`, i * 1.5, i % 2 === 0, `n${i}`]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Big');
      const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const t0 = Date.now();
      await post('document:open-buffer', {
        fileName: 'big.xlsx',
        buffer: new Uint8Array(data).buffer,
        readonly: false,
      });
      const opened = Date.now() - t0;
      const t1 = Date.now();
      const saved = await post('document:save', {});
      const savedMs = Date.now() - t1;
      const out = XLSX.read(new Uint8Array(await saved.file.arrayBuffer()), { type: 'array' });
      const sheet = out.Sheets[out.SheetNames[0]];
      const range = XLSX.utils.decode_range(sheet['!ref']);
      return { rows: range.e.r + 1, cols: range.e.c + 1, last: sheet.B20001?.v, openMs: opened, saveMs: savedMs };
    });
    expect(result.rows).toBe(20001);
    expect(result.cols).toBe(5);
    expect(result.last).toBe('row 20000');
    // Coarse budgets (L4): the embed round trip of a 20k-row sheet must stay
    // interactive-class, not minutes. Tune with data from the corpus report.
    expect(result.openMs).toBeLessThan(60_000);
    expect(result.saveMs).toBeLessThan(60_000);
  });
});
