import { expect, test } from './lib/l0';

/**
 * The language menu, across every locale the site ships.
 *
 * It is one ranui <r-select> whose trigger holds an endonym and whose panel is
 * sized to that trigger, and both clip with `overflow: hidden` inside the
 * component's shadow root. So a trigger one word too narrow does not wrap or
 * scroll -- it silently cuts the language's own name in two places at once
 * ("Portug…" in the list, "Português" sitting on top of the caret). That is
 * what happened at 104px, which had been picked when the longest label was
 * "Deutsch".
 *
 * The width is therefore a measured number, not a guessed one, and this is the
 * measurement: open every locale, assert nothing is clipped. Adding a language
 * with a longer endonym fails here rather than on the deployed site.
 */
const LOCALES = ['', 'zh-CN/', 'ja/', 'de/', 'es/', 'ko/', 'pt/'];

test.describe('language menu', () => {
  for (const locale of LOCALES) {
    const label = locale || 'en';

    test(`${label}: shows its own language whole, in the trigger and in the list`, async ({ page }) => {
      await page.goto(`/${locale}`);
      const select = page.locator('r-select.lang-select').first();
      await expect(select).toBeVisible();

      const trigger = await select.evaluate((element) => {
        // The component keeps its chrome in a shadow root and exports parts;
        // the selection item is the one that carries the current label.
        const root =
          (element as unknown as { shadowRoot?: ShadowRoot; _shadowDom?: ShadowRoot }).shadowRoot ??
          (element as unknown as { _shadowDom?: ShadowRoot })._shadowDom;
        const item = root?.querySelector('[part="selection-item"]');
        return item ? { text: item.textContent?.trim() ?? '', clipped: item.scrollWidth > item.clientWidth + 1 } : null;
      });
      expect(trigger, 'no selection item in the trigger').not.toBeNull();
      expect(trigger!.text.length, 'trigger has no label').toBeGreaterThan(0);
      expect(trigger!.clipped, `trigger clips "${trigger!.text}"`).toBe(false);

      await select.click();
      const options = await page.evaluate(() => {
        const cut = (el: Element | null | undefined) => !!el && el.scrollWidth > el.clientWidth + 1;
        return [...document.querySelectorAll('r-dropdown-item')].map((item) => {
          const root =
            (item as unknown as { shadowRoot?: ShadowRoot; _shadowDom?: ShadowRoot }).shadowRoot ??
            (item as unknown as { _shadowDom?: ShadowRoot })._shadowDom;
          return { text: item.textContent?.trim() ?? '', clipped: cut(root?.querySelector('[part="content"]')) };
        });
      });

      // Every translation the site has must be offered, and readable.
      expect(options.length, 'the menu lists fewer languages than the site has').toBe(LOCALES.length);
      for (const option of options) {
        expect(option.clipped, `menu clips "${option.text}" on /${locale}`).toBe(false);
      }
    });
  }

  test('a satellite page offers the same menu as the homepage', async ({ page }) => {
    await page.goto('/pt/open/docx');
    const select = page.locator('r-select.lang-select').first();
    await select.click();
    const options = await page.evaluate(() =>
      [...document.querySelectorAll('r-dropdown-item')].map((item) => item.getAttribute('value')),
    );
    expect(options).toEqual(['en', 'zh-CN', 'ja', 'de', 'es', 'ko', 'pt']);
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
