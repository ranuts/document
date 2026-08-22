import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LOCALES, generate } from '../../bin/build-pages.mjs';

/**
 * SEO landing-page contract. The static pages under public/ (and their
 * /zh-CN/ mirrors) are hand-written HTML, so nothing else catches a page
 * that ships with a canonical pointing at its sibling, an hreflang whose
 * target does not exist, JSON-LD that does not parse, or a page missing
 * from the sitemap. Every page must satisfy the same shell contract; the
 * pairs must point at each other; the sitemap must list exactly the pages.
 */
const ROOT = resolve(__dirname, '../..');
const PUBLIC = resolve(ROOT, 'public');
const ORIGIN = 'https://edit.chaxus.com';
const NOT_LANDING = new Set(['404.html', 'embed-demo.html']);
// Pages rendered from markdown at build time (not committed under public/):
// the same contract applies, so they are validated from a fresh in-memory render.
const GENERATED = generate({ outDir: null }) as Array<{ rel: string; route: string; html: string }>;
const isGeneratedFile = (file: string) => GENERATED.some((g) => resolve(PUBLIC, g.rel) === file);

function walkHtml(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (['sdkjs', 'web-apps', 'ranui-iife', 'ran-fonts', 'fonts', 'img', 'wasm'].includes(name)) continue;
      out.push(...walkHtml(p));
    } else if (name.endsWith('.html') && !NOT_LANDING.has(name) && !isGeneratedFile(p)) {
      out.push(p);
    }
  }
  return out;
}

/** /public/zh-CN/open/pdf.html -> /zh-CN/open/pdf ; /public/zh-CN/index.html -> /zh-CN/ */
const routeOf = (file: string) => {
  const rel = '/' + relative(PUBLIC, file).replace(/\\/g, '/');
  return rel.endsWith('/index.html') ? rel.slice(0, -'index.html'.length) : rel.replace(/\.html$/, '');
};

/** Every landing page: hand-written files under public/ plus the generated ones (in memory). */
const pages: Array<{ route: string; html: string; label: string }> = [
  ...walkHtml(PUBLIC)
    .sort()
    .map((file) => ({ route: routeOf(file), html: readFileSync(file, 'utf8'), label: relative(ROOT, file) })),
  ...GENERATED.map((g) => ({ route: g.route, html: g.html, label: `${g.rel} (generated)` })),
];
const routes = new Set(pages.map((p) => p.route));
/** '/ja/open/pdf' -> 'ja'; '/open/pdf' -> 'en'. */
const localeOf = (route: string) =>
  Object.keys(LOCALES).find((l) => LOCALES[l].prefix && route.startsWith(`${LOCALES[l].prefix}/`)) ?? 'en';
/** '/ja/open/pdf' -> '/open/pdf' (the route without any locale prefix). */
const slugRoute = (route: string) => {
  const prefix = LOCALES[localeOf(route)].prefix;
  return prefix ? route.slice(prefix.length) || '/' : route;
};
/** ('ja', '/open/pdf') -> '/ja/open/pdf'; ('ja', '/') -> '/ja/'. */
const routeIn = (locale: string, slug: string) =>
  slug === '/' ? LOCALES[locale].home : `${LOCALES[locale].prefix}${slug}`;
// The English homepage lives at the repo root (Vite entry), not under public/.
const homepage = resolve(ROOT, 'index.html');
const attr = (html: string, re: RegExp) => html.match(re)?.[1] ?? null;

