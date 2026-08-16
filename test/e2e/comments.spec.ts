import { buildDocx, toBase64, zipEntryNames, zipEntryText } from './lib/ooxml';
import { expect, test } from './lib/l0';

declare const XLSX: any;
declare function post(type: string, payload?: Record<string, unknown>): Promise<any>;

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
        const visit = (win: Window): any => {
          try {
            const a = (win as any).Asc?.editor;
            if (a && a.isDocumentLoadComplete && a.isLoadFullApi) return { api: a, Asc: (win as any).Asc };
          } catch {
            /* cross-origin */
          }
          for (let i = 0; i < win.frames.length; i++) {
            const f = visit(win.frames[i]);
            if (f) return f;
          }
          return null;
        };
        const start = Date.now();
        let found = visit(window);
        while (!found && Date.now() - start < 60_000) {
          await new Promise((r) => setTimeout(r, 300));
          found = visit(window);
        }
        if (!found) return { error: 'no api' };
        const { api, Asc } = found;
        if (kind === 'docx') {
          // Word: the plugin-facing entry point wraps the comment data type
          // for the word editor (asc_CCommentDataWord) and anchors at the
          // current selection; select the first paragraph's text first.
          api.SelectAll?.();
          api.pluginMethod_AddComment({ Text: text, UserName: 'E2E', Time: String(Date.now()), Solved: false });
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
    expect(zipEntryText(bytes, 'word/comments.xml') || '').toContain('review note');
    expect(zipEntryText(bytes, 'word/comments.xml') || '').toContain('审阅意见');
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
    expect(zipEntryText(bytes, part!) || '').toContain('cell note');
  });
});
