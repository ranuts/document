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
        return Boolean(window.__ooFrames.readyEditor());
      },
      undefined,
      { timeout: 90_000 },
    );

  test('open a local docx from the hero button, type, Ctrl+S downloads the edited file', async ({ page }) => {
    const fileName = '主站打开 (1).docx';
    await page.addInitScript(() => {
      const root = window.top as Window & { __mainSiteDownloadNames?: string[] };
      root.__mainSiteDownloadNames ??= [];
      const click = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () {
        if (this.download && this.href.startsWith('blob:')) root.__mainSiteDownloadNames!.push(this.download);
        return click.call(this);
      };
    });
    const dir = join('test-results', 'main-site');
    mkdirSync(dir, { recursive: true });
    const path = join(dir, fileName);
    writeFileSync(path, buildDocx('main site paragraph'));

    await page.goto('/');
    // Compare against this browser's own filename policy, independently of the
    // app. The app's exact requested anchor name is asserted below as well.
    const nativeDownloadPromise = page.waitForEvent('download');
    await page.evaluate((name) => {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(
        new Blob(['filename probe'], {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        }),
      );
      link.download = name;
      document.body.append(link);
      link.click();
      link.remove();
    }, fileName);
    const nativeDownload = await nativeDownloadPromise;
    const nativeSuggestedName = nativeDownload.suggestedFilename();
    await nativeDownload.delete();
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
    expect(
      await page.evaluate(() => (window as Window & { __mainSiteDownloadNames?: string[] }).__mainSiteDownloadNames),
    ).toEqual([fileName]);
    expect(download.suggestedFilename()).toBe(nativeSuggestedName);
    const saved = await download.path();
    const bytes = new Uint8Array(readFileSync(saved));
    expect(bytes[0]).toBe(0x50);
    expect(ooxmlText((await zipEntryText(bytes, 'word/document.xml')) || '')).toContain('main site paragraph typed');
  });

  test('New Excel from the hero creates a blank workbook that saves via Ctrl+S', async ({ page }) => {
    await page.goto('/');
    await page.locator('#hero-new-xlsx').click();
    await waitForEditorReady(page);
    const frame = page.frameLocator('iframe[name="frameEditor"]');
    const sdk = frame.locator('#editor_sdk');
    await sdk.waitFor({ state: 'visible', timeout: 30_000 });
    // Interface theme: classic Office look by default (the v9 loader would
    // otherwise pick the flat theme-white).
    await expect(frame.locator('body')).toHaveClass(/theme-classic-light/);
    await sdk.click({ position: { x: 200, y: 150 } });
    await page.keyboard.type('hello', { delay: 60 });
    await page.keyboard.press('Enter');

    const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });
    await page.keyboard.press('Control+s');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('Untitled.xlsx');
    const bytes = new Uint8Array(readFileSync(await download.path()));
    expect(bytes[0]).toBe(0x50);
    expect((await zipEntryText(bytes, 'xl/sharedStrings.xml')) || '').toContain('hello');
  });
});
