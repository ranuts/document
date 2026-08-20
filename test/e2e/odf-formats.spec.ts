import { makeStoredZip, toBase64 } from './lib/ooxml';
import { expect, test } from './lib/l0';
import { settleEditor } from './lib/visual';

declare function post(type: string, payload?: Record<string, unknown>): Promise<any>;

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

const NS = [
  'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"',
  'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"',
  'xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"',
  'xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0"',
  'office:version="1.2"',
].join(' ');

const manifest = (mime: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2"><manifest:file-entry manifest:full-path="/" manifest:media-type="${mime}"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/></manifest:manifest>`;

const DOCS = [
  {
    ext: 'odt',
    label: 'ODT (OpenDocument Text)',
    mime: 'application/vnd.oasis.opendocument.text',
    body: '<office:text><text:p>ODF round trip paragraph</text:p></office:text>',
  },
  {
    ext: 'ods',
    label: 'ODS (OpenDocument Spreadsheet)',
    mime: 'application/vnd.oasis.opendocument.spreadsheet',
    body: '<office:spreadsheet><table:table table:name="Sheet1"><table:table-row><table:table-cell office:value-type="string"><text:p>ODF round trip cell</text:p></table:table-cell></table:table-row></table:table></office:spreadsheet>',
  },
  {
    ext: 'odp',
    label: 'ODP (OpenDocument Presentation)',
    mime: 'application/vnd.oasis.opendocument.presentation',
    body: '<office:presentation><draw:page draw:name="page1"><draw:frame><draw:text-box><text:p>ODF round trip slide</text:p></draw:text-box></draw:frame></draw:page></office:presentation>',
  },
] as const;

const buildOdf = (doc: (typeof DOCS)[number]): Uint8Array =>
  makeStoredZip([
    // mimetype first, as the ODF package spec requires.
    { name: 'mimetype', data: doc.mime },
    { name: 'META-INF/manifest.xml', data: manifest(doc.mime) },
    {
      name: 'content.xml',
      data: `<?xml version="1.0" encoding="UTF-8"?><office:document-content ${NS}><office:body>${doc.body}</office:body></office:document-content>`,
    },
  ]);

test.describe('OpenDocument formats (real editor)', () => {
  test.describe.configure({ timeout: 180_000 });

  for (const doc of DOCS) {
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
