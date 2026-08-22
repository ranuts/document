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
 *   pnpm run preview          # or any server for the built site
 *   node bin/design-audit.mjs [baseUrl]
 *
 * The reference scale is in docs/design-system.md. Nothing here fails a build:
 * a number outside the range may be right for that page, and the audit exists
 * to make the choice deliberate, not to forbid it.
 */
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://localhost:4173';

const PAGES = [
  ['/', 'home EN'],
  ['/zh-CN/', 'home ZH'],
  ['/help', 'help'],
  ['/changelog', 'changelog'],
  ['/private-document-editor', 'landing (satellite)'],
  ['/open/docx', 'open/<format>'],
  ['/convert/docx-to-pdf', 'convert/<pair>'],
  ['/history', 'history'],
  ['/404.html', '404'],
  ['/embed-demo.html', 'embed-demo'],
];

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

  let chars = null;
  if (para) {
    const probeEl = document.createElement('span');
    probeEl.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${cs(para).font}`;
    probeEl.textContent = 'abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    document.body.appendChild(probeEl);
    const avg = probeEl.getBoundingClientRect().width / probeEl.textContent.length;
    probeEl.remove();
    chars = Math.round(para.getBoundingClientRect().width / avg);
  }

  const h1 = document.querySelector('h1, .history-title');
  const bar = document.querySelector('header.bar');
  return {
    container: Math.round(container.getBoundingClientRect().width),
    chars,
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
  ['page', 22],
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
    console.log(label.padEnd(22) + '(unreachable)');
    continue;
  }
  const cells = [label, `${m.container}px`, m.chars ?? '-', m.body, m.lh, m.h1, m.bar, m.footer];
  console.log(cells.map((c, i) => String(c).padEnd(COLS[i][1])).join(''));
}

await browser.close();
