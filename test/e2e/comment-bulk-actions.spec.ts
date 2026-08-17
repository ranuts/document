import { expect, test } from './lib/l0';
import { saveAndCapture, waitForEditorReady, SAVE_FORMAT_CODE } from './actions/editor';

declare const XLSX: any;
declare function post(type: string, payload?: Record<string, unknown>): Promise<any>;

/**
 * Review -> "Remove/Resolve comments in current selection" before the grid
 * has ever been focused. The vendor reads
 * getWorksheet()._getSelection().ranges without a null check, so it used to
 * throw an uncaught TypeError right after History.StartTransaction() --
 * leaving an unclosed transaction behind. prepareEditorIframe guard 8 turns
 * that into a no-op. Found by the UI crawl, which reached the null-selection
 * state after a long click sequence; the state is forced here so the guard
 * has a deterministic regression test.
 */
test('bulk comment actions without a cell selection are a no-op, not an uncaught error', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/embed-demo.html');
  await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });
  await page.evaluate(async () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['bulk', 1]]), 'S');
    const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    await post('document:open-buffer', { fileName: 'bulk.xlsx', buffer: new Uint8Array(data).buffer, readonly: false });
  });
  await waitForEditorReady(page);

  // Deliberately no click into the grid: this is the state the crawl hit.
  const result = await page.evaluate(async () => {
    const visit = (win: Window): any => {
      try {
        const a = (win as any).Asc?.editor;
        if (a && typeof a.asc_RemoveAllComments === 'function') return a;
      } catch {
        /* cross-origin */
      }
      for (let i = 0; i < win.frames.length; i++) {
        const f = visit(win.frames[i]);
        if (f) return f;
      }
      return null;
    };
    const api = visit(window);
    if (!api) return { error: 'no api' };
    // Force the state the crawl reached after a long click sequence: the
    // worksheet reports no selection. (Right after load there is one, so the
    // condition has to be reproduced explicitly to pin the guard.)
    const sheet = api.wb?.getWorksheet?.();
    if (!sheet) return { error: 'no worksheet' };
    const original = sheet._getSelection;
    sheet._getSelection = () => null;
    let threw = '';
    try {
      api.asc_RemoveAllComments(false, true);
      api.asc_ResolveAllComments(false, true);
    } catch (e) {
      threw = String((e as Error).message || e);
    } finally {
      sheet._getSelection = original;
    }
    return { threw };
  });

  expect(result.error).toBeUndefined();
  expect(result.threw).toBe('');
  // The document must still be editable and saveable afterwards (an unclosed
  // history transaction would surface here).
  const saved = await saveAndCapture(page, SAVE_FORMAT_CODE.xlsx, 120_000);
  expect(saved.isZip).toBe(true);
});
