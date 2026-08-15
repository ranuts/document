import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildDocx, ooxmlText, zipEntryText } from './lib/ooxml';
import { expect, test } from './lib/l0';

/**
 * The standalone site (index.html), not the embed demo: what users actually
 * click. Open a local file through the hero button and the native file
 * chooser, type into the real editor, save with Ctrl+S and receive the
 * download; and the "New Excel" flow. Matrix section C "standalone 主站".
 *
 * showSaveFilePicker is removed so saveFileToDisk takes the anchor-download
 * branch Playwright can observe (the picker is browser UI, not our code).
 */
test.describe('standalone site (real editor)', () => {
  test.describe.configure({ timeout: 150_000 });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });
    });
  });

  const waitForEditorReady = (page: import('@playwright/test').Page) =>
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

  test('open a local docx from the hero button, type, Ctrl+S downloads the edited file', async ({ page }) => {
    const dir = join('test-results', 'main-site');
    mkdirSync(dir, { recursive: true });
    const path = join(dir, '主站打开 (1).docx');
    writeFileSync(path, buildDocx('main site paragraph'));

    await page.goto('/');
    const chooserPromise = page.waitForEvent('filechooser');
    await page.locator('#hero-open').click();
    const chooser = await chooserPromise;
    await chooser.setFiles(path);

    await waitForEditorReady(page);
    const sdk = page.frameLocator('iframe[name="frameEditor"]').locator('#editor_sdk');
    await sdk.waitFor({ state: 'visible', timeout: 30_000 });
    await sdk.click({ position: { x: 300, y: 200 } });
    await page.keyboard.press('End');
    await page.keyboard.type(' typed', { delay: 60 });

    const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });
    await page.keyboard.press('Control+s');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('主站打开 (1).docx');
    const saved = await download.path();
    const bytes = new Uint8Array(readFileSync(saved));
    expect(bytes[0]).toBe(0x50);
    expect(ooxmlText(zipEntryText(bytes, 'word/document.xml') || '')).toContain('main site paragraph typed');
  });

  test('New Excel from the hero creates a blank workbook that saves via Ctrl+S', async ({ page }) => {
    await page.goto('/');
    await page.locator('#hero-new-xlsx').click();
    await waitForEditorReady(page);
    const sdk = page.frameLocator('iframe[name="frameEditor"]').locator('#editor_sdk');
    await sdk.waitFor({ state: 'visible', timeout: 30_000 });
    await sdk.click({ position: { x: 200, y: 150 } });
    await page.keyboard.type('hello', { delay: 60 });
    await page.keyboard.press('Enter');

    const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });
    await page.keyboard.press('Control+s');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('New_Document.xlsx');
    const bytes = new Uint8Array(readFileSync(await download.path()));
    expect(bytes[0]).toBe(0x50);
    expect(zipEntryText(bytes, 'xl/sharedStrings.xml') || '').toContain('hello');
  });
});
