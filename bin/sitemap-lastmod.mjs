#!/usr/bin/env node
/**
 * Refresh <lastmod> in public/sitemap.xml from git: each URL's date becomes the
 * last commit that touched its source (index.html for /, the static HTML under
 * public/, or the markdown sources of a generated page). Run after a content
 * change and commit the result; search engines use lastmod to decide what to
 * recrawl, and a stale value tells them nothing changed.
 *
 *   node bin/sitemap-lastmod.mjs          # rewrite public/sitemap.xml
 *   node bin/sitemap-lastmod.mjs --check  # exit 1 if any lastmod would change
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCALES, PAGES } from './build-pages.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://edit.chaxus.com';
const SITEMAP = resolve(ROOT, 'public/sitemap.xml');

/**
 * The generator, for dating a page whose output is not committed: the entry
 * point plus every slice of it.
 *
 * `bin/pages/` matters as much as the entry does -- the templates live there.
 * Naming only the entry (which is all there was before the generator was split
 * up) would mean a template change no longer dated the pages it renders, and
 * nothing would have said so: the check would simply stop reporting them.
 */
const GENERATOR = ['bin/build-pages.mjs', 'bin/pages'];

/** Source files whose history dates a route. */
function sourcesFor(route) {
  for (const page of PAGES) {
    for (const [locale, src] of Object.entries(page.sources)) {
      if (`${LOCALES[locale].prefix}/${page.slug}` === route) return [src, ...GENERATOR];
    }
  }
  if (route === '/') return ['index.html'];
  if (route.endsWith('/')) return [`public${route}index.html`];
  return [`public${route}.html`];
}

function lastCommitDate(files) {
  const existing = files.filter((f) => existsSync(resolve(ROOT, f)));
  if (!existing.length) return null;
  const out = execFileSync('git', ['log', '-1', '--format=%cs', '--', ...existing], { cwd: ROOT, encoding: 'utf8' });
  return out.trim() || null;
}

const xml = readFileSync(SITEMAP, 'utf8');
let changed = 0;
const next = xml.replace(/<loc>([^<]+)<\/loc>(\s*)<lastmod>([^<]+)<\/lastmod>/g, (whole, loc, ws, current) => {
  const route = loc.startsWith(ORIGIN) ? loc.slice(ORIGIN.length) : loc;
  const date = lastCommitDate(sourcesFor(route));
  if (!date || date === current) return whole;
  changed++;
  console.log(`  ${route}  ${current} -> ${date}`);
  return `<loc>${loc}</loc>${ws}<lastmod>${date}</lastmod>`;
});

if (process.argv.includes('--check')) {
  if (changed) {
    console.error(`${changed} sitemap lastmod value(s) are stale. Run: node bin/sitemap-lastmod.mjs`);
    process.exit(1);
  }
  console.log('sitemap lastmod values are current.');
} else {
  writeFileSync(SITEMAP, next);
  console.log(changed ? `Updated ${changed} lastmod value(s).` : 'No lastmod changes.');
}
