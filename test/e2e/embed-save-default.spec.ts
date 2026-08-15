import { buildDocx, toBase64 } from './lib/ooxml';
import { expect, test } from './lib/l0';

declare function post(type: string, payload?: Record<string, unknown>): Promise<any>;

/**
 * document:save without targetExt must export in the document's own format.
 * It used to default to XLSX for every document, so a bare save on a docx
 * or pptx asked x2t for a spreadsheet, failed with code 88 inside the editor
 * frame and surfaced only as a 45-60 s save timeout (found while running
 * the corpus matrix against a real deck).
 */
test.describe('embed save default format (real editor)', () => {
  test.describe.configure({ timeout: 120_000 });

  test('a bare document:save on a docx returns a docx', async ({ page }) => {
    await page.goto('/embed-demo.html');
    await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });

    const result = await page.evaluate(
      async (docxB64) => {
        const bin = atob(docxB64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        await post('document:open-buffer', { fileName: 'default-target.docx', buffer: bytes.buffer, readonly: false });
        const saved = await post('document:save', {});
        const out = new Uint8Array(await saved.file.arrayBuffer());
        return { name: saved.file.name as string, magic: Array.from(out.slice(0, 2)), size: out.byteLength };
      },
      toBase64(buildDocx('default target')),
    );

    expect(result.name).toBe('default-target.docx');
    expect(result.magic).toEqual([0x50, 0x4b]);
    expect(result.size).toBeGreaterThan(500);
  });
});
