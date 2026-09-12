import { buildDocx, toBase64 } from './lib/ooxml';
import { expect, test } from './lib/l0';

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
      // Do NOT poke getPDFDoc() before the load completes: it materialises an
      // empty document and the incoming binary then fails to open.
      const visit = (): any => {
        const win = window.__ooFrames.readyEditor() as any;
        return typeof win?.Asc.editor.AddFreeTextAnnot === 'function' ? win.Asc.editor : null;
      };
      const start = Date.now();
      let api = visit();
      while (!api && Date.now() - start < 60_000) {
        await new Promise((r) => setTimeout(r, 300));
        api = visit();
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

  /**
   * The same merge, applied to its own output.
   *
   * Saving an annotated PDF is not a re-export: x2t takes the PDF it was
   * opened with and merges a changes stream into it. A second trip feeds that
   * merged file back through the same path, which is where a stale object
   * table or a dropped annotation would show up -- and it is the trip a user
   * makes without thinking about it, by annotating, saving, and opening the
   * result again later.
   *
   * The second pass deliberately adds nothing. Anything still in the file
   * afterwards got there on the first pass and survived, which is the claim;
   * annotating again would have produced the same counts either way.
   */
  test('an annotation survives a second open and save, which adds nothing', async ({ page }) => {
    const result = await page.evaluate(async (docxB64) => {
      const bin = atob(docxB64);
      const docx = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) docx[i] = bin.charCodeAt(i);
      await post('document:open-buffer', { fileName: 'src.docx', buffer: docx.buffer, readonly: false });
      const exported = await post('document:save', { targetExt: 'PDF' });

      const open = async (name: string, bytes: Uint8Array): Promise<any> => {
        await post('document:open-buffer', { fileName: name, buffer: bytes.buffer, readonly: false });
        // Never poke getPDFDoc() before the load completes -- it materialises
        // an empty document and the incoming binary then fails to open.
        const visit = (): any => {
          const win = window.__ooFrames.readyEditor() as any;
          return typeof win?.Asc.editor.AddFreeTextAnnot === 'function' ? win.Asc.editor : null;
        };
        const start = Date.now();
        let api = visit();
        while (!api && Date.now() - start < 60_000) {
          await new Promise((r) => setTimeout(r, 300));
          api = visit();
        }
        if (!api) throw new Error('no pdf api');
        return api;
      };
      const save = async () => {
        const saved = await post('document:save', {});
        return { name: saved.file.name as string, bytes: new Uint8Array(await saved.file.arrayBuffer()) };
      };
      const count = (bytes: Uint8Array) => {
        const text = new TextDecoder('latin1').decode(bytes);
        return {
          magic: text.slice(0, 5),
          annots: (text.match(/\/Annots/g) || []).length,
          freeText: (text.match(/\/FreeText/g) || []).length,
          eof: (text.match(/%%EOF/g) || []).length,
        };
      };

      const api = await open('twice.pdf', new Uint8Array(await exported.file.arrayBuffer()));
      api.AddFreeTextAnnot(0);
      await new Promise((r) => setTimeout(r, 1500));
      const first = await save();

      // Second trip: open what came out and save it again, untouched.
      await open(first.name, first.bytes);
      const second = await save();

      return {
        name: second.name,
        first: { ...count(first.bytes), size: first.bytes.byteLength },
        second: { ...count(second.bytes), size: second.bytes.byteLength },
      };
    }, DOCX_B64);

    test.info().annotations.push({
      type: 'pdf-twice',
      description: `first ${result.first.size}B annots=${result.first.annots} freeText=${result.first.freeText} | second ${result.second.size}B annots=${result.second.annots} freeText=${result.second.freeText}`,
    });

    expect(result.name).toBe('twice.pdf');
    expect(result.second.magic).toBe('%PDF-');
    expect(result.second.eof).toBeGreaterThan(0);
    // The first pass really did annotate ...
    expect(result.first.annots + result.first.freeText).toBeGreaterThan(0);
    // ... and the second trip neither dropped it nor duplicated it.
    expect(result.second.annots).toBe(result.first.annots);
    expect(result.second.freeText).toBe(result.first.freeText);
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
