import { expect, test } from './lib/l0';
import type { Frame, Page } from '@playwright/test';

/** Neutral presentation must keep legal attribution accessible. */
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

test.describe('neutral editor presentation and legal notices', () => {
  for (const format of ['docx', 'xlsx', 'pptx']) {
    test(`${format} hides product logos and keeps legal information reachable`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.goto(`/editor?new=${format}`);
      const frame = () =>
        page.frames().find((f) => /(?:document|spreadsheet|presentation)editor\/main\//.test(f.url()));
      await expect.poll(() => frame()?.url() ?? null, { timeout: 60_000 }).not.toBeNull();
      const editor = frame()!;
      await expect(editor.locator('#left-btn-about')).toBeVisible({ timeout: 60_000 });
      await expect(editor.locator('#header-logo')).toBeHidden();
      await expect.poll(() => editor.title()).not.toMatch(/ONLYOFFICE$/i);
      await openAbout(editor);
      await expect(editor.locator('.asc-about-office')).toBeHidden();
      await expect(editor.locator('#id-about-company-logo')).toBeHidden();
      await expect(editor.locator('#oo-source-notice')).toContainText('Ascensio System SIA');
      await expect(editor.locator('#oo-source-notice')).toContainText('WITHOUT ANY WARRANTY');
      await expect(editor.locator('#oo-source-notice a[href="/LICENSE"]')).toBeVisible();
      await expect(editor.locator('#oo-source-notice a[href="/NOTICE"]')).toBeVisible();
      await expect(editor.locator('#id-about-licensor-version-name')).toBeVisible();
    });
  }

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

    for (const [url, text] of [
      ['/LICENSE', 'GNU AFFERO GENERAL PUBLIC LICENSE'],
      ['/NOTICE', 'Ascensio System SIA'],
    ]) {
      const response = await page.request.get(url);
      expect(response.ok()).toBe(true);
      expect(await response.text()).toContain(text);
    }
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
      await expect(page.locator('.logo, .eco, .ghmark')).toHaveCount(0);
      await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute(
        'href',
        /\/icons\/document-(?:light|dark)\.svg$/,
      );
    });
  }
});

test('PWA icons are served and decode at their declared dimensions', async ({ page }) => {
  await page.goto('/');
  const icons = await page.evaluate(async () => {
    const manifest = await (await fetch('/manifest.json')).json();
    return Promise.all(
      manifest.icons.map(async (icon: { src: string; sizes: string; purpose: string }) => {
        const response = await fetch(new URL(icon.src, new URL('/manifest.json', location.origin)));
        if (!response.ok) throw new Error(`Icon request failed: ${icon.src}`);
        const bitmap = await createImageBitmap(await response.blob());
        const dimensions = `${bitmap.width}x${bitmap.height}`;
        bitmap.close();
        return { declared: icon.sizes, dimensions, purpose: icon.purpose };
      }),
    );
  });
  expect(icons.length).toBeGreaterThanOrEqual(3);
  expect(icons.some((icon) => icon.purpose === 'maskable')).toBe(true);
  for (const icon of icons) expect(icon.dimensions).toBe(icon.declared);
});
