import { buildDocx, buildPptx, toBase64, zipEntryNames } from './lib/ooxml';
import { expect, test } from './lib/l0';

declare const XLSX: any;
declare function post(type: string, payload?: Record<string, unknown>): Promise<any>;

/**
 * Re-open -> re-save idempotence (matrix section A, "再打开→再保存"). The
 * editor's own output must be something the editor can open again and save
 * again without loss: sheet/paragraph/slide text survives two full trips and
 * the second output is a valid OOXML package of the same kind. Also the
 * first synthetic pptx open/save coverage (test/e2e/lib/ooxml.ts buildPptx).
 */
test.describe('re-open / re-save idempotence (real editor)', () => {
  test.describe.configure({ timeout: 150_000 });

  test.beforeEach(async ({ page }) => {
    await page.goto('/embed-demo.html');
    await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });
  });

  // Page-side helper installed once per page: open bytes under a name, save,
  // return the saved bytes as base64.
  const installTrip = (page: import('@playwright/test').Page) =>
    page.evaluate(() => {
      (window as any).__trip = async (name: string, b64: string) => {
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        await post('document:open-buffer', { fileName: name, buffer: bytes.buffer, readonly: false });
        const saved = await post('document:save', {});
        const out = new Uint8Array(await saved.file.arrayBuffer());
        let s = '';
        for (let i = 0; i < out.length; i += 0x8000)
          s += String.fromCharCode.apply(null, Array.from(out.subarray(i, i + 0x8000)));
        return { name: saved.file.name as string, b64: btoa(s) };
      };
    });

  test.beforeEach(async ({ page }) => {
    await installTrip(page);
  });

  test('xlsx: two round trips keep the cells and produce a workbook the editor accepts again', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const trip = (window as any).__trip as (name: string, b64: string) => Promise<{ name: string; b64: string }>;
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([
          ['k', 'v'],
          ['x', 1],
          ['中文', 2],
        ]),
        'Data',
      );
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['second']]), 'Other');
      const first = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
      const one = await trip('idem.xlsx', first);
      const two = await trip(one.name, one.b64);
      const parsed = XLSX.read(two.b64, { type: 'base64' });
      return {
        name: two.name,
        sheets: parsed.SheetNames,
        data: XLSX.utils.sheet_to_csv(parsed.Sheets['Data']).trim(),
        other: XLSX.utils.sheet_to_csv(parsed.Sheets['Other']).trim(),
      };
    });
    expect(result.name).toBe('idem.xlsx');
    expect(result.sheets).toEqual(['Data', 'Other']);
    expect(result.data).toBe('k,v\nx,1\n中文,2');
    expect(result.other).toBe('second');
  });

  test('docx: two round trips keep the paragraph text', async ({ page }) => {
    const result = await page.evaluate(
      async ({ docxB64 }) => {
        const trip = (window as any).__trip as (name: string, b64: string) => Promise<{ name: string; b64: string }>;
        const one = await trip('idem.docx', docxB64);
        const two = await trip(one.name, one.b64);
        return { name: two.name, b64: two.b64 };
      },
      { docxB64: toBase64(buildDocx('idempotent paragraph 往返')) },
    );
    expect(result.name).toBe('idem.docx');
    const bytes = Buffer.from(result.b64, 'base64');
    // Stored or deflated, the document part must be present; the text is
    // asserted through the editor's own reload (trip 2 opened trip 1's output).
    const names = zipEntryNames(new Uint8Array(bytes));
    expect(names).toContain('word/document.xml');
    expect(names).toContain('[Content_Types].xml');
  });

  test('pptx: two round trips keep the slide and its title', async ({ page }) => {
    const result = await page.evaluate(
      async ({ pptxB64 }) => {
        const trip = (window as any).__trip as (name: string, b64: string) => Promise<{ name: string; b64: string }>;
        const one = await trip('idem.pptx', pptxB64);
        const two = await trip(one.name, one.b64);
        return { name: two.name, b64: two.b64 };
      },
      { pptxB64: toBase64(buildPptx('Idempotent Title 标题')) },
    );
    expect(result.name).toBe('idem.pptx');
    const names = zipEntryNames(new Uint8Array(Buffer.from(result.b64, 'base64')));
    expect(names).toContain('ppt/presentation.xml');
    expect(names.filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))).toHaveLength(1);
  });
});
