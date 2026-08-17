import { buildDocx, ooxmlText, toBase64, zipEntryNames, zipEntryText } from './lib/ooxml';
import { expect, test } from './lib/l0';

declare function post(type: string, payload?: Record<string, unknown>): Promise<any>;

/**
 * Word features a real document carries and the minimal fixture never did
 * (matrix section B "修订 / 页眉页脚"): tracked changes and header/footer
 * parts must survive open + save.
 */
test.describe('docx feature round trips (real editor)', () => {
  test.describe.configure({ timeout: 120_000 });

  const roundTrip = (page: import('@playwright/test').Page, name: string, b64: string) =>
    page.evaluate(
      async ({ name, b64 }) => {
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        await post('document:open-buffer', { fileName: name, buffer: bytes.buffer, readonly: false });
        const saved = await post('document:save', {});
        const out = new Uint8Array(await saved.file.arrayBuffer());
        let s = '';
        for (let i = 0; i < out.length; i += 0x8000)
          s += String.fromCharCode.apply(null, Array.from(out.subarray(i, i + 0x8000)));
        return btoa(s);
      },
      { name, b64 },
    );

  test.beforeEach(async ({ page }) => {
    await page.goto('/embed-demo.html');
    await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });
  });

  test('tracked changes (insertion + deletion) survive a save', async ({ page }) => {
    const body =
      '<w:p><w:r><w:t xml:space="preserve">Kept text </w:t></w:r>' +
      '<w:ins w:id="1" w:author="Reviewer" w:date="2026-08-16T00:00:00Z"><w:r><w:t>inserted 插入</w:t></w:r></w:ins>' +
      '<w:del w:id="2" w:author="Reviewer" w:date="2026-08-16T00:00:00Z"><w:r><w:delText>deleted 删除</w:delText></w:r></w:del>' +
      '</w:p>';
    const out = new Uint8Array(
      Buffer.from(await roundTrip(page, 'revisions.docx', toBase64(buildDocx('', body))), 'base64'),
    );
    const xml = (await zipEntryText(out, 'word/document.xml')) || '';
    expect(xml).toMatch(/<w:ins\b[^>]*w:author="Reviewer"/);
    expect(xml).toMatch(/<w:del\b[^>]*w:author="Reviewer"/);
    expect(xml).toContain('<w:delText');
    expect(ooxmlText(xml)).toContain('inserted 插入');
    expect(xml).toContain('deleted 删除');
  });

  test('header and footer parts survive a save', async ({ page }) => {
    const out = new Uint8Array(
      Buffer.from(
        await roundTrip(
          page,
          'hf.docx',
          toBase64(buildDocx('body text', undefined, { headerText: 'Header 页眉', footerText: 'Footer 页脚' })),
        ),
        'base64',
      ),
    );
    const names = zipEntryNames(out);
    const header = names.find((n) => /^word\/header\d+\.xml$/.test(n));
    const footer = names.find((n) => /^word\/footer\d+\.xml$/.test(n));
    expect(header, `no header part in ${names.join(',')}`).toBeTruthy();
    expect(footer, `no footer part in ${names.join(',')}`).toBeTruthy();
    expect(ooxmlText((await zipEntryText(out, header!)) || '')).toContain('Header 页眉');
    expect(ooxmlText((await zipEntryText(out, footer!)) || '')).toContain('Footer 页脚');
    expect(ooxmlText((await zipEntryText(out, 'word/document.xml')) || '')).toContain('body text');
  });
});
