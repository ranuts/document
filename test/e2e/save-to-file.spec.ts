import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { readHistoryKeys } from './lib/history-db';
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
 *
 * The writes are counted too, because a save does not edit the file in place:
 * it writes elsewhere and swaps the result in when the stream closes. Any
 * snapshot taken before that swap is dead after it, so a read that straddles
 * one fails with NotReadableError no matter what the file ends up holding.
 * Counting opens and closes lets this spec wait for the save it asked for and
 * then read a file nobody is replacing, rather than poll the file's contents
 * and hope not to land inside a swap.
 *
 * The counting wraps createWritable on the prototype rather than on the handle
 * the picker returns, because the second page's handle was rebuilt out of
 * IndexedDB: anything hung on the original object is gone by then.
 */
const stubPicker = `
  window.__pickerCalls = 0;
  window.__writesInFlight = 0;
  window.__writesCommitted = 0;

  window.showSaveFilePicker = async () => {
    window.__pickerCalls += 1;
    const root = await navigator.storage.getDirectory();
    return root.getFileHandle('saved-document.docx', { create: true });
  };

  // Every frame on the page runs this, and only the top window ever saves --
  // so a frame without the API is not a problem to report, just nothing to wrap.
  if (typeof FileSystemFileHandle !== 'undefined') {
    const nativeCreateWritable = FileSystemFileHandle.prototype.createWritable;
    FileSystemFileHandle.prototype.createWritable = async function (...args) {
      window.__writesInFlight += 1;
      let stream;
      try {
        stream = await nativeCreateWritable.apply(this, args);
      } catch (error) {
        window.__writesInFlight -= 1;
        throw error;
      }

      let settled = false;
      const settle = (committed) => {
        if (settled) return;
        settled = true;
        window.__writesInFlight -= 1;
        if (committed) window.__writesCommitted += 1;
      };

      const nativeClose = stream.close.bind(stream);
      const nativeAbort = stream.abort.bind(stream);
      stream.close = async () => {
        try {
          await nativeClose();
        } catch (error) {
          settle(false);
          throw error;
        }
        settle(true);
      };
      stream.abort = async (reason) => {
        try {
          await nativeAbort(reason);
        } finally {
          settle(false);
        }
      };
      return stream;
    };
  }
`;

const pickerCalls = (page: Page) => page.evaluate(() => (window as unknown as { __pickerCalls: number }).__pickerCalls);

const writesCommitted = (page: Page) =>
  page.evaluate(() => (window as unknown as { __writesCommitted: number }).__writesCommitted);

/**
 * Wait until the file has taken `count` writes and no stream is open on it.
 *
 * This is the whole answer to reading a file that something else is writing:
 * ask when the writing is done instead of guessing. Everything below reads the
 * file only through this gate.
 */
const waitForWrites = (page: Page, count: number) =>
  page.waitForFunction(
    (expected) => {
      const state = window as unknown as { __writesCommitted: number; __writesInFlight: number };
      return state.__writesCommitted >= expected && state.__writesInFlight === 0;
    },
    count,
    { timeout: 120_000 },
  );

/** The bytes now in the file the picker handed out. Call it behind waitForWrites. */
const savedBytes = (page: Page) =>
  page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle('saved-document.docx');
    return Array.from(new Uint8Array(await (await handle.getFile()).arrayBuffer()));
  });

/** The document text in that file, which is what every assertion here is about. */
const savedText = async (page: Page): Promise<string> => {
  const bytes = new Uint8Array(await savedBytes(page));
  return ooxmlText((await zipEntryText(bytes, 'word/document.xml')) || '');
};

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

    // The stub hands out a real origin-private file handle, so this spec needs
    // OPFS writable streams. WebKit has the handles but not the streams --
    // `createWritable().write(x)` rejects with UnknownError for every payload
    // shape (File, Blob, Uint8Array, ArrayBuffer, string; probed 2026-08-25).
    // Nothing to fix on our side: saving to the document's own file is
    // Chromium-only by design (Safari has no showSaveFilePicker at all,
    // Firefox has said it will not add one) and falls back to a download
    // everywhere else. Probed rather than keyed to the browser name so the
    // spec starts running by itself if WebKit ships the streams.
    await page.goto('/');
    const writableStreams = await page.evaluate(async () => {
      try {
        const root = await navigator.storage.getDirectory();
        const handle = await root.getFileHandle('probe.bin', { create: true });
        const stream = await handle.createWritable();
        await stream.write(new Uint8Array([1]));
        await stream.close();
        await root.removeEntry('probe.bin');
        return true;
      } catch {
        return false;
      }
    });
    test.skip(!writableStreams, 'this engine has no origin-private writable streams to stub the picker with');
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
    await waitForWrites(page, 1);
    expect(await savedText(page)).toContain('first paragraph one');

    // Second save: same file, no second dialog. This is the whole difference
    // from a download -- the user chose a file, not a moment.
    await sdk.click({ position: { x: 300, y: 200 } });
    await page.keyboard.press('End');
    await page.keyboard.type(' two', { delay: 60 });
    await page.keyboard.press('Control+s');

    await waitForWrites(page, 2);
    expect(await savedText(page)).toContain('first paragraph one two');
    expect(await pickerCalls(page)).toBe(1);
    // Two saves, two writes: the file is opened for writing when the user
    // saves and at no other time.
    expect(await writesCommitted(page)).toBe(2);
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
    await waitForWrites(page, 1);

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
      .poll(async () => (await readHistoryKeys(page, 'docs')).length, {
        timeout: 60_000,
        message: 'a snapshot exists to reopen',
      })
      .toBeGreaterThan(0);

    // A second page rather than a reload: it starts with an empty JS heap, so
    // the handle cannot come from the session cache -- it has to be read back
    // out of IndexedDB, which is the thing being tested. It is also the real
    // scenario: the tab was closed and the document opened again later.
    const docId = new URL(page.url()).searchParams.get('saved');
    expect(docId).toBeTruthy();

    // Close the first tab before opening the second -- which is what the
    // comment above describes, and what the user does. Keeping both alive also
    // keeps two OnlyOffice instances and their 283 MB heaps in one browser,
    // which is what made this time out on CI while passing locally.
    const context = page.context();
    await page.close();

    const later = await context.newPage();
    await later.addInitScript(stubPicker);
    await later.goto(`/editor?saved=${docId}`);
    await waitForEditorReady(later);
    const reopened = later.frameLocator('iframe[name="frameEditor"]').locator('#editor_sdk');
    await reopened.waitFor({ state: 'visible', timeout: 30_000 });
    await reopened.click({ position: { x: 300, y: 200 } });
    await later.keyboard.press('End');
    await later.keyboard.type(' after', { delay: 60 });
    await later.keyboard.press('Control+s');

    // The second page's own counter: one write, made through a handle it never
    // picked.
    await waitForWrites(later, 1);
    expect(await savedText(later)).toContain('after');
    // The new page never opened a dialog: the link survived the tab closing.
    expect(await pickerCalls(later)).toBe(0);
  });
});
