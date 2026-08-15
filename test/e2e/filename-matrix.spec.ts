import { buildDocx, toBase64 } from './lib/ooxml';
import { expect, test } from './lib/l0';

declare const XLSX: any;
declare function post(type: string, payload?: Record<string, unknown>): Promise<any>;

/**
 * Filename dimension of the behavior matrix (strategy section 1): the name a
 * document is opened under must never influence whether it opens, and must
 * come back unchanged on save. Campaign day 1 wrongly pinned a harness bug
 * on non-ASCII names; this parametrized class test keeps the dimension
 * covered for real so the theory can never quietly become true.
 */
const NAMES = [
  ['ascii', 'plain-name'],
  ['cjk', '公司工作作息时间'],
  ['space-parens', 'report (final) v2'],
  ['fullwidth-punct', '附件1 ：《终试安排》'],
  ['emoji', 'budget😀2026'],
  ['unsafe-chars', "a&b%c'd!e"],
  ['long', 'x'.repeat(180)],
] as const;

test.describe('filename matrix (real editor)', () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async ({ page }) => {
    await page.goto('/embed-demo.html');
    await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });
  });

  for (const [label, stem] of NAMES) {
    test(`xlsx named ${label} opens and round-trips under the same name`, async ({ page }) => {
      const result = await page.evaluate(async (fileName) => {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.aoa_to_sheet([
            ['k', 'v'],
            ['name', fileName],
          ]),
          'S',
        );
        const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        await post('document:open-buffer', { fileName, buffer: new Uint8Array(data).buffer, readonly: false });
        const saved = await post('document:save', {});
        const out = XLSX.read(new Uint8Array(await saved.file.arrayBuffer()), { type: 'array' });
        return { name: saved.file.name as string, csv: XLSX.utils.sheet_to_csv(out.Sheets[out.SheetNames[0]]).trim() };
      }, `${stem}.xlsx`);
      expect(result.name).toBe(`${stem}.xlsx`);
      expect(result.csv).toBe(`k,v\nname,${stem}.xlsx`);
    });
  }

  for (const [label, stem] of NAMES.filter(([l]) => l === 'cjk' || l === 'space-parens')) {
    test(`docx named ${label} opens and round-trips under the same name`, async ({ page }) => {
      const result = await page.evaluate(
        async ({ fileName, docxB64 }) => {
          const bin = atob(docxB64);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          await post('document:open-buffer', { fileName, buffer: bytes.buffer, readonly: false });
          const saved = await post('document:save', {});
          const out = new Uint8Array(await saved.file.arrayBuffer());
          return { name: saved.file.name as string, magic: Array.from(out.slice(0, 2)) };
        },
        { fileName: `${stem}.docx`, docxB64: toBase64(buildDocx('filename matrix')) },
      );
      expect(result.name).toBe(`${stem}.docx`);
      expect(result.magic).toEqual([0x50, 0x4b]);
    });
  }
});
