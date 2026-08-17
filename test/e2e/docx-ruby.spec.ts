import { buildDocx, ooxmlText, toBase64, zipEntryText } from './lib/ooxml';
import { expect, test } from './lib/l0';

declare function post(type: string, payload?: Record<string, unknown>): Promise<any>;

/**
 * Phonetic guides (<w:ruby>: furigana / pinyin). The vendor importer drops
 * the whole element -- guide AND base word -- so "東京" with とうきょう above
 * it vanished from the document on save (POI test-data 61470.docx, nightly
 * corpus L2). The app now unwraps ruby to its base run before opening; the
 * base word must survive a save (the guide itself is a known limitation).
 */
test('the base word of a ruby annotation survives open + save', async ({ page }) => {
  test.setTimeout(120_000);
  const body =
    '<w:p><w:r><w:t>Go to </w:t></w:r><w:r><w:rPr><w:sz w:val="22"/></w:rPr>' +
    '<w:ruby><w:rubyPr><w:lid w:val="ja-JP"/></w:rubyPr>' +
    '<w:rt><w:r><w:rPr><w:sz w:val="11"/></w:rPr><w:t>とうきょう</w:t></w:r></w:rt>' +
    '<w:rubyBase><w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t>東京</w:t></w:r></w:rubyBase>' +
    '</w:ruby></w:r><w:r><w:t> tomorrow</w:t></w:r></w:p>';

  await page.goto('/embed-demo.html');
  await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });
  const b64 = await page.evaluate(
    async (docxB64) => {
      const bin = atob(docxB64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      await post('document:open-buffer', { fileName: 'ruby.docx', buffer: bytes.buffer, readonly: false });
      const saved = await post('document:save', {});
      const out = new Uint8Array(await saved.file.arrayBuffer());
      let s = '';
      for (let i = 0; i < out.length; i += 0x8000)
        s += String.fromCharCode.apply(null, Array.from(out.subarray(i, i + 0x8000)));
      return btoa(s);
    },
    toBase64(buildDocx('', body)),
  );

  const text = ooxmlText((await zipEntryText(new Uint8Array(Buffer.from(b64, 'base64')), 'word/document.xml')) || '');
  expect(text).toContain('東京');
  expect(text).toContain('Go to');
  expect(text).toContain('tomorrow');
});
