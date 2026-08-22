import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { buildDocx, ooxmlText, zipEntryText } from './lib/ooxml';
import { expect, test } from './lib/l0';

/**
 * Saving writes back into the document's own file instead of downloading a new
 * copy each time.
 *
 * The picker is stubbed with a real origin-private file handle rather than a
 * hand-made object: it is a genuine FileSystemFileHandle, so it goes through
 * structured clone into IndexedDB and comes back out the way a handle to a file
 * on disk does. That is the part worth testing -- a fake object cannot survive
 * the round trip, and the round trip is the feature.
 */
const stubPicker = `
  window.__pickerCalls = 0;
  window.showSaveFilePicker = async () => {
    window.__pickerCalls += 1;
    const root = await navigator.storage.getDirectory();
    return root.getFileHandle('saved-document.docx', { create: true });
  };
`;

const pickerCalls = (page: Page) => page.evaluate(() => (window as unknown as { __pickerCalls: number }).__pickerCalls);

const savedBytes = (page: Page) =>
  page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle('saved-document.docx');
    return Array.from(new Uint8Array(await (await handle.getFile()).arrayBuffer()));
  });

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

test.describe('saving into the document own file (real editor)', () => {
  test.describe.configure({ timeout: 240_000 });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(stubPicker);
  });

  test('picks a file once, then writes to it on every later save', async ({ page }) => {
    const dir = join('test-results', 'save-to-file');
    mkdirSync(dir, { recursive: true });
    const path = join(dir, 'WriteBack.docx');
    writeFileSync(path, buildDocx('first paragraph'));

    await page.goto('/');
    const chooserPromise = page.waitForEvent('filechooser');
    await page.locator('#hero-open').click();
    (await chooserPromise).setFiles(path);

    await waitForEditorReady(page);
    const sdk = page.frameLocator('iframe[name="frameEditor"]').locator('#editor_sdk');
    await sdk.waitFor({ state: 'visible', timeout: 30_000 });
    await sdk.click({ position: { x: 300, y: 200 } });
    await page.keyboard.press('End');
    await page.keyboard.type(' one', { delay: 60 });
    await page.keyboard.press('Control+s');

    await expect.poll(() => pickerCalls(page), { timeout: 120_000 }).toBe(1);
    await expect.poll(async () => (await savedBytes(page)).length, { timeout: 30_000 }).toBeGreaterThan(0);
    const first = new Uint8Array(await savedBytes(page));
    expect(ooxmlText((await zipEntryText(first, 'word/document.xml')) || '')).toContain('first paragraph one');

    // Second save: same file, no second dialog. This is the whole difference
    // from a download -- the user chose a file, not a moment.
    await sdk.click({ position: { x: 300, y: 200 } });
    await page.keyboard.press('End');
    await page.keyboard.type(' two', { delay: 60 });
    await page.keyboard.press('Control+s');

    await expect
      .poll(
        async () => ooxmlText((await zipEntryText(new Uint8Array(await savedBytes(page)), 'word/document.xml')) || ''),
        { timeout: 120_000 },
      )
      .toContain('first paragraph one two');
    expect(await pickerCalls(page)).toBe(1);
  });

  test('still writes to the same file after a reload', async ({ page }) => {
    const dir = join('test-results', 'save-to-file');
    mkdirSync(dir, { recursive: true });
    const path = join(dir, 'Reopened.docx');
    writeFileSync(path, buildDocx('before reload'));

    await page.goto('/');
    const chooserPromise = page.waitForEvent('filechooser');
    await page.locator('#hero-open').click();
    (await chooserPromise).setFiles(path);
    await waitForEditorReady(page);

    const sdk = page.frameLocator('iframe[name="frameEditor"]').locator('#editor_sdk');
    await sdk.waitFor({ state: 'visible', timeout: 30_000 });
    await sdk.click({ position: { x: 300, y: 200 } });
    await page.keyboard.press('Control+s');
    await expect.poll(() => pickerCalls(page), { timeout: 120_000 }).toBe(1);

    // Edit again, then let autosave take a snapshot. Saving to disk clears the
    // unsaved-changes flag -- correctly, there is nothing unsaved once the file
    // is written -- so a snapshot only exists if there is work on top of it.
    // That is also the ordinary state of a document being worked on: linked to
    // a file, and holding a recovery point for the edits since the last save.
    await sdk.click({ position: { x: 300, y: 200 } });
    await page.keyboard.press('End');
    await page.keyboard.type(' unsaved', { delay: 60 });
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              new Promise<number>((resolve) => {
                const request = indexedDB.open('document-history');
                request.onsuccess = () => {
                  const db = request.result;
                  const all = db.transaction('docs', 'readonly').objectStore('docs').getAllKeys();
                  all.onsuccess = () => {
                    db.close();
                    resolve(all.result.length);
                  };
                };
                request.onerror = () => resolve(0);
              }),
          ),
        { timeout: 60_000, message: 'a snapshot exists to reopen' },
      )
      .toBeGreaterThan(0);

    // A second page rather than a reload: it starts with an empty JS heap, so
    // the handle cannot come from the session cache -- it has to be read back
    // out of IndexedDB, which is the thing being tested. It is also the real
    // scenario: the tab was closed and the document opened again later.
    const docId = new URL(page.url()).searchParams.get('saved');
    expect(docId).toBeTruthy();
    const later = await page.context().newPage();
    await later.addInitScript(stubPicker);
    await later.goto(`/editor?saved=${docId}`);
    await waitForEditorReady(later);
    const reopened = later.frameLocator('iframe[name="frameEditor"]').locator('#editor_sdk');
    await reopened.waitFor({ state: 'visible', timeout: 30_000 });
    await reopened.click({ position: { x: 300, y: 200 } });
    await later.keyboard.press('End');
    await later.keyboard.type(' after', { delay: 60 });
    await later.keyboard.press('Control+s');

    await expect
      .poll(
        async () => ooxmlText((await zipEntryText(new Uint8Array(await savedBytes(later)), 'word/document.xml')) || ''),
        { timeout: 120_000 },
      )
      .toContain('after');
    // The new page never opened a dialog: the link survived the tab closing.
    expect(await pickerCalls(later)).toBe(0);
  });
});
