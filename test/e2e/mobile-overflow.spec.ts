import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from './lib/l0';

/**
 * No content page may scroll sideways on a phone.
 *
 * A run of text with no break opportunity that is wider than the column does
 * not overflow its own box -- it widens the page under it, which reads as a
 * horizontal scrollbar on what is otherwise a column of prose. It is invisible
 * on a desktop viewport and invisible in the markup: the copy is correct, the
 * layout is correct, and the browser is doing what it was told.
 *
 * Found on three Korean pages, whose lead paragraph ran
 * "Word(DOCX)·Excel(XLSX)·PowerPoint(PPTX)·CSV" -- Korean text breaks between
 * any two characters, so nothing else on those pages had ever needed a break
 * opportunity, and that Latin run has none. 23 px of sideways scroll at 390 px
 * wide. Both halves are fixed: the copy uses the separator the rest of the
 * Korean pages use, and landing.css/home.css let an unbreakable run break
 * rather than push the page.
 *
 * Every page in the sitemap is checked, because the next one will be in a
 * language nobody here reads either.
 */
const SITEMAP = resolve(dirname(fileURLToPath(import.meta.url)), '../../public/sitemap.xml');
/** Every route the site publishes, as a path: '/', '/ko/help', ... */
const ROUTES = [...readFileSync(SITEMAP, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map((m) => new URL(m[1]).pathname)
  .sort();

test.describe('no page scrolls sideways on a phone', () => {
  test.describe.configure({ timeout: 180_000 });
  test.use({ viewport: { width: 390, height: 844 } });

  test('every published page fits a 390 px viewport', async ({ page }) => {
    expect(ROUTES.length, 'sitemap should list the whole site').toBeGreaterThan(50);

    const wide: string[] = [];
    for (const route of ROUTES) {
      await page.goto(route);
      // Web fonts change how much a run measures, so wait for them: the
      // fallback face can fit where the real one does not.
      await page.evaluate(() => document.fonts.ready);
      const over = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      // 1 px of slack for subpixel rounding at fractional device ratios.
      if (over > 1) wide.push(`${route} (+${over}px)`);
    }
    expect(wide, 'pages wider than the viewport').toEqual([]);
  });
});
