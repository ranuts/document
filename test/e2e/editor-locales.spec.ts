import { expect, test } from './lib/l0';
import type { Frame, Page } from '@playwright/test';

/**
 * The editor, in every language the site is translated into.
 *
 * A Korean visitor opening a blank document got the vendor's modal "An error
 * occurred while working with the document. Use the 'Download as' option to
 * save a backup copy" -- before typing anything. The cause was a missing
 * translation: `DE.Views.Statusbar.tipMultiplePages` exists in en.json and not
 * in ko.json, the status bar passes it to a tooltip setter that does `hint[0]`,
 * and the TypeError is caught and reported as a document error.
 *
 * Nothing in the suite would have caught it, because everything else opens the
 * editor in English. This does what the user did: for each locale, create a
 * blank document and wait for the editor to settle.
 */
const LOCALES = ['zh-CN', 'ja', 'de', 'es', 'ko', 'pt'] as const;

/** The vendor's modal dialog, if one is on screen. */
async function fatalDialog(frame: Frame): Promise<string | null> {
  return frame
    .evaluate(() => {
      const box = document.querySelector('.asc-window.modal .body, .asc-window .body');
      return box && (box as HTMLElement).offsetParent !== null
        ? (box.textContent || '').replace(/\s+/g, ' ').trim()
        : null;
    })
    .catch(() => null);
}

const editorFrame = (page: Page) => page.frames().find((f) => /documenteditor/.test(f.url()));

test.describe('editor in every site language', () => {
  for (const locale of LOCALES) {
    test(`${locale}: a blank document opens without a vendor error dialog`, async ({ page }) => {
      await page.goto(`/editor?locale=${locale}&new=docx`);

      // Wait for the toolbar rather than a fixed delay: the crash happened
      // while the chrome rendered, so the assertion has to come after it.
      const frame = await expect
        .poll(async () => editorFrame(page)?.url() ?? null, { timeout: 60_000 })
        .not.toBeNull()
        .then(() => editorFrame(page)!);
      await expect
        .poll(async () => frame.evaluate(() => document.querySelectorAll('.ribtab a').length).catch(() => 0), {
          timeout: 60_000,
        })
        .toBeGreaterThan(3);

      // Give the status bar and the rest of the late chrome time to render;
      // the Korean failure surfaced there, after the tabs were up.
      await page.waitForTimeout(3_000);
      expect(await fatalDialog(frame), `${locale} shows a vendor error dialog`).toBeNull();

      // And the UI really is in that language, not English with a locale in the
      // URL -- the tabs are the first thing a translation touches.
      const tabs = await frame.evaluate(() =>
        [...document.querySelectorAll('.ribtab a')].map((a) => a.textContent?.trim() ?? ''),
      );
      expect(tabs.filter(Boolean).length, `${locale} has no toolbar tabs`).toBeGreaterThan(3);
      // None of these locales writes its Home tab in English, so seeing it
      // means the lang never reached the editor.
      expect(tabs.join(' '), `${locale} toolbar is still English`).not.toContain('Home');
    });
  }
});
