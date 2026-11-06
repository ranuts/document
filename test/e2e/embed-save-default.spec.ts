import { buildDocx, buildPptx, toBase64 } from './lib/ooxml';
import { expect, test } from './lib/l0';

/**
 * document:save without targetExt must export in the document's own format.
 * It used to default to XLSX for every document, so a bare save on a docx
 * or pptx asked x2t for a spreadsheet, failed with code 88 inside the editor
 * frame and surfaced only as a 45-60 s save timeout (found while running
 * the corpus matrix against a real deck).
 */
const MIN_PDF =
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
  '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\nxref\n0 4\n0000000000 65535 f \n' +
  '0000000009 00000 n \n0000000052 00000 n \n0000000101 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF\n';

test.describe('embed save default format (real editor)', () => {
  test.describe.configure({ timeout: 120_000 });

  for (const doc of [
    {
      label: 'docx',
      name: 'default-target.docx',
      b64: () => toBase64(buildDocx('default target')),
      magic: [0x50, 0x4b] as number[],
    },
    {
      label: 'pptx',
      name: 'default-target.pptx',
      b64: () => toBase64(buildPptx('default target')),
      magic: [0x50, 0x4b] as number[],
    },
  ] as const) {
    test(`a bare document:save on a ${doc.label} returns a ${doc.label}`, async ({ page }) => {
      await page.goto('/embed-demo.html');
      await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });

      const result = await page.evaluate(
        async ({ name, b64 }) => {
          const bin = atob(b64);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          await post('document:open-buffer', { fileName: name, buffer: bytes.buffer, readonly: false });
          const saved = await post('document:save', {});
          const out = new Uint8Array(await saved.file.arrayBuffer());
          return { name: saved.file.name as string, magic: Array.from(out.slice(0, 2)), size: out.byteLength };
        },
        { name: doc.name, b64: doc.b64() },
      );

      expect(result.name).toBe(doc.name);
      expect(result.magic).toEqual([...doc.magic]);
      expect(result.size).toBeGreaterThan(500);
    });
  }

  test('a bare document:save on a pdf returns a pdf', async ({ page }) => {
    await page.goto('/embed-demo.html');
    await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });

    const result = await page.evaluate(async (pdfText) => {
      const bytes = new TextEncoder().encode(pdfText);
      await post('document:open-buffer', {
        fileName: 'default-target.pdf',
        buffer: bytes.buffer,
        readonly: false,
      });
      const saved = await post('document:save', {});
      const out = new Uint8Array(await saved.file.arrayBuffer());
      return {
        name: saved.file.name as string,
        magic: new TextDecoder('ascii').decode(out.slice(0, 5)),
        size: out.byteLength,
      };
    }, MIN_PDF);

    expect(result.name).toBe('default-target.pdf');
    expect(result.magic).toBe('%PDF-');
    expect(result.size).toBeGreaterThan(50);
  });
});
