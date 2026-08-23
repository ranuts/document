import { expect, test } from './lib/l0';
import type { Frame, Page } from '@playwright/test';

/**
 * The ONLYOFFICE attribution, on screen.
 *
 * Section 7(b) of the vendor's AGPL terms requires a derivative work to retain
 * the original product logo. This build used to hide it: an injected stylesheet
 * took out `#header-logo` and the DocEditor config set `customization.about`
 * to false, which between them left no product mark anywhere in the interface.
 * The unit half of this (test/unit/branding-notice.test.ts) pins the two source
 * changes; this is the half that proves the result is actually visible, which
 * is the only claim the license cares about.
 *
 * Reverse-verified: re-adding `#header-logo` to guards/chrome.ts fails the
 * first case, and setting `about: false` back fails the second and third.
 */
const editorFrame = (page: Page) => page.frames().find((f) => /documenteditor/.test(f.url()));

async function openBlankDocument(page: Page): Promise<Frame> {
  await page.goto('/editor?new=docx');
  await expect.poll(() => editorFrame(page)?.url() ?? null, { timeout: 60_000 }).not.toBeNull();
  const frame = editorFrame(page)!;
  // The header and the left rail render with the rest of the chrome, so wait
  // for the ribbon rather than for the frame's own load event.
  await expect
    .poll(() => frame.evaluate(() => document.querySelectorAll('.ribtab a').length).catch(() => 0), {
      timeout: 60_000,
    })
    .toBeGreaterThan(3);
  return frame;
}

/** Opens the About pane and returns its text, or '' if it never populates. */
async function openAbout(frame: Frame): Promise<string> {
  await frame.click('#left-btn-about');
  const text = () =>
    frame
      .evaluate(() => {
        const panel = document.querySelector('#about-menu-panel');
        return panel && panel.children.length > 0 ? (panel.textContent || '').replace(/\s+/g, ' ') : '';
      })
      .catch(() => '');
  await expect.poll(text, { timeout: 30_000 }).not.toBe('');
  return text();
}

test.describe('ONLYOFFICE branding (AGPL-3.0 Section 7(b))', () => {
  test('the product logo is visible in the editor header', async ({ page }) => {
    const frame = await openBlankDocument(page);
    await expect
      .poll(() => frame.evaluate(() => !!document.querySelector('#header-logo')), { timeout: 30_000 })
      .toBe(true);

    const logo = await frame.evaluate(() => {
      const el = document.querySelector('#header-logo') as HTMLElement;
      const mark = (el.querySelector('i') as HTMLElement) || el;
      const box = mark.getBoundingClientRect();
      return {
        hidden: getComputedStyle(el).display === 'none' || getComputedStyle(el).visibility === 'hidden',
        image: getComputedStyle(mark).backgroundImage,
        width: box.width,
        height: box.height,
      };
    });

    expect(logo.hidden, 'the ONLYOFFICE header logo must not be hidden -- see NOTICE').toBe(false);
    // Painted, not a zero-sized element that merely exists in the DOM.
    expect(logo.image).toContain('header-logo');
    expect(logo.width).toBeGreaterThan(20);
    expect(logo.height).toBeGreaterThan(8);
  });

  test('the About entry is reachable and carries the vendor copyright', async ({ page }) => {
    const frame = await openBlankDocument(page);

    const inRail = await frame.evaluate(() => {
      const el = document.querySelector('#left-btn-about');
      return el ? getComputedStyle(el).display !== 'none' : false;
    });
    expect(inRail, 'the About entry must stay in the left rail -- see NOTICE').toBe(true);

    expect(await openAbout(frame)).toContain('Ascensio System SIA');
  });

  test("the About pane also offers this build's own source (Section 13)", async ({ page }) => {
    const frame = await openBlankDocument(page);
    await openAbout(frame);

    await expect
      .poll(() => frame.evaluate(() => !!document.querySelector('#oo-source-notice')), { timeout: 30_000 })
      .toBe(true);
    const notice = await frame.evaluate(() => {
      const box = document.querySelector('#oo-source-notice') as HTMLElement;
      return {
        text: (box.textContent || '').replace(/\s+/g, ' '),
        href: box.querySelector('a')?.getAttribute('href') ?? '',
        height: box.getBoundingClientRect().height,
      };
    });

    expect(notice.height).toBeGreaterThan(0);
    expect(notice.text).toContain('not an official ONLYOFFICE product');
    expect(notice.href).toBe('https://github.com/ranuts/document');
  });
});

test.describe('trademark notice (AGPL-3.0 Section 7(e))', () => {
  const PAGES = [
    ['/', 'ONLYOFFICE is a trademark of Ascensio System SIA'],
    ['/zh-CN/', 'ONLYOFFICE 是 Ascensio System SIA 的商标'],
    ['/help', 'ONLYOFFICE is a trademark of Ascensio System SIA'],
  ] as const;

  for (const [route, expected] of PAGES) {
    test(`${route} states whose mark ONLYOFFICE is`, async ({ page }) => {
      await page.goto(route);
      await expect(page.locator('.tm').first()).toContainText(expected);
    });
  }
});
