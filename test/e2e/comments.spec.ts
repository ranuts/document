import { buildDocx, buildPptx, toBase64, zipEntryNames, zipEntryText } from './lib/ooxml';
import { expect, test } from './lib/l0';

declare const XLSX: any;
/**
 * Comments (matrix section A "评论"): add one through the SDK API on a
 * selection, save, and find it in the package (word/comments.xml,
 * xl/comments1.xml). The word editor's comment lifecycle callbacks are part
 * of the embed contract (CHANGELOG), so a silent drop on save would be a
 * user-visible loss.
 */
test.describe('comments survive a save (real editor)', () => {
  test.describe.configure({ timeout: 150_000 });

  test.beforeEach(async ({ page }) => {
    await page.goto('/embed-demo.html');
    await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });
    await page.evaluate(() => {
      (window as any).__addCommentAndSave = async (text: string, kind: string) => {
        const visit = (): any => {
          const win = window.__ooFrames.readyEditor() as any;
          return win ? { api: win.Asc.editor, Asc: win.Asc } : null;
        };
        const start = Date.now();
        let found = visit();
        while (!found && Date.now() - start < 60_000) {
          await new Promise((r) => setTimeout(r, 300));
          found = visit();
        }
        if (!found) return { error: 'no api' };
        const { api, Asc } = found;
        if (kind === 'docx') {
          // Word: the plugin-facing entry point wraps the comment data type
          // for the word editor (asc_CCommentDataWord) and anchors at the
          // current selection; select the first paragraph's text first.
          api.SelectAll?.();
          api.pluginMethod_AddComment({ Text: text, UserName: 'E2E', Time: String(Date.now()), Solved: false });
        } else if (kind === 'pptx') {
          // Slide: the comment is anchored to whatever is selected, so give it
          // a slide to land on first.
          const data = new Asc.asc_CCommentData();
          data.asc_putText(text);
          data.asc_putUserName('E2E');
          data.asc_putTime(String(Date.now()));
          api.asc_addComment(data);
        } else {
          // Cell: a comment is a *cell* comment only when bDocument is false;
          // otherwise it lands in the workbook-level store (workbookComments.bin,
          // an OnlyOffice-only part that Excel ignores).
          const data = new Asc.asc_CCommentData();
          data.asc_putText(text);
          data.asc_putUserName('E2E');
          data.asc_putTime(String(Date.now()));
          data.asc_putDocumentFlag?.(false);
          data.bDocument = false;
          api.asc_addComment(data);
        }
        await new Promise((r) => setTimeout(r, 1500));
        const saved = await post('document:save', {});
        const out = new Uint8Array(await saved.file.arrayBuffer());
        let s = '';
        for (let i = 0; i < out.length; i += 0x8000)
          s += String.fromCharCode.apply(null, Array.from(out.subarray(i, i + 0x8000)));
        return { name: saved.file.name, b64: btoa(s) };
      };
    });
  });

  test('docx: a comment added via the API is written to word/comments.xml', async ({ page }) => {
    const result = await page.evaluate(
      async (docxB64) => {
        const bin = atob(docxB64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        await post('document:open-buffer', { fileName: 'comment.docx', buffer: bytes.buffer, readonly: false });
        return (window as any).__addCommentAndSave('review note 审阅意见', 'docx');
      },
      toBase64(buildDocx('commented paragraph')),
    );
    expect(result.error).toBeUndefined();
    const bytes = new Uint8Array(Buffer.from(result.b64, 'base64'));
    expect(zipEntryNames(bytes)).toContain('word/comments.xml');
    expect((await zipEntryText(bytes, 'word/comments.xml')) || '').toContain('review note');
    expect((await zipEntryText(bytes, 'word/comments.xml')) || '').toContain('审阅意见');
  });

  test('xlsx: a cell comment added via the API is written to xl/comments1.xml', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['cell', 1]]), 'S');
      const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      await post('document:open-buffer', {
        fileName: 'comment.xlsx',
        buffer: new Uint8Array(data).buffer,
        readonly: false,
      });
      return (window as any).__addCommentAndSave('cell note 单元格批注', 'xlsx');
    });
    expect(result.error).toBeUndefined();
    const bytes = new Uint8Array(Buffer.from(result.b64, 'base64'));
    const names = zipEntryNames(bytes);
    const part = names.find((n) => /^xl\/comments\d*\.xml$/.test(n));
    expect(part, `comments part missing in ${names.join(',')}`).toBeTruthy();
    expect((await zipEntryText(bytes, part!)) || '').toContain('cell note');
  });

  test('pptx: a comment added via the API is written to the deck', async ({ page }) => {
    const result = await page.evaluate(
      async (pptxB64) => {
        const bin = atob(pptxB64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        await post('document:open-buffer', { fileName: 'comment.pptx', buffer: bytes.buffer, readonly: false });
        return (window as any).__addCommentAndSave('slide note 幻灯片批注', 'pptx');
      },
      toBase64(buildPptx('Commented Slide')),
    );
    expect(result.error).toBeUndefined();
    const bytes = new Uint8Array(Buffer.from(result.b64, 'base64'));
    const names = zipEntryNames(bytes);
    // The deck writes either the classic comments part or the modern one,
    // depending on the vendor build; both are the same user-visible thing.
    const part = names.find((n) => /^ppt\/(comments|modernComments)\/.*\.xml$/.test(n));
    expect(part, `comments part missing in ${names.join(',')}`).toBeTruthy();
    const xml = (await zipEntryText(bytes, part!)) || '';
    expect(xml).toContain('slide note');
  });
});
