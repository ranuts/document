import { expect, test } from './lib/l0';

/**
 * The language menu, across every locale the site ships.
 *
 * It is a disclosure button over a list of real links: ranui's <r-popover> for
 * the open/close behaviour, and `<a href hreflang lang>` for the entries. It
 * used to be an <r-select>, which announced itself as a combobox -- a form
 * field -- when what it does is navigate. Links also mean a reader can
 * middle-click one, copy it, or reach it with JavaScript off, and a crawler can
 * follow it.
 *
 * What this file measures, in the browser, is the part no unit test can see:
 * that the panel opens where it should, that nothing is clipped in any
 * language, and that the whole thing still fits a phone.
 */
const LOCALES = ['', 'zh-CN/', 'ja/', 'de/', 'es/', 'ko/', 'pt/'];
/** Endonyms, in the order the menu lists them (bin/build-pages.mjs MENU_ORDER). */
const ENDONYMS = ['Deutsch', 'English', 'Español', 'Português', '中文', '日本語', '한국어'];

const openMenu = async (page: import('@playwright/test').Page) => {
  const trigger = page.locator('.lang-trigger').first();
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(page.locator('a.lang-option').first()).toBeVisible();
  return trigger;
};

test.describe('language menu', () => {
  for (const locale of LOCALES) {
    const label = locale || 'en';

    test(`${label}: names every language in its own words, whole`, async ({ page }) => {
      await page.goto(`/${locale}`);
      await openMenu(page);

      const options = await page.evaluate(() =>
        [...document.querySelectorAll('a.lang-option')].map((item) => ({
          text: item.textContent?.trim() ?? '',
          lang: item.getAttribute('lang'),
          hreflang: item.getAttribute('hreflang'),
          href: item.getAttribute('href'),
          current: item.getAttribute('aria-current'),
          // The label must not be cut off: the panel sizes itself to its
          // content now, but a CSS change could still trap it.
          clipped: item.scrollWidth > item.clientWidth + 1,
        })),
      );

      expect(options.map((o) => o.text)).toEqual(ENDONYMS);
      for (const option of options) {
        expect(option.clipped, `menu clips "${option.text}" on /${locale}`).toBe(false);
        // Every entry is a real link, and says what language it leads to --
        // `lang` so a screen reader pronounces the endonym correctly, and
        // `hreflang` so it announces (and a crawler understands) the target.
        expect(option.href, `${option.text} is not a link`).toBeTruthy();
        expect(option.lang, `${option.text} has no lang`).toBeTruthy();
        expect(option.hreflang).toBe(option.lang);
      }

      // Exactly one entry is the current page, and it is this locale's.
      const current = options.filter((o) => o.current === 'page');
      expect(current).toHaveLength(1);
      expect(current[0].lang).toBe(label.replace(/\/$/, ''));

      // The trigger names the language being read, so a reader who cannot read
      // the page can still see which one they are on.
      const triggerText = await page.locator('.lang-current').first().textContent();
      expect(triggerText?.trim()).toBe(current[0].text);
    });
  }

  /**
   * The menu sits at the right end of the header, so it opens inwards --
   * `placement="bottom-end"`. Aligned the other way it would start out
   * overflowing the viewport and be shifted back, landing left of the trigger it
   * belongs to, which reads as a misaligned menu.
   */
  test('the panel hangs from the right edge of its trigger', async ({ page }) => {
    await page.goto('/pt/');
    const trigger = await openMenu(page);
    const triggerBox = (await trigger.boundingBox())!;
    const panelBox = (await page.locator('a.lang-option').first().boundingBox())!;

    const panel = await page.evaluate(() => {
      const first = document.querySelector('a.lang-option')!;
      const list = first.closest('.lang-list')!.getBoundingClientRect();
      return { left: list.left, right: list.right, width: list.width, vw: window.innerWidth };
    });

    expect(panel.width, 'the panel is not wider than the trigger, so this proves nothing').toBeGreaterThan(
      triggerBox.width,
    );
    expect(Math.abs(panel.right - (triggerBox.x + triggerBox.width)), 'panel is not right-aligned').toBeLessThanOrEqual(
      6,
    );
    expect(panel.right, 'the panel runs past the viewport').toBeLessThanOrEqual(panel.vw);
    expect(panelBox.y, 'the panel does not hang below the trigger').toBeGreaterThan(triggerBox.y);
  });

  /**
   * On a phone the trigger keeps the globe and the caret and drops the language
   * name, which is the part that costs width. The bar used to drop the GitHub
   * link instead, to make room for a trigger wide enough to hold "Português".
   */
  test('fits on a phone, in the longest language, on both kinds of page', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    for (const route of ['/pt/', '/pt/open/docx']) {
      await page.goto(route);
      const box = await page
        .locator('.lang-trigger')
        .first()
        .evaluate((el) => {
          const rect = el.getBoundingClientRect();
          const name = el.querySelector('.lang-current');
          return {
            left: rect.left,
            right: rect.right,
            vw: window.innerWidth,
            nameShown: name ? getComputedStyle(name).display !== 'none' : true,
          };
        });
      expect(box.right, `${route}: the language trigger runs past the viewport`).toBeLessThanOrEqual(box.vw);
      expect(box.left, `${route}: the language trigger starts off-screen`).toBeGreaterThanOrEqual(0);
      expect(box.nameShown, `${route}: the language name should be hidden on a phone`).toBe(false);
    }
  });

  test('a satellite page offers the same menu as the homepage', async ({ page }) => {
    await page.goto('/pt/open/docx');
    await openMenu(page);
    const options = await page.evaluate(() =>
      [...document.querySelectorAll('a.lang-option')].map((item) => item.getAttribute('hreflang')),
    );
    expect(options).toEqual(['de', 'en', 'es', 'pt', 'zh-CN', 'ja', 'ko']);
  });

  /**
   * Escape and outside-click come from <r-popover>; this checks the wiring
   * reached it, since a menu that cannot be dismissed is worse than one that
   * does not open.
   */
  test('closes on Escape and on a click outside', async ({ page }) => {
    await page.goto('/');
    const trigger = await openMenu(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('a.lang-option').first()).toBeHidden();

    await trigger.click();
    await expect(page.locator('a.lang-option').first()).toBeVisible();
    await page.locator('h1').first().click({ force: true });
    await expect(page.locator('a.lang-option').first()).toBeHidden();
  });
});

