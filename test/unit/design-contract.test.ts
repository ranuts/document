import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The two things that decide whether a site reads as one site: how wide its
 * content is, and whether every page carries the same chrome.
 *
 * Both are cheap to break one page at a time -- a new page picks a width that
 * looks right on its own, or ships without the header because it was built as
 * a standalone thing. Neither is visible until the pages are seen side by side,
 * which is why they are pinned here rather than left to review.
 *
 * The reference is docs/design-system.md; `node bin/design-audit.mjs` prints
 * the rendered numbers.
 */
const ROOT = resolve(__dirname, '../..');
const PUBLIC = resolve(ROOT, 'public');

const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8');

/** First declaration of a property inside a rule, e.g. `.wrap { max-width: X }`. */
function declaration(css: string, selector: string, property: string): string | undefined {
  const rule = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(css);
  return rule ? new RegExp(`${property}:\\s*([^;]+);`).exec(rule[1])?.[1].trim() : undefined;
}

describe('page width scale', () => {
  const home = read('public/home.css');
  const landing = read('public/landing.css');
  const history = read('styles/history.css');

  it('has exactly two widths, and every page that declares one uses them', () => {
    const wide = declaration(home, '#landing-hero', '--maxw');
    const prose = declaration(landing, '.wrap', 'max-width');
    expect(wide, 'wide column').toBe('1152px');
    expect(prose, 'prose column').toBe('720px');
    // Width follows the layout, not the page type: /history is a list people
    // read down looking for one document, not a table anyone compares across,
    // so it takes the reading column. Measured at 1152 it was mostly air.
    expect(declaration(history, '.history-page', 'max-width'), 'history column').toBe(prose);
  });

  it('gives the article column a rail instead of widening it', () => {
    // The wide viewport problem is not "the text is too narrow" -- 720px with
    // 56px gutters puts the measure at 66 characters, dead centre of the band.
    // It is that the page was a single column with nothing beside it. The frame
    // below is 1152 (the site's wide width), the reading column is 660 so the
    // measure lands at ~72, and the rail takes the rest. Widening the column to
    // fill the frame would push the measure to 77.
    const frame = /\.page \{([^}]*)\}/.exec(landing)?.[1] ?? '';
    expect(frame).toMatch(/max-width:\s*1152px/);
    const columns = /grid-template-columns:\s*([^;]+);/.exec(frame)?.[1] ?? '';
    const reading = /minmax\(0,\s*(\d+)px\)/.exec(columns);
    expect(Number(reading?.[1]), 'reading column').toBeLessThanOrEqual(680);
    expect(Number(reading?.[1]), 'reading column').toBeGreaterThanOrEqual(600);
  });

  it('bounds prose by characters, not by whatever the container happens to be', () => {
    const intro = declaration(history, '.history-intro', 'max-width');
    expect(intro).toMatch(/^\d{2}ch$/);
    expect(Number.parseInt(intro!, 10)).toBeLessThanOrEqual(72);
  });

  it('agrees on body line-height across the stylesheets that set it', () => {
    expect(declaration(landing, 'body', 'line-height')).toBe('1.65');
    expect(declaration(home, '#landing-hero', 'line-height')).toBe('1.65');
  });
});

describe('page chrome', () => {
  /** Every user-facing HTML page, wherever it is served from. */
  function pages(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) {
        if (['sdkjs', 'web-apps', 'ranui-iife', 'ran-fonts', 'fonts', 'img', 'wasm'].includes(name)) continue;
        pages(path, out);
      } else if (name.endsWith('.html')) {
        out.push(path);
      }
    }
    return out;
  }

  const all = [...pages(PUBLIC), resolve(ROOT, 'index.html'), resolve(ROOT, 'history.html')];

  it('finds the pages (sanity)', () => {
    expect(all.length).toBeGreaterThan(15);
  });

  it.each(all.map((f) => [relative(ROOT, f), f]))('%s carries the site header', (_label, file) => {
    const html = readFileSync(file, 'utf8');
    // The homepage builds its own bar inside #landing-hero; everything else
    // uses the shared one from landing.css. A page with neither is a page a
    // visitor arrives at and cannot tell is still this site.
    const hasSharedBar = /<header class="bar">/.test(html);
    const hasHeroBar = /id="landing-hero"/.test(html) && /class="bar"/.test(html);
    expect(hasSharedBar || hasHeroBar).toBe(true);
  });

  it('styles that header from a shared stylesheet, never from the page itself', () => {
    // Two stylesheets carry the bar: home.css for the homepages, landing.css
    // for everything else. A page that draws its own would be a fourth copy of
    // the same measurements, drifting on its own schedule.
    for (const file of all) {
      const html = readFileSync(file, 'utf8');
      if (!/class="bar"/.test(html)) continue;
      const shared = /landing\.css/.test(html) || /home\.css/.test(html);
      expect(shared, `${relative(ROOT, file)} links home.css or landing.css`).toBe(true);
    }
  });
});