describe('landing pages', () => {
  it('finds the landing set (sanity)', () => {
    expect(pages.length).toBeGreaterThan(10);
    expect(routes.has('/open/pdf')).toBe(true);
    expect(routes.has('/zh-CN/open/pdf')).toBe(true);
    expect(routes.has('/help')).toBe(true);
    expect(routes.has('/zh-CN/changelog')).toBe(true);
  });

  for (const { route, html } of pages) {
    const locale = localeOf(route);
    const enRoute = slugRoute(route);

    describe(route, () => {
      /**
       * Every translation of a page has to point at every other translation
       * and at itself, and each of those targets has to exist. Checking the
       * set rather than two fixed languages is what lets a locale be added
       * without editing this file -- and what catches a page that ships in a
       * new language while its alternates still say there are only two.
       */
      it('has canonical = its own URL and a full hreflang set', () => {
        expect(attr(html, /<link rel="canonical" href="([^"]+)"/)).toBe(ORIGIN + route);
        expect(attr(html, /<html lang="([^"]+)"/)).toBe(LOCALES[locale].lang);
        expect(attr(html, /hreflang="x-default" href="([^"]+)"/)).toBe(ORIGIN + enRoute);

        const alternates = [...html.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)]
          .filter(([, lang]) => lang !== 'x-default')
          .map(([, lang, href]) => [lang, href] as const);
        expect(
          alternates.map(([lang]) => lang),
          'lists itself',
        ).toContain(locale);
        for (const [lang, href] of alternates) {
          expect(href, `hreflang ${lang}`).toBe(ORIGIN + routeIn(lang, enRoute));
          expect(routes.has(routeIn(lang, enRoute)), `${href} does not exist`).toBe(true);
        }
        // Every locale that has this page must be listed, not just some.
        for (const other of Object.keys(LOCALES)) {
          if (!routes.has(routeIn(other, enRoute))) continue;
          expect(
            alternates.map(([lang]) => lang),
            `missing ${other}`,
          ).toContain(other);
        }
      });

      it('has a title, description, og:url matching canonical', () => {
        expect(attr(html, /<title>([^<]+)<\/title>/)?.length).toBeGreaterThan(10);
        expect(attr(html, /name="description"\s+content="([^"]+)"/)?.length).toBeGreaterThan(40);
        expect(attr(html, /property="og:url" content="([^"]+)"/)).toBe(ORIGIN + route);
      });

      it('ships parseable JSON-LD whose primary node url is the page', () => {
        const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
        expect(blocks.length).toBeGreaterThan(0);
        const graph = blocks.flatMap((m) => {
          const doc = JSON.parse(m[1]);
          return doc['@graph'] ?? [doc];
        });
        const app = graph.find((n: any) => ['WebApplication', 'WebPage', 'Article'].includes(n['@type']));
        expect(app?.url).toBe(ORIGIN + route);
        for (const faq of graph.filter((n: any) => n['@type'] === 'FAQPage')) {
          expect(faq.mainEntity.length).toBeGreaterThan(2);
        }
      });

      it('offers every translation it has in the language switch', () => {
        for (const other of Object.keys(LOCALES)) {
          const target = routeIn(other, enRoute);
          if (!routes.has(target)) continue;
          expect(html, `${route} does not offer ${other}`).toContain(`data-href="${target}"`);
        }
      });

      it('lives in the sitemap', () => {
        expect(readFileSync(resolve(PUBLIC, 'sitemap.xml'), 'utf8')).toContain(`<loc>${ORIGIN + route}</loc>`);
      });

      /**
       * The sidebar rail is what a wide viewport gets instead of a wider
       * reading column: a call to action that survives the first screen, the
       * page's own sections, and the sibling pages. A page shipped without it
       * looks fine on its own and only reveals itself next to the others --
       * which is exactly the drift this file exists to catch.
       */
      it('carries the sidebar rail: a call to action and its own sections', () => {
        // Article pages only: the two homepages build their own layout.
        if (!html.includes('<main class="wrap')) return;
        expect(html, 'no <aside class="side">').toContain('<aside class="side"');
        expect(html).toContain('side-cta');
        const anchors = [...html.matchAll(/<nav class="side-block">[\s\S]*?<\/nav>/g)]
          .join('')
          .matchAll(/href="#([^"]+)"/g);
        const linked = [...anchors].map((m) => m[1]);
        const ids = [...html.matchAll(/<h2[^>]*\sid="([^"]+)"/g)].map((m) => m[1]);
        // Every link in the rail has to land somewhere on this page, and every
        // section this page has must be reachable from it.
        for (const id of linked) expect(ids, `#${id} has no h2`).toContain(id);
        if (ids.length >= 3) expect(linked.length, 'sections missing from the rail').toBe(ids.length);
      });
    });
  }

  it('sitemap lists only routes that exist as pages', () => {
    const locs = [...readFileSync(resolve(PUBLIC, 'sitemap.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
      m[1].slice(ORIGIN.length),
    );
    const known = new Set([...routes, '/']);
    for (const l of locs) expect(known.has(l), `sitemap entry ${l} has no page`).toBe(true);
    // No en page missing from the sitemap either (all pages checked above).
    expect(new Set(locs).size).toBe(locs.length);
  });

  it('every /open/* format page is cross-linked from both homepages and llms.txt', () => {
    const en = readFileSync(homepage, 'utf8');
    const zh = readFileSync(resolve(PUBLIC, 'zh-CN/index.html'), 'utf8');
    const llms = readFileSync(resolve(PUBLIC, 'llms.txt'), 'utf8');
    for (const fmt of ['docx', 'xlsx', 'pptx', 'pdf', 'odt', 'ods', 'odp']) {
      expect(en).toContain(`href="/open/${fmt}"`);
      expect(zh).toContain(`href="/zh-CN/open/${fmt}"`);
      expect(llms).toContain(`${ORIGIN}/open/${fmt}`);
    }
  });

  it('every /convert/* page is cross-linked from both homepages and llms.txt', () => {
    const en = readFileSync(homepage, 'utf8');
    const zh = readFileSync(resolve(PUBLIC, 'zh-CN/index.html'), 'utf8');
    const llms = readFileSync(resolve(PUBLIC, 'llms.txt'), 'utf8');
    // The homepages link one page per family (the cards would not fit seven of
    // them); the rest are reachable from those pages and from llms.txt.
    for (const conv of ['docx-to-pdf', 'xlsx-to-csv']) {
      expect(en).toContain(`href="/convert/${conv}"`);
      expect(zh).toContain(`href="/zh-CN/convert/${conv}"`);
    }
    for (const conv of ['docx-to-pdf', 'xlsx-to-pdf', 'pptx-to-pdf', 'xlsx-to-csv', 'csv-to-xlsx']) {
      expect(llms).toContain(`${ORIGIN}/convert/${conv}`);
    }
  });

  /**
   * llms.txt exists so an assistant can answer questions about this tool without
   * crawling it. Answering well means knowing where it does NOT fit -- a file it
   * cannot handle, a workflow it does not support -- so the boundaries are part
   * of the contract, not an afterthought.
   */
  it('both homepages answer what happens to unsaved edits, and name the retention window', () => {
    // The single highest-value question this site can answer for a search engine
    // or an assistant ("I closed the tab -- did I lose my work?"), and the one
    // place the seven-day promise has to be machine-readable. Losing it to a
    // copy edit would cost the answer, not just the wording.
    for (const [file, ask, days] of [
      [homepage, /tab|refresh/i, '7 days'],
      [resolve(PUBLIC, 'zh-CN/index.html'), /标签页|刷新/, '7 天'],
    ] as Array<[string, RegExp, string]>) {
      const html = readFileSync(file, 'utf8');
      const faqs = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
        .flatMap((m) => {
          const doc = JSON.parse(m[1]);
          return doc['@graph'] ?? [doc];
        })
        .filter((doc: { '@type': string }) => doc['@type'] === 'FAQPage');
      const questions = faqs.flatMap(
        (faq) => faq.mainEntity as Array<{ name: string; acceptedAnswer: { text: string } }>,
      );
      const answer = questions.find((q) => ask.test(q.name))?.acceptedAnswer.text;
      expect(answer, `${file} has no question about closing the tab`).toBeTruthy();
      expect(answer).toContain(days);
    }
  });

  it('llms.txt states the limitations, not just the features', () => {
    const llms = readFileSync(resolve(PUBLIC, 'llms.txt'), 'utf8');
    expect(llms).toMatch(/^## Limitations/m);
    for (const boundary of [/memory/i, /collaborat/i, /does not\s+rewrite|NOT rewrite/i]) {
      expect(llms, `llms.txt limitations must mention ${boundary}`).toMatch(boundary);
    }
  });

  /**
   * The WebMCP page names the tools it advertises. A tool renamed in
   * lib/web-mcp.ts and not here leaves the page telling agents to call
   * something that no longer exists, which is worse than not listing them.
   */
  it('the WebMCP page lists exactly the tools the adapter registers', async () => {
    const { buildTools } = await import('../../lib/web-mcp');
    const names = buildTools().map((t) => t.name);
    for (const locale of ['', '/zh-CN']) {
      const file = resolve(PUBLIC, `${locale}/webmcp-document-editor.html`.replace(/^\//, ''));
      const html = readFileSync(file, 'utf8');
      for (const name of names) {
        expect(html, `${locale || '/'}webmcp page must mention ${name}`).toContain(name);
      }
    }
    const llms = readFileSync(resolve(PUBLIC, 'llms.txt'), 'utf8');
    for (const name of names) expect(llms, `llms.txt must mention ${name}`).toContain(name);
  });

  it('zh-CN CTAs stay in Chinese; "open your <format>" never lands on a blank new docx', () => {
    const allowed = new Set(['/zh-CN/', '/editor?locale=zh-CN&amp;new=docx', '/embed-demo.html']);
    for (const { route, html } of pages.filter((p) => p.route.startsWith('/zh-CN/') && p.route !== '/zh-CN/')) {
      const m = html.match(/<a class="cta" href="([^"]+)"><r-button[^>]*>([^<]+)</);
      if (!m) continue;
      const [, href, label] = m;
      expect(allowed.has(href), `${route} cta ${href}`).toBe(true);
      if (label.includes('打开你的')) expect(href, route).toBe('/zh-CN/');
    }
  });
});

/**
 * ranui paints the button's raised shadow on the HOST element, but exports the
 * radius on the parts inside its shadow DOM and sets none on the host itself.
 * A stylesheet that rounds the parts and forgets the host therefore ships a
 * pill wrapped in a rectangular shadow -- a straight line under the button,
 * poking out past both rounded ends. It went unnoticed at ranui's 6px default
 * and was plainly visible once the hero CTAs went to --ran-radius-full.
 */
describe('r-button radius overrides', () => {
  const sheets = ['public/home.css', 'public/landing.css'].map((rel) => ({
    rel,
    css: readFileSync(resolve(ROOT, rel), 'utf8'),
  }));

  /** Every rule as (selectors, body), comments stripped, selectors split. */
  const rulesOf = (css: string): Array<{ selectors: string[]; body: string }> =>
    [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^}]*)\}/g)].map((m) => ({
      selectors: m[1].split(',').map((s) => s.trim()),
      body: m[2],
    }));

  const radiusOf = (body: string): string | undefined => body.match(/border-radius:\s*([^;]+)/)?.[1].trim();

  it.each(sheets)('$rel rounds the host wherever it rounds ::part(button)', ({ css }) => {
    const rules = rulesOf(css);
    const rounded = rules.filter(
      (r) => r.selectors.some((s) => s.endsWith('::part(button)')) && radiusOf(r.body) !== undefined,
    );
    expect(rounded.length).toBeGreaterThan(0);

    for (const rule of rounded) {
      const radius = radiusOf(rule.body)!;
      for (const partSelector of rule.selectors.filter((s) => s.endsWith('::part(button)'))) {
        const host = partSelector.slice(0, -'::part(button)'.length);
        // Some rule -- this one or another -- must give the bare host the same
        // radius, or its shadow keeps the old shape.
        const hostRounded = rules.some((r) => r.selectors.includes(host) && radiusOf(r.body) === radius);
        expect(hostRounded, `${host} needs border-radius: ${radius}`).toBe(true);
      }
    }
  });
});
