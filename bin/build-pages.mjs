#!/usr/bin/env node
/**
 * Markdown -> static HTML pages on the landing-page shell.
 *
 * This file is the assembly: it walks PAGES, renders each source through the
 * right template, and writes (or checks) the result. Everything it assembles
 * lives in bin/pages/ --
 *
 *   constants.mjs    origin, repo, site name, ROOT
 *   locales.mjs      the languages the site ships, and the menu order
 *   ui.mjs           per-locale chrome strings
 *   pages.mjs        the page inventory: slugs and their markdown sources
 *   entities.mjs     the JSON-LD entity graph
 *   markdown.mjs     frontmatter, the renderer, the extractors
 *   chrome.mjs       language switcher, GitHub mark, route helper
 *   render-home.mjs  the homepage template
 *   render-page.mjs  the template for everything else
 *
 * Model: PAGES is a list of { slug, sources: { <locale>: <md file> } }. Every
 * locale renders to public/<localePrefix><slug>.html; the shell links all
 * locales of the same slug to each other (hreflang + language switcher).
 * Adding a locale to LOCALES is enough for the shell; content is per file.
 *
 * The public surface is re-exported below, so vite.config.ts, the bin scripts
 * and the tests import from this path exactly as before.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT } from './pages/constants.mjs';
import { DEFAULT_LOCALE, LOCALES } from './pages/locales.mjs';
import { PAGES } from './pages/pages.mjs';
import { extractFaq, extractSteps, parseFrontmatter, renderMarkdown, wrapFaqSection } from './pages/markdown.mjs';
import { routeFor } from './pages/chrome.mjs';
import { renderHome } from './pages/render-home.mjs';
import { renderPage } from './pages/render-page.mjs';

export { LOCALES, MENU_ORDER } from './pages/locales.mjs';
export { LANDING_SLUGS, PAGES } from './pages/pages.mjs';

function pathFor(output, dir) {
  return output.rel === 'index.html' ? resolve(ROOT, 'index.html') : resolve(dir, output.rel);
}

export function generate({ outDir = resolve(ROOT, 'public') } = {}) {
  const outputs = [];
  // The homepages first: they are the one page whose source is data rather
  // than prose, and every other page's language switch links back to them.
  const homeLocales = Object.keys(LOCALES).filter((locale) => existsSync(resolve(ROOT, `content/${locale}/home.json`)));
  for (const locale of homeLocales) {
    const src = `content/${locale}/home.json`;
    const data = JSON.parse(readFileSync(resolve(ROOT, src), 'utf8'));
    const html = renderHome({ locale, data, locales: homeLocales });
    // The default locale's homepage is the site root, index.html at the top of
    // the repo rather than under public/ (it is a Vite entry).
    const rel = locale === DEFAULT_LOCALE ? 'index.html' : `${LOCALES[locale].prefix}/index.html`.replace(/^\//, '');
    outputs.push({ rel, route: LOCALES[locale].home, html, source: src, locale, kind: 'home' });
  }
  for (const page of PAGES) {
    for (const locale of Object.keys(LOCALES)) {
      const src = page.sources[locale];
      if (!src) continue;
      const raw = readFileSync(resolve(ROOT, src), 'utf8');
      const { data, body: mdBody } = parseFrontmatter(raw);
      const meta = { ...data, ...page.meta?.[locale] };
      if (!meta.title || !meta.description) {
        throw new Error(`${src}: missing title/description (frontmatter or PAGES.meta.${locale})`);
      }
      const { html, headings } = renderMarkdown(mdBody, { stripFirstHeading: page.stripFirstHeading });
      const faq = extractFaq(html);
      const steps = extractSteps(html);
      const body = page.kind === 'landing' ? wrapFaqSection(html) : html;
      const out = renderPage({ page, locale, meta, body, headings, faq, steps, source: src });
      const rel = `${LOCALES[locale].prefix}/${page.slug}.html`.replace(/^\//, '');
      outputs.push({
        rel,
        route: routeFor(locale, page.slug),
        html: out,
        source: src,
        locale,
        kind: page.kind ?? 'doc',
      });
    }
  }
  if (outDir) {
    for (const o of outputs) {
      const target = pathFor(o, outDir);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, o.html);
    }
  }
  return outputs;
}

/**
 * The outputs that stay in the repo. Only the default locale's homepage: it is
 * index.html at the repo root, a Vite build entry, and a build must not depend
 * on a plugin having written its inputs first. Every other page -- including
 * the other locales' homepages -- is generated into a gitignored path, so
 * there is nothing to go stale and nothing to check.
 */
const COMMITTED = new Set(['index.html']);

/** The committed outputs a fresh render would change (empty when all current). */
export function check({ publicDir = resolve(ROOT, 'public') } = {}) {
  const stale = [];
  for (const o of generate({ outDir: null })) {
    if (!COMMITTED.has(o.rel)) continue;
    const target = pathFor(o, publicDir);
    if (!existsSync(target) || readFileSync(target, 'utf8') !== o.html) stale.push(o.rel);
  }
  return stale;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  if (args.includes('--check')) {
    const stale = check();
    if (stale.length) {
      console.error(`Generated pages out of date: ${stale.join(', ')}\nRun: node bin/build-pages.mjs`);
      process.exit(1);
    }
    console.log('Generated pages are up to date.');
  } else {
    const i = args.indexOf('--out');
    const outDir = i >= 0 ? resolve(process.cwd(), args[i + 1]) : resolve(ROOT, 'public');
    const outputs = generate({ outDir });
    for (const o of outputs) console.log(`  ${o.route}  <-  ${o.source}`);
    console.log(`Generated ${outputs.length} pages -> ${outDir}`);
  }
}
