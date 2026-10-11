import { toBase64 } from './lib/ooxml';
import { buildOdf, ODF_FIXTURES } from './lib/odf';
import { expect, test } from './lib/l0';
import { settleEditor } from './lib/visual';

/**
 * The OpenDocument formats, which the landing pages under /open/od{t,s,p} now
 * advertise and the file picker now offers.
 *
 * DOCUMENT_TYPE_MAP has mapped odt/ods/odp for as long as it has existed, but
 * nothing exercised them and the picker's `accept` list left them out, so the
 * support was real and unreachable at the same time. A page that promises a
 * format has to be backed by a test that opens one -- this is that test.
 *
 * The fixtures are hand-built minimal ODF containers (mimetype +
 * META-INF/manifest.xml + content.xml), for the same reason the OOXML fixtures
 * are built in-page: no binaries in the repository. They prove the format is
 * routed and round-trips; fidelity on real-world documents is the corpus
 * matrix's job.
 */

test.describe('OpenDocument formats (real editor)', () => {
  test.describe.configure({ timeout: 180_000 });

  for (const doc of ODF_FIXTURES) {
    test(`${doc.label}: opens, saves back as ${doc.ext.toUpperCase()}, and exports to PDF`, async ({ page }) => {
      await page.goto('/embed-demo.html');
      await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });

      const result = await page.evaluate(
        async ([b64, ext]) => {
          const bin = atob(b64 as string);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          await post('document:open-buffer', { fileName: `roundtrip.${ext}`, buffer: bytes.buffer, readonly: false });

          const magicOf = async (file: File) =>
            String.fromCharCode(...new Uint8Array(await file.arrayBuffer()).slice(0, 4));

          const native = await post('document:save', { targetExt: String(ext).toUpperCase() });
          const pdf = await post('document:save', { targetExt: 'PDF' });
          return {
            nativeName: native.file.name as string,
            nativeSize: native.file.size as number,
            nativeMagic: await magicOf(native.file),
            pdfMagic: await magicOf(pdf.file),
          };
        },
        [toBase64(buildOdf(doc)), doc.ext] as const,
      );

      await settleEditor(page, 500, 120_000).catch(() => {});

      // The document really loaded -- an open that failed would have left the
      // editor without a document and the saves would have been rejected.
      expect(result.nativeName).toBe(`roundtrip.${doc.ext}`);
      expect(result.nativeSize).toBeGreaterThan(0);
      // ODF is a zip container; PK\x03\x04 is its local file header.
      expect(result.nativeMagic).toBe('PK');
      expect(result.pdfMagic).toBe('%PDF');
    });
  }
});

/**
 * The picker's `accept` list and the engine's format map have to agree. They did
 * not: the engine read odt/ods/odp/rtf/txt while the picker greyed them out, so
 * the file a user had been sent could not be selected at all.
 */
test('the file picker offers every format the engine can open', async ({ page }) => {
  await page.goto('/editor?new=docx');
  const accept = await page.locator('input[type="file"]').first().getAttribute('accept', { timeout: 30_000 });
  const offered = new Set((accept ?? '').split(',').map((s) => s.trim().replace(/^\./, '')));
  for (const ext of ['docx', 'doc', 'odt', 'rtf', 'txt', 'xlsx', 'xls', 'ods', 'csv', 'pptx', 'ppt', 'odp', 'pdf']) {
    expect(offered.has(ext), `the picker must offer .${ext}`).toBe(true);
  }
});
