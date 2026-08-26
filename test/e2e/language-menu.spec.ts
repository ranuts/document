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
   * One control, one tab stop, one set of ARIA.
   *
   * r-popover puts `tabindex`, `aria-haspopup` and `aria-expanded` on itself, so
   * a <button> nested inside it -- which is how this was first written -- became
   * a second tab stop that carried the accessible name while the state stayed on
   * the host. A screen reader would have announced an anonymous popup and then a
   * "Language" button that never reported being open.
   */
  test('is a single control: one tab stop, with the name and the state together', async ({ page }) => {
    await page.goto('/');
    const aria = await page.evaluate(() => {
      const menu = document.querySelector('r-popover.lang-menu') as HTMLElement;
      const inHeader = [...document.querySelectorAll('header.bar *')].filter((el) => (el as HTMLElement).tabIndex >= 0);
      return {
        stops: inHeader.filter((el) => el === menu || menu.contains(el)).length,
        role: menu.getAttribute('role'),
        name: menu.getAttribute('aria-label'),
        expanded: menu.getAttribute('aria-expanded'),
      };
    });

    expect(aria.stops, 'the language control should be one tab stop').toBe(1);
    expect(aria.role).toBe('button');
    expect(aria.name, 'the control has no accessible name').toBeTruthy();
    expect(aria.expanded).toBe('false');

    // And the state it reports is its own.
    await page.locator('.lang-trigger').first().click();
    await expect(page.locator('r-popover.lang-menu')).toHaveAttribute('aria-expanded', 'true');
  });

  /** The keyboard path: reach it with Tab, open it with Enter. */
  test('opens from the keyboard', async ({ page }) => {
    await page.goto('/');
    await page.locator('r-popover.lang-menu').first().focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('a.lang-option').first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('a.lang-option').first()).toBeHidden();
  });

  /**
   * The panel lines up with the trigger's leading edge, so its rows start where
   * the trigger's own label does and the two read as one column.
   *
   * It was end-aligned first, when the panel was a guessed 152px wide -- 67px
   * wider than the trigger, all of it hanging off the left, with the menu's
   * labels 65px away from the trigger's. Sizing the panel to its content took
   * the overhang away and with it the reason for the end alignment.
   */
  test('the panel lines up with its trigger, and stays on screen', async ({ page }) => {
    await page.goto('/pt/');
    const trigger = await openMenu(page);
    const triggerBox = (await trigger.boundingBox())!;

    const geometry = await page.evaluate(() => {
      const trig = document.querySelector('.lang-trigger')!;
      const panel = document.querySelector('.ran-popover-dropdown')!.getBoundingClientRect();
      const textStart = (el: Element) => {
        const node = [...el.childNodes].find((n) => n.nodeType === 3)!;
        const range = document.createRange();
        range.selectNodeContents(node);
        return range.getBoundingClientRect().left;
      };
      return {
        panelLeft: panel.left,
        panelRight: panel.right,
        panelTop: panel.top,
        vw: window.innerWidth,
        labelOffset:
          textStart(trig.querySelector('.lang-current')!) - textStart(document.querySelector('.lang-option')!),
      };
    });

    // Leading edges together.
    expect(Math.abs(geometry.panelLeft - triggerBox.x), 'panel is not aligned to the trigger').toBeLessThanOrEqual(1);
    // And the labels land in one column: what is left is the difference between
    // the globe's gutter and the check's, not a placement offset.
    expect(Math.abs(geometry.labelOffset), 'the menu labels are off the trigger label').toBeLessThanOrEqual(8);
    expect(geometry.panelRight, 'the panel runs past the viewport').toBeLessThanOrEqual(geometry.vw);
    expect(geometry.panelTop, 'the panel does not hang below the trigger').toBeGreaterThan(triggerBox.y);
  });

  /**
   * Narrow enough and the trigger sits against the right edge, where a
   * leading-edge panel would overflow. The boundary shift is what keeps it on
   * screen, so this is the case that proves the alignment choice does not
   * depend on there being room.
   */
  test('on a narrow viewport the panel is pulled back on screen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto('/pt/');
    await openMenu(page);
    const panel = await page.evaluate(() => {
      const box = document.querySelector('.ran-popover-dropdown')!.getBoundingClientRect();
      return { left: box.left, right: box.right, vw: window.innerWidth };
    });
    expect(panel.right).toBeLessThanOrEqual(panel.vw);
    expect(panel.left).toBeGreaterThanOrEqual(0);
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
