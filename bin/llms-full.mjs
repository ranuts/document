#!/usr/bin/env node
/**
 * llms.txt's companion: the full text of every landing page in one file.
 *
 * llms.txt is an index -- it tells an assistant what exists and where. Acting on
 * it still means fetching thirty pages. llms-full.txt is the other half of that
 * convention: the actual prose, already stripped of chrome, so a model can take
 * the whole site in one request and answer from it instead of guessing.
 *
 * Generated at build/dev time from the pages themselves rather than committed,
 * for the same reason the markdown-sourced pages are (see bin/build-pages.mjs):
 * a committed copy is a copy that can go stale, and a stale one here is worse
 * than none -- it is wrong text presented as authoritative. The output is
 * gitignored and produced by the `generated-pages` vite plugin.
 *
 *   node bin/llms-full.mjs           # write public/llms-full.txt
 *   node bin/llms-full.mjs --check   # exit 1 if the output would change
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = resolve(ROOT, 'public');
const ORIGIN = 'https://edit.chaxus.com';
const OUT = resolve(PUBLIC, 'llms-full.txt');

/** Not landing pages: the vendored editor trees, the demo, the error page. */
const SKIP_DIRS = new Set(['web-apps', 'sdkjs', 'fonts', 'img', 'ranui-iife', 'ran-fonts', 'libs', 'open-local']);
const SKIP_FILES = new Set(['404.html', 'embed-demo.html']);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (!SKIP_DIRS.has(name)) out.push(...walk(p));
    } else if (name.endsWith('.html') && !SKIP_FILES.has(name)) {
      out.push(p);
    }
  }
  return out;
}

const routeOf = (file) => {
  const rel = '/' + relative(PUBLIC, file).replace(/\\/g, '/');
  return rel.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
};

const decode = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rarr;/g, '→')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ');

/**
 * The page as prose. Headings keep their level so the structure survives, list
 * items keep their bullet, and everything else collapses to a paragraph -- which
 * is all a model needs and a fraction of the bytes the markup would cost.
 */
function extract(html) {
  let s = html;
  s = s.replace(/<script[\s\S]*?<\/script>/g, '');
  s = s.replace(/<style[\s\S]*?<\/style>/g, '');
  s = s.replace(/<svg[\s\S]*?<\/svg>/g, '');
  const body = /<main\b[^>]*>([\s\S]*?)<\/main>/.exec(s);
  s = body ? body[1] : s;
  s = s.replace(/<footer[\s\S]*?<\/footer>/g, '');
  s = s.replace(/<nav\b[\s\S]*?<\/nav>/g, '');

  const out = [];
  const re = /<(h1|h2|h3|p|li)\b[^>]*>([\s\S]*?)<\/\1>/g;
  let m;
  while ((m = re.exec(s))) {
    const tag = m[1];
    const text = decode(m[2].replace(/<[^>]+>/g, ''))
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) continue;
    if (tag === 'h1') out.push(`\n# ${text}`);
    else if (tag === 'h2') out.push(`\n## ${text}`);
    else if (tag === 'h3') out.push(`\n### ${text}`);
    else if (tag === 'li') out.push(`- ${text}`);
    else out.push(text);
  }
  return out.join('\n');
}

const meta = (html, re) => {
  const m = re.exec(html);
  return m ? decode(m[1]).trim() : '';
};

export function render() {
  const files = walk(PUBLIC).sort((a, b) => routeOf(a).localeCompare(routeOf(b)));
  const index = existsSync(resolve(PUBLIC, 'llms.txt')) ? readFileSync(resolve(PUBLIC, 'llms.txt'), 'utf8') : '';

  const parts = [
    '# Online Document Editor - full text',
    '',
    '> Every page of https://edit.chaxus.com in one file, chrome stripped. This is the',
    '> companion to /llms.txt, which indexes the same pages. Generated at build time',
    '> from the pages themselves, so it cannot drift from what the site actually says.',
    '',
    'The summary, capabilities, limitations and link index from /llms.txt are',
    'reproduced first, followed by the full text of each page.',
    '',
    '---',
    '',
    index.trim(),
    '',
    '---',
    '',
    '# Pages',
  ];

  for (const file of files) {
    const html = readFileSync(file, 'utf8');
    const route = routeOf(file);
    const title = meta(html, /<title>([\s\S]*?)<\/title>/);
    const description = meta(html, /<meta\s+name="description"\s+content="([^"]*)"/);
    const text = extract(html);
    if (!text) continue;
    parts.push('', `## ${ORIGIN}${route}`, '', `Title: ${title}`);
    if (description) parts.push(`Description: ${description}`);
    parts.push(text);
  }

  return parts.join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
}

export function generate({ check = false } = {}) {
  const next = render();
  const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : null;
  if (check) return current === next;
  if (current !== next) writeFileSync(OUT, next);
  return true;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const ok = generate({ check });
  if (check && !ok) {
    console.error('[llms-full] public/llms-full.txt is stale; run node bin/llms-full.mjs');
    process.exit(1);
  }
  if (!check) console.log(`[llms-full] wrote ${relative(ROOT, OUT)} (${render().length} bytes)`);
}
