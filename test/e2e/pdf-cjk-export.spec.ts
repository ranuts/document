import { buildDocx, toBase64 } from './lib/ooxml';
import { expect, test } from './lib/l0';
import { pixelDiff, settleEditor } from './lib/visual';

declare function post(type: string, payload?: Record<string, unknown>): Promise<any>;

/**
 * Chinese has to survive an export to PDF.
 *
 * Nothing checked this before, and the check is not academic: the CJK faces
 * this catalog now falls back to were first shipped as the pan-CJK OTFs (Noto
 * Sans CJK SC and friends). They render correctly in the editor and export to
 * PDF as *nothing* -- x2t embeds no glyphs for a CFF-flavoured face, so the
 * Chinese comes out blank while the Latin in the same line survives. The fix
 * was to ship TrueType-outline subsets instead, and this is what holds that
 * decision in place.
 *
 * The document is Chinese-only on purpose: a mixed line still has ink in it
 * when the Chinese disappears, and an ink threshold would not notice.
 */
const CJK_TEXT = '中文导出测试 你好，世界。繁體漢字';
/**
 * The first text line of the page *inside* the editor frame -- the demo page's
 * own sidebar is dark enough to dominate an ink measurement taken any wider.
 */
const TEXT_LINE = { x: 430, y: 260, width: 780, height: 180 };

test.describe('pdf export', () => {
  test.describe.configure({ timeout: 240_000 });

  test('keeps Chinese text visible', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/embed-demo.html');
    await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });

    // Open the Chinese document, shoot it, then export it to PDF.
    const pdfB64 = await page.evaluate(
      async (b64) => {
        const decode = (s: string) => {
          const bin = atob(s);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          return bytes;
        };
        const bytes = decode(b64);
        // Not readonly: the export goes through the same save path a user does.
        await post('document:open-buffer', { fileName: 'cjk.docx', buffer: bytes.buffer, readonly: false });
        return null;
      },
      toBase64(buildDocx(CJK_TEXT)),
    );
    void pdfB64;
    await settleEditor(page);
    const docxShot = await page.screenshot({ clip: TEXT_LINE });

    const pdf = await page.evaluate(async () => {
      const saved = await post('document:save', { targetExt: 'pdf' });
      const out = new Uint8Array(await saved.file.arrayBuffer());
      let s = '';
      for (let i = 0; i < out.length; i += 0x8000) {
        s += String.fromCharCode.apply(null, Array.from(out.subarray(i, i + 0x8000)));
      }
      return btoa(s);
    });

    await page.evaluate(async (b64) => {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      await post('document:open-buffer', { fileName: 'cjk.pdf', buffer: bytes.buffer, readonly: true });
    }, pdf);
    await settleEditor(page);
    const pdfShot = await page.screenshot({ clip: TEXT_LINE });

    const original = await pixelDiff(page, docxShot, docxShot);
    const exported = await pixelDiff(page, pdfShot, pdfShot);
    console.log(`PDF CJK: docx ink=${original.nonWhitePct.toFixed(2)}% pdf ink=${exported.nonWhitePct.toFixed(2)}%`);

    // Ink, not a comparison between the two: the PDF viewer places the page
    // differently from the document editor, so the same crop does not hold the
    // same thing in both. The document is Chinese-only, so "did the characters
    // survive" is just whether the exported page carries ink at all -- with a
    // CFF face it measures 0.05%, with a working one around 1%.
    expect(original.nonWhitePct, 'the source document rendered nothing').toBeGreaterThan(0.3);
    expect(exported.nonWhitePct, 'the exported PDF page is blank').toBeGreaterThan(0.3);
  });
});
