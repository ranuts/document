import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { readHistoryDocs } from './lib/history-db';
import { buildDocx, ooxmlText, zipEntryText } from './lib/ooxml';
import { expect, test } from './lib/l0';

declare const XLSX: any;
declare function post(type: string, payload?: Record<string, unknown>): Promise<any>;

/**
 * The whole loss-protection path with the real editor and real x2t behind it:
 * edit a document, let the tab go away, and get the work back on the next
 * visit -- through the recovery bar, with the bytes intact.
 *
 * The snapshot is triggered by hiding the page rather than by waiting out the
 * interval. That is not a shortcut around the schedule: visibilitychange is
 * the branch that matters most in production (it is the last moment that
 * reliably gets time to run before a tab goes away), and waiting out the
 * periodic interval in CI to exercise the same export would only buy a slower
 * suite.
 */
const waitForEditorReady = (page: Page) =>
  page.waitForFunction(
    () => {
      const visit = (win: Window): boolean => {
        try {
          const api = (
            win as unknown as { Asc?: { editor?: { isDocumentLoadComplete?: boolean; isLoadFullApi?: boolean } } }
          ).Asc?.editor;
          if (api && api.isDocumentLoadComplete && api.isLoadFullApi) return true;
        } catch {
          /* cross-origin */
        }
        for (let i = 0; i < win.frames.length; i++) if (visit(win.frames[i])) return true;
        return false;
      };
      return visit(window);
    },
    undefined,
    { timeout: 90_000 },
  );

