#!/usr/bin/env node
/**
 * Read-only design audit: renders every page and prints the values that decide
 * whether a site looks like one site -- container width, reading measure, type
 * scale, chrome.
 *
 * The point is that consistency is checkable rather than remembered. Drift
 * arrives one page at a time, each one defensible on its own, and it is only
 * visible side by side. Run it after adding a page or touching a stylesheet:
 *
 *   pnpm run preview                    # or any server for the built site
 *   node bin/design-audit.mjs [baseUrl]
 *   node bin/design-audit.mjs [baseUrl] --all   # every page in every language
 *
 * The reference scale is in docs/design-system.md. Nothing here fails a build:
 * a number outside the range may be right for that page, and the audit exists
 * to make the choice deliberate, not to forbid it.
 */
import { chromium } from '@playwright/test';
import { LOCALES } from './build-pages.mjs';

const base = process.argv[2] ?? 'http://localhost:4173';
/** `--all` measures every locale; by default only English, which is the scale. */
const allLocales = process.argv.includes('--all');

/**
 * One row per page shape, in English -- the scale the design system is written
 * against. With --all, each shape is measured in every language the site ships:
 * a measure that is 66 characters in English can be something else entirely in
 * German (long compounds) or Japanese (no spaces, wider glyphs), and until this
 * existed nobody was looking.
 */
const SHAPES = [
  ['/', 'home'],
  ['/help', 'help'],
  ['/changelog', 'changelog'],
  ['/private-document-editor', 'landing (satellite)'],
  ['/open/docx', 'open/<format>'],
  ['/convert/docx-to-pdf', 'convert/<pair>'],
];
const UNTRANSLATED = [
  ['/history', 'history'],
  ['/404.html', '404'],
  ['/embed-demo.html', 'embed-demo'],
];

const localePath = (locale, path) => (locale === 'en' ? path : `${LOCALES[locale].prefix}${path === '/' ? '/' : path}`);
const PAGES = allLocales
  ? [
      ...Object.keys(LOCALES).flatMap((locale) =>
        SHAPES.map(([path, label]) => [localePath(locale, path), `${label} [${locale}]`]),
      ),
      ...UNTRANSLATED,
    ]
  : [...SHAPES, ...UNTRANSLATED];

/** Everything measured inside the page, in one pass. */
function probe() {
  const cs = (el) => (el ? getComputedStyle(el) : null);
  const px = (v) => (v && v !== 'normal' ? Math.round(parseFloat(v) * 10) / 10 : null);
  const container =
    document.querySelector('#landing-hero .wrap') ||
    document.querySelector('main.wrap') ||
    document.querySelector('.wrap') ||
    document.querySelector('.history-page') ||
    document.querySelector('main') ||
    document.body;

  // The longest visible paragraph stands in for the reading measure.
  const para = [...document.querySelectorAll('p, .history-intro, .sub')]
    .filter((p) => (p.textContent || '').trim().length > 80 && p.offsetParent)
    .sort((a, b) => (b.textContent || '').length - (a.textContent || '').length)[0];

  // Measure with the script the page is actually set in. A Latin probe on a
  // Japanese page just restates the container width in Latin units, which is
  // how the audit read the same 72 for all seven languages while the CJK pages
  // were really running ~33 characters. The bands differ too: 45-75 for Latin,
  // 30-40 for CJK (JLReq / CLReq).
  const script = /^(zh|ja|ko)/.test(document.documentElement.lang || 'en') ? 'cjk' : 'latin';
  const PROBE = {
    latin: 'abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    cjk: '\u6587\u5b57\u6392\u7248\u884c\u9577\u6e2c\u5b9a\u7528\u4f8b\u6a19\u672c\u6c49\u5b57\u5bbd\u5ea6',
  }[script];
  let chars = null;
  if (para) {
    const probeEl = document.createElement('span');
    probeEl.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${cs(para).font}`;
    probeEl.textContent = PROBE;
    document.body.appendChild(probeEl);
    const avg = probeEl.getBoundingClientRect().width / PROBE.length;
    probeEl.remove();
    chars = Math.round(para.getBoundingClientRect().width / avg);
  }

  const h1 = document.querySelector('h1, .history-title');
  const bar = document.querySelector('header.bar');
  return {
    container: Math.round(container.getBoundingClientRect().width),
    chars: chars === null ? null : `${chars}${script === 'cjk' ? ' cjk' : ''}`,
    body: px(cs(document.body).fontSize),
    lh: px(cs(document.body).lineHeight),
    h1: h1 ? `${px(cs(h1).fontSize)}/${cs(h1).fontWeight}` : '-',
    bar: bar ? Math.round(bar.getBoundingClientRect().height) : 'none',
    footer: document.querySelector('footer') ? 'yes' : 'no',
  };
}

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();

const COLS = [
  ['page', 26],
  ['container', 11],
  ['chars/line', 12],
  ['body', 6],
  ['lh', 6],
  ['h1', 10],
  ['bar', 6],
  ['footer', 7],
];
console.log(COLS.map(([name, w]) => name.padEnd(w)).join(''));
console.log('-'.repeat(COLS.reduce((n, [, w]) => n + w, 0)));

for (const [url, label] of PAGES) {
  let m;
  try {
    await page.goto(base + url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(250);
    m = await page.evaluate(probe);
  } catch {
    console.log(label.padEnd(26) + '(unreachable)');
    continue;
  }
  const cells = [label, `${m.container}px`, m.chars ?? '-', m.body, m.lh, m.h1, m.bar, m.footer];
  console.log(cells.map((c, i) => String(c).padEnd(COLS[i][1])).join(''));
}

await browser.close();