test.describe('a chosen language follows the reader', () => {
  /**
   * The site is seven directories of static pages plus one app (/editor and
   * /history) that resolves its language from ?locale=, then a cookie, then
   * localStorage, then the browser. Picking a language on a static page used
   * to be nothing but a navigation: the choice lived in the path, and the
   * moment a reader stepped off it -- "saved documents" from the Japanese
   * homepage -- they were back in English.
   */
  test('picking a language on a static page reaches the app pages too', async ({ page }) => {
    await page.goto('/');
    // Choose 日本語 through the menu, the way a reader does.
    await page.locator('.lang-trigger').first().click();
    await page.locator('a.lang-option[hreflang="ja"]').first().click();
    await page.waitForURL('**/ja/');
    expect(await page.evaluate(() => document.documentElement.lang)).toBe('ja');

    // The link into the app carries it...
    const historyHref = await page.locator('a.recent-all').getAttribute('href');
    expect(historyHref).toContain('locale=ja');

    // ...and so does the app itself, even at a bare URL, because the choice
    // was remembered rather than only navigated to.
    await page.goto('/history');
    await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe('ja');
    await page.goto('/editor?new=docx');
    await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe('ja');
  });
});

test.describe('page chrome', () => {
  /**
   * The browser's default 8px body margin. landing.css always cleared it;
   * home.css did not, so the homepage floated inside a frame of backdrop --
   * invisible against a white page, obvious the moment the theme is dark.
   */
  test('no page floats inside the browser default body margin', async ({ page }) => {
    for (const route of ['/', '/ja/', '/pt/open/docx', '/history']) {
      await page.goto(route);
      const margin = await page.evaluate(() => {
        const style = getComputedStyle(document.body);
        return [style.marginTop, style.marginRight, style.marginBottom, style.marginLeft];
      });
      expect(margin, `${route} keeps a body margin`).toEqual(['0px', '0px', '0px', '0px']);
    }
  });
});
