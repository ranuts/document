import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generate } from '../../bin/build-pages.mjs';

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
    const isZh = route.startsWith('/zh-CN/');
    const enRoute = isZh ? route.replace(/^\/zh-CN/, '') || '/' : route;
    const zhRoute = isZh ? route : `/zh-CN${route === '/' ? '/' : route}`;

    describe(route, () => {
      it('has canonical = its own URL and a full hreflang set', () => {
        expect(attr(html, /<link rel="canonical" href="([^"]+)"/)).toBe(ORIGIN + route);
        expect(attr(html, /hreflang="en" href="([^"]+)"/)).toBe(ORIGIN + enRoute);
        expect(attr(html, /hreflang="zh-CN" href="([^"]+)"/)).toBe(ORIGIN + zhRoute);
        expect(attr(html, /hreflang="x-default" href="([^"]+)"/)).toBe(ORIGIN + enRoute);
        expect(attr(html, /<html lang="([^"]+)"/)).toBe(isZh ? 'zh-CN' : 'en');
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

      it('has an existing counterpart in the other language and links to it', () => {
        const other = isZh ? enRoute : zhRoute;
        expect(other === '/' ? existsSync(homepage) : routes.has(other), `${other} for ${route}`).toBe(true);
        expect(html).toContain(`data-href="${other}"`);
      });

      it('lives in the sitemap', () => {
        expect(readFileSync(resolve(PUBLIC, 'sitemap.xml'), 'utf8')).toContain(`<loc>${ORIGIN + route}</loc>`);
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
    for (const fmt of ['docx', 'xlsx', 'pptx', 'pdf']) {
      expect(en).toContain(`href="/open/${fmt}"`);
      expect(zh).toContain(`href="/zh-CN/open/${fmt}"`);
      expect(llms).toContain(`${ORIGIN}/open/${fmt}`);
    }
  });

  it('zh-CN CTAs stay in Chinese; "open your <format>" never lands on a blank new docx', () => {
    const allowed = new Set(['/zh-CN/', '/?locale=zh-CN&amp;new=docx', '/embed-demo.html']);
    for (const { route, html } of pages.filter((p) => p.route.startsWith('/zh-CN/') && p.route !== '/zh-CN/')) {
      const m = html.match(/<a class="cta" href="([^"]+)"><r-button[^>]*>([^<]+)</);
      if (!m) continue;
      const [, href, label] = m;
      expect(allowed.has(href), `${route} cta ${href}`).toBe(true);
      if (label.includes('打开你的')) expect(href, route).toBe('/zh-CN/');
    }
  });
});
