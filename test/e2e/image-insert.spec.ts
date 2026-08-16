import { buildPptx, toBase64, zipEntryNames } from './lib/ooxml';
import { expect, test } from './lib/l0';

declare const XLSX: any;
declare function post(type: string, payload?: Record<string, unknown>): Promise<any>;

/**
 * Image insertion + save for the spreadsheet and presentation editors
 * (matrix section A "插图后保存"; the word editor case lives in
 * embed-regression). The serverless image pipeline (prepareEditorIframe
 * guard 4) must register the image and the saved package must carry the
 * media bytes -- the historical failure was a permanent main-thread hang.
 */
test.describe('image insert + save: xlsx / pptx (real editor)', () => {
  test.describe.configure({ timeout: 150_000 });

  test.beforeEach(async ({ page }) => {
    await page.goto('/embed-demo.html');
    await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });
  });

  // Installed into the page once per test: insert /img/64.png through the
  // editor API and save; returns the saved bytes as base64.
  const installHelper = (page: import('@playwright/test').Page) =>
    page.evaluate(() => {
      (window as any).__insertAndSave = async (kind: string) => {
        const findApi = (): any => {
          const visit = (win: Window): any => {
            try {
              const a = (win as any).Asc?.editor;
              if (a && a.isDocumentLoadComplete && a.isLoadFullApi) return a;
            } catch {
              /* cross-origin */
            }
            for (let i = 0; i < win.frames.length; i++) {
              const f = visit(win.frames[i]);
              if (f) return f;
            }
            return null;
          };
          return visit(window);
        };
        const start = Date.now();
        let api = findApi();
        while (!api && Date.now() - start < 60_000) {
          await new Promise((r) => setTimeout(r, 300));
          api = findApi();
        }
        if (!api) return { error: 'no api' };
        const url = location.origin + '/img/64.png';
        if (kind === 'pptx') api.AddImageUrlAction(url);
        else api.asc_addImageDrawingObject([url]);
        await new Promise((r) => setTimeout(r, 6000));
        const saved = await post('document:save', {});
        const out = new Uint8Array(await saved.file.arrayBuffer());
        let s = '';
        for (let i = 0; i < out.length; i += 0x8000)
          s += String.fromCharCode.apply(null, Array.from(out.subarray(i, i + 0x8000)));
        return { name: saved.file.name, b64: btoa(s) };
      };
    });

  test.beforeEach(async ({ page }) => {
    await installHelper(page);
  });

  test('xlsx: an image inserted by URL is in the saved workbook', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['img', 1]]), 'S');
      const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      await post('document:open-buffer', {
        fileName: 'img.xlsx',
        buffer: new Uint8Array(data).buffer,
        readonly: false,
      });
      return (window as any).__insertAndSave('xlsx');
    });
    expect(result.error).toBeUndefined();
    const names = zipEntryNames(new Uint8Array(Buffer.from(result.b64, 'base64')));
    expect(names.some((n) => n.startsWith('xl/media/'))).toBe(true);
    expect(names.some((n) => /^xl\/drawings\/drawing\d+\.xml$/.test(n))).toBe(true);
  });

  test('pptx: an image inserted by URL is in the saved deck', async ({ page }) => {
    const result = await page.evaluate(
      async ({ pptxB64 }) => {
        const bin = atob(pptxB64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        await post('document:open-buffer', { fileName: 'img.pptx', buffer: bytes.buffer, readonly: false });
        return (window as any).__insertAndSave('pptx');
      },
      { pptxB64: toBase64(buildPptx('image slide')) },
    );
    expect(result.error).toBeUndefined();
    const names = zipEntryNames(new Uint8Array(Buffer.from(result.b64, 'base64')));
    expect(names.some((n) => n.startsWith('ppt/media/'))).toBe(true);
  });
});
