import { buildDocx, toBase64 } from './lib/ooxml';
import { expect, test } from './lib/l0';

declare function post(type: string, payload?: Record<string, unknown>): Promise<any>;

/**
 * PDF in the pdf editor (matrix section A, pdf column): open, annotate,
 * save back as PDF, and readonly. The save goes through x2t's
 * pdf + changes merge (convertFromBin with pdfChanges) -- a path no other
 * format exercises.
 */
// The PDF under test is produced by the editor itself (docx -> PDF export),
// which also keeps the export path under test; hand-built PDFs are rejected
// by the pdf engine's format sniff.
const DOCX_B64 = toBase64(buildDocx('PDF round trip 往返'));

test.describe('pdf open / annotate / save (real pdf editor)', () => {
  test.describe.configure({ timeout: 150_000 });

  test.beforeEach(async ({ page }) => {
    await page.goto('/embed-demo.html');
    await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });
  });

  test('a PDF opens, takes a free-text annotation and saves back as a valid PDF', async ({ page }) => {
    const result = await page.evaluate(async (docxB64) => {
      const bin = atob(docxB64);
      const docx = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) docx[i] = bin.charCodeAt(i);
      await post('document:open-buffer', { fileName: 'src.docx', buffer: docx.buffer, readonly: false });
      const exported = await post('document:save', { targetExt: 'PDF' });
      const pdf = new Uint8Array(await exported.file.arrayBuffer());
      await post('document:open-buffer', { fileName: 'annot.pdf', buffer: pdf.buffer, readonly: false });
      const visit = (win: Window): any => {
        try {
          const a = (win as any).Asc?.editor;
          // Do NOT poke getPDFDoc() before the load completes: it materialises
          // an empty document and the incoming binary then fails to open.
          if (a && a.isDocumentLoadComplete && a.isLoadFullApi && typeof a.AddFreeTextAnnot === 'function') return a;
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
      let api = visit(window);
      while (!api && Date.now() - start < 60_000) {
        await new Promise((r) => setTimeout(r, 300));
        api = visit(window);
      }
      if (!api) return { error: 'no pdf api' };
      let annotError = '';
      try {
        api.AddFreeTextAnnot(0);
        await new Promise((r) => setTimeout(r, 1500));
      } catch (e) {
        annotError = String((e as Error).message || e);
      }
      const saved = await post('document:save', {});
      const out = new Uint8Array(await saved.file.arrayBuffer());
      const text = new TextDecoder('latin1').decode(out);
      return {
        annotError,
        name: saved.file.name as string,
        magic: text.slice(0, 5),
        size: out.byteLength,
        exportedSize: pdf.byteLength,
        hasFreeText: /\/FreeText/.test(text),
        hasAnnots: /\/Annots/.test(text),
      };
    }, DOCX_B64);
    expect(result.error).toBeUndefined();
    expect(result.name).toBe('annot.pdf');
    expect(result.magic).toBe('%PDF-');
    expect(result.size).toBeGreaterThan(300);
    test.info().annotations.push({
      type: 'pdf-annot',
      description: `annotError=${result.annotError || 'none'} freeText=${result.hasFreeText} annots=${result.hasAnnots} ${result.exportedSize}->${result.size} bytes`,
    });
    // The annotation must have made it into the file (x2t merges pdf changes).
    expect(result.annotError).toBe('');
    expect(result.hasAnnots || result.hasFreeText).toBe(true);
  });

  test('a PDF opened readonly refuses to save', async ({ page }) => {
    const result = await page.evaluate(async (docxB64) => {
      const bin = atob(docxB64);
      const docx = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) docx[i] = bin.charCodeAt(i);
      await post('document:open-buffer', { fileName: 'src.docx', buffer: docx.buffer, readonly: false });
      const exported = await post('document:save', { targetExt: 'PDF' });
      const pdf = new Uint8Array(await exported.file.arrayBuffer());
      const opened = await post('document:open-buffer', { fileName: 'ro.pdf', buffer: pdf.buffer, readonly: true });
      let saveError = '';
      try {
        await post('document:save', {});
      } catch (e) {
        saveError = String((e as Error).message || e);
      }
      return { opened, saveError };
    }, DOCX_B64);
    expect(result.opened.readonly).toBe(true);
    expect(result.saveError).not.toBe('');
  });
});