async function hidePage(page: Page): Promise<void> {
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

test.describe('autosave and recovery (real editor)', () => {
  test.describe.configure({ timeout: 240_000 });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });
    });
  });

  test('edits survive the tab going away and come back through the recovery bar', async ({ page }) => {
    const dir = join('test-results', 'autosave-recovery');
    mkdirSync(dir, { recursive: true });
    const path = join(dir, 'Recovery.docx');
    writeFileSync(path, buildDocx('original paragraph'));

    await page.goto('/');
    const chooserPromise = page.waitForEvent('filechooser');
    await page.locator('#hero-open').click();
    (await chooserPromise).setFiles(path);

    await waitForEditorReady(page);
    const sdk = page.frameLocator('iframe[name="frameEditor"]').locator('#editor_sdk');
    await sdk.waitFor({ state: 'visible', timeout: 30_000 });
    await sdk.click({ position: { x: 300, y: 200 } });
    await page.keyboard.press('End');
    await page.keyboard.type(' never saved to disk', { delay: 60 });

    // The tab goes away without the user ever exporting.
    await hidePage(page);

    // Inside the shortest interval the scheduler can ever choose
    // (MIN_SNAPSHOT_INTERVAL_MS, 30 s) on purpose: with a longer window the
    // periodic tick would eventually take a snapshot too, and the test would
    // pass whether or not hiding the page did anything -- which is exactly
    // what it looked like before this bound was tightened.
    await expect
      .poll(async () => (await readHistoryDocs(page)).length, { timeout: 25_000, message: 'a snapshot was stored' })
      .toBe(1);
    const [stored] = await readHistoryDocs(page);
    expect(stored.title).toBe('Recovery.docx');
    expect(stored.size).toBeGreaterThan(0);
    // Never exported, so the browser holds the only copy of that sentence.
    expect(stored.savedToDiskAt).toBeUndefined();

    // Coming back the next day: a blank editor, nothing on screen about
    // yesterday's work until the offer appears.
    await page.goto('/editor?new=docx');
    const bar = page.locator('#recovery-bar');
    await expect(bar).toBeVisible({ timeout: 30_000 });
    await expect(bar).toContainText('Recovery.docx');

    await bar.locator('.recovery-restore').click();
    await waitForEditorReady(page);
    const restoredSdk = page.frameLocator('iframe[name="frameEditor"]').locator('#editor_sdk');
    await restoredSdk.waitFor({ state: 'visible', timeout: 30_000 });
    // Ctrl+S goes to whatever has focus, and after a navigation that is the
    // page, not the editor inside the frame.
    await restoredSdk.click({ position: { x: 300, y: 200 } });

    // The proof is the bytes: export what was restored and read it back.
    const downloadPromise = page.waitForEvent('download', { timeout: 120_000 });
    await page.keyboard.press('Control+s');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('Recovery.docx');
    const bytes = new Uint8Array(readFileSync(await download.path()));
    const text = ooxmlText((await zipEntryText(bytes, 'word/document.xml')) || '');
    expect(text).toContain('original paragraph never saved to disk');

    // Saved at last: the offer has nothing left to make.
    await expect
      .poll(async () => (await readHistoryDocs(page))[0]?.savedToDiskAt, { timeout: 30_000 })
      .toBeGreaterThan(0);
  });

  test('a reload comes back to the same document, not a fresh one', async ({ page }) => {
    // What the id in the URL buys. Before it, a reload of a blank document
    // opened a second blank document and the edits could only be found through
    // the recovery bar; now the address itself names the document.
    await page.goto('/editor?new=docx');
    await waitForEditorReady(page);
    const sdk = page.frameLocator('iframe[name="frameEditor"]').locator('#editor_sdk');
    await sdk.waitFor({ state: 'visible', timeout: 30_000 });
    await sdk.click({ position: { x: 300, y: 200 } });
    await page.keyboard.type('typed before the reload', { delay: 60 });

    // The editor stamped its identity into the address bar on open.
    const docId = new URL(page.url()).searchParams.get('saved');
    expect(docId).toBeTruthy();

    await hidePage(page);
    await expect
      .poll(async () => (await readHistoryDocs(page)).length, { timeout: 25_000, message: 'a snapshot was stored' })
      .toBe(1);

    await page.reload();
    await waitForEditorReady(page);
    const reloadedSdk = page.frameLocator('iframe[name="frameEditor"]').locator('#editor_sdk');
    await reloadedSdk.waitFor({ state: 'visible', timeout: 30_000 });
    // Same document, same row: no second id, no duplicate history entry.
    expect(new URL(page.url()).searchParams.get('saved')).toBe(docId);
    expect(await readHistoryDocs(page)).toHaveLength(1);

    await reloadedSdk.click({ position: { x: 300, y: 200 } });
    const downloadPromise = page.waitForEvent('download', { timeout: 120_000 });
    await page.keyboard.press('Control+s');
    const bytes = new Uint8Array(readFileSync(await (await downloadPromise).path()));
    const text = ooxmlText((await zipEntryText(bytes, 'word/document.xml')) || '');
    // Case-insensitive: a blank document's autocorrect capitalises the first
    // letter of the sentence, which is the editor being an editor.
    expect(text).toMatch(/typed before the reload/i);
  });

  test('an embedded editor writes nothing to the local history', async ({ page }) => {
    // The document on screen belongs to the host page. Keeping a copy of it in
    // this origin's storage would be us retaining someone else's user's file.
    await page.goto('/embed-demo.html');
    await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });

    await page.evaluate(async () => {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['embedded', 1]]), 'Sheet1');
      const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      await post('document:open-buffer', {
        fileName: 'embedded.xlsx',
        buffer: new Uint8Array(data).buffer,
        readonly: false,
      });
      await post('document:save', {});
    });

    // Hide the editor frame itself: that is the branch a snapshot would come
    // through if the embed check were missing.
    for (const frame of page.frames()) {
      await frame
        .evaluate(() => {
          Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
          document.dispatchEvent(new Event('visibilitychange'));
        })
        .catch(() => {
          /* cross-origin frames are not ours to poke */
        });
    }
    await page.waitForTimeout(3_000);

    expect(await readHistoryDocs(page)).toHaveLength(0);
  });
});
