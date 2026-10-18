import { expect, test } from './lib/l0';
import { buildDocx, toBase64 } from './lib/ooxml';
import { waitForEditorReady } from './actions/editor';

test('a PDF export retained by native pagination resolves its embed request without a disk download', async ({
  page,
}) => {
  test.setTimeout(120_000);
  let downloads = 0;
  page.on('download', () => downloads++);
  await page.goto('/embed-demo.html');
  await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });
  await page.evaluate(
    async (buffer) => {
      await post('document:open-buffer', { fileName: 'Deferred.docx', buffer });
    },
    toBase64(buildDocx('PDF ownership survives deferred pagination')),
  );
  await waitForEditorReady(page);
  await page.evaluate(() => {
    const drawing = (window.__ooFrames.readyEditor() as any).Asc.editor.WordControl.m_oDrawingDocument;
    drawing.m_bIsDocumentCalculating = true;
    (window as any).__pendingPdf = post('document:save', { targetExt: 'pdf' });
  });
  await page.waitForFunction(() => {
    const drawing = (window.__ooFrames.readyEditor() as any).Asc.editor.WordControl.m_oDrawingDocument;
    return Array.isArray(drawing.m_arPrintingWaitEndRecalculate);
  });
  await page.evaluate(() => {
    const api = (window.__ooFrames.readyEditor() as any).Asc.editor;
    const drawing = api.WordControl.m_oDrawingDocument;
    drawing.m_bIsDocumentCalculating = false;
    // The SDK's OnEndRecalculate resumes using the exact retained invocation.
    api.downloadAs.apply(api, drawing.m_arPrintingWaitEndRecalculate);
  });
  const saved = await page.evaluate(async () => {
    const result = await (window as any).__pendingPdf;
    return { name: result.fileName, header: await result.file.slice(0, 5).text() };
  });
  expect(saved).toEqual({ name: 'Deferred.pdf', header: '%PDF-' });
  expect(downloads).toBe(0);
});
