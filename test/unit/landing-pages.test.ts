import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LOCALES, MENU_ORDER, generate } from '../../bin/build-pages.mjs';

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

type LdNode = Record<string, any>;
/** Every JSON-LD node a page ships, @graph flattened. */
function jsonLdGraph(html: string): LdNode[] {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((m) => {
    const doc = JSON.parse(m[1]);
    return (doc['@graph'] ?? [doc]) as LdNode[];
  });
}

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
/** A generated page by output path, e.g. 'zh-CN/index.html' -- the render, not the file. */
const generated = (rel: string): string => {
  const page = GENERATED.find((g) => g.rel === rel);
  if (!page) throw new Error(`no generated page ${rel}`);
  return page.html;
};
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

      it('ships parseable JSON-LD whose page node is this page', () => {
        const graph = jsonLdGraph(html);
        expect(graph.length).toBeGreaterThan(0);
        const webPage = graph.find((n) => n['@type'] === 'WebPage');
        expect(webPage?.url).toBe(ORIGIN + route);
        expect(webPage?.['@id']).toBe(`${ORIGIN}${route}#webpage`);
        for (const faq of graph.filter((n) => n['@type'] === 'FAQPage')) {
          expect(faq.mainEntity.length).toBeGreaterThan(2);
        }
      });

      /**
       * The editor is one thing described from 154 pages, not 154 things that
       * share a name. It is the difference between an assistant reading three
       * of our pages and coming away with one editor or with three -- and the
       * only thing holding it together is that the node keeps the same @id and
       * the same url everywhere (apple.com does this with #organization).
       */
      it('describes one shared app entity, never a per-page copy', () => {
        const app = jsonLdGraph(html).find((n) => n['@type'] === 'WebApplication');
        if (!app) return; // only landing pages carry it
        expect(app['@id']).toBe(`${ORIGIN}/#app`);
        expect(app.url).toBe(`${ORIGIN}/`);
      });

      /**
       * A reference to an @id that is not in the graph is silently nothing --
       * the consumer drops the edge and the page goes back to describing an
       * anonymous app. Cheap to break by renaming one id, invisible afterwards.
       */
      it('resolves every @id reference it makes', () => {
        const graph = jsonLdGraph(html);
        const ids = new Set(graph.map((n) => n['@id']).filter(Boolean));
        expect(ids.size, 'no duplicate @id in one graph').toBe(graph.filter((n) => n['@id']).length);
        const refs: string[] = [];
        const walk = (value: unknown): void => {
          if (Array.isArray(value)) return value.forEach(walk);
          if (!value || typeof value !== 'object') return;
          const node = value as Record<string, unknown>;
          // A bare { "@id": ... } with nothing else is a reference; a node that
          // also carries a @type is a definition.
          if (typeof node['@id'] === 'string' && !node['@type']) refs.push(node['@id']);
          Object.entries(node).forEach(([key, v]) => key !== '@id' && walk(v));
        };
        graph.forEach((n) => Object.entries(n).forEach(([key, v]) => key !== '@id' && walk(v)));
        expect(refs.length).toBeGreaterThan(0);
        for (const ref of refs) expect(ids, `${ref} is defined in the graph`).toContain(ref);
      });

      /**
       * A visitor who picked a language on the site must not land in an editor
       * that guesses one from browser settings. The app resolves `?locale=`
       * before anything else, so every link from a translated page into the
       * app has to carry it -- the hand-written Chinese homepage always did,
       * and the first generated version of it silently dropped it.
       */
      it('hands the chosen language to the editor', () => {
        const links = [...html.matchAll(/(?:href|data-open-local)="(\/editor\?[^"]*)"/g)].map((m) => m[1]);
        if (!links.length) return;
        for (const link of links) {
          const carries = link.includes(`locale=${locale}`);
          expect(locale === 'en' ? !link.includes('locale=') : carries, `${route}: ${link}`).toBe(true);
        }
      });

      /**
       * Open Graph has its own spelling of the same set hreflang carries. A
       * share of /ja/ or /pt/ without og:locale is read as English by every
       * consumer that looks at OG -- which is most of them.
       */
      it('declares its Open Graph locale, and the ones it is also published in', () => {
        const og = (l: string) => LOCALES[l].og;
        expect(attr(html, /property="og:locale" content="([^"]+)"/), `${route} og:locale`).toBe(og(locale));

        const alternates = [...html.matchAll(/property="og:locale:alternate" content="([^"]+)"/g)].map((m) => m[1]);
        const expected = Object.keys(LOCALES)
          .filter((l) => l !== locale && routes.has(routeIn(l, enRoute)))
          .map(og);
        expect(alternates.sort(), `${route} og:locale:alternate`).toEqual(expected.sort());
      });

      /**
       * /editor and /history are one app serving every language, so a link from
       * a translated page into them has to say which one. Picking 日本語 on the
       * homepage and then opening the saved-documents page used to land the
       * reader back in English: the choice existed only as the path they were
       * standing on, and /history is not under it.
       */
      it('carries the language on every link into the app', () => {
        const appLinks = [...html.matchAll(/(?:href|data-open-local)="(\/(?:editor|history)[^"]*)"/g)].map((m) => m[1]);
        for (const link of appLinks) {
          const carries = link.includes(`locale=${locale}`);
          expect(locale === 'en' ? !link.includes('locale=') : carries, `${route}: ${link}`).toBe(true);
        }
      });

      /**
       * The switch is a list of real links, so each entry is checked as one: the
       * href a reader would copy, and the `lang`/`hreflang` that tell a screen
       * reader (and a crawler) what is on the other end. `lang` in particular is
       * the difference between a screen reader pronouncing "日本語" as Japanese
       * and reading it with the phonetics of the current page -- and these
       * labels exist precisely for readers who cannot read the current page.
       */
      it('offers every translation it has in the language switch', () => {
        for (const other of Object.keys(LOCALES)) {
          const target = routeIn(other, enRoute);
          if (!routes.has(target)) continue;
          const lang = LOCALES[other].lang;
          expect(html, `${route} does not offer ${other}`).toContain(
            `href="${target}" lang="${lang}" hreflang="${lang}"`,
          );
        }
      });

      it('names each language in its own words, and marks the one being read', () => {
        // Endonyms, never abbreviations: this menu's whole audience is readers
        // who cannot read the page it sits on, and "EN" is only legible to
        // someone who already reads English. It used to be the one abbreviated
        // entry among six full names.
        for (const other of Object.keys(LOCALES)) {
          const target = routeIn(other, enRoute);
          if (!routes.has(target)) continue;
          expect(html, `${route}: ${other} is not named in its own language`).toContain(
            `hreflang="${LOCALES[other].lang}"${other === locale ? ' aria-current="page"' : ''}>${LOCALES[other].label}</a>`,
          );
        }
        // Exactly one row is the current one, and the trigger agrees with it.
        expect([...html.matchAll(/class="lang-option is-current"/g)]).toHaveLength(1);
        expect(html).toContain(`<span class="lang-current">${LOCALES[locale].label}</span>`);
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
    const en = generated('index.html');
    const zh = generated('zh-CN/index.html');
    const llms = readFileSync(resolve(PUBLIC, 'llms.txt'), 'utf8');
    for (const fmt of ['docx', 'xlsx', 'pptx', 'pdf', 'odt', 'ods', 'odp']) {
      expect(en).toContain(`href="/open/${fmt}"`);
      expect(zh).toContain(`href="/zh-CN/open/${fmt}"`);
      expect(llms).toContain(`${ORIGIN}/open/${fmt}`);
    }
  });

  it('every /convert/* page is cross-linked from both homepages and llms.txt', () => {
    const en = generated('index.html');
    const zh = generated('zh-CN/index.html');
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
    for (const [rel, ask, days] of [
      ['index.html', /tab|refresh/i, '7 days'],
      ['zh-CN/index.html', /标签页|刷新/, '7 天'],
    ] as Array<[string, RegExp, string]>) {
      const html = generated(rel);
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
      expect(answer, `${rel} has no question about closing the tab`).toBeTruthy();
      expect(answer).toContain(days);
    }
  });

  /**
   * /history and /404 are hand-written (an app surface and an error page, both
   * outside the generator), so their language switch does not come from
   * LOCALES -- it was still offering en and zh long after the site had seven
   * languages. Nothing else would have noticed: neither is in the sitemap or
   * the hreflang graph.
   */
  it.each([
    ['history.html', resolve(ROOT, 'history.html')],
    ['404.html', resolve(PUBLIC, '404.html')],
  ])('%s offers every language the site has', (_label, file) => {
    const html = readFileSync(file, 'utf8');
    const offered = [...html.matchAll(/class="lang-option[^"]*" href="[^"]*" lang="([^"]+)"/g)].map((m) => m[1]);
    // In the menu's own order, so a hand-written page cannot list them in some
    // other sequence than the generated pages do.
    expect(offered).toEqual(MENU_ORDER.map((l) => LOCALES[l].lang));
  });

  /**
   * The menu's order is a fixed list rather than a sort, so that it cannot come
   * out differently depending on the host's ICU data. The cost of that choice is
   * that adding a language to LOCALES and forgetting this list would silently
   * drop it from every menu on the site.
   */
  it('lists every locale in the language menu order', () => {
    expect([...MENU_ORDER].sort()).toEqual(Object.keys(LOCALES).sort());
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
    // The page is generated from markdown and not committed, so it is read
    // from the same in-memory render as the rest of this file -- in every
    // locale that has a translation of it.
    const webmcp = GENERATED.filter((g) => g.rel.endsWith('webmcp-document-editor.html'));
    expect(webmcp.length).toBeGreaterThanOrEqual(2);
    for (const page of webmcp) {
      for (const name of names) {
        expect(page.html, `${page.route} must mention ${name}`).toContain(name);
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

/**
 * The homepages are rendered from content/<locale>/home.json. A key that is
 * present but empty renders as an element with no text -- the zh-CN hero
 * shipped four blank pills where its CTA buttons should have been, because
 * the move to data-driven homepages left content/zh-CN/home.json's `cta`
 * strings empty and nothing read them back. Both halves matter: the shape
 * has to match en (a missing key is a missing slot) and every string has to
 * carry text (a present key is not a translated one).
 */
describe('homepage content data', () => {
  const home = (locale: string) =>
    JSON.parse(readFileSync(resolve(ROOT, 'content', locale, 'home.json'), 'utf8')) as unknown;

  /** Every leaf string's path, e.g. 'cta.docx' or 'trust[3]'. */
  const leaves = (value: unknown, path = ''): Array<{ path: string; text: string }> => {
    if (typeof value === 'string') return [{ path, text: value }];
    if (Array.isArray(value)) return value.flatMap((v, i) => leaves(v, `${path}[${i}]`));
    if (value && typeof value === 'object')
      return Object.entries(value).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
    return [];
  };

  const locales = Object.keys(LOCALES);

  it.each(locales)('%s/home.json has no blank strings', (locale) => {
    const blank = leaves(home(locale))
      .filter(({ text }) => !text.trim())
      .map(({ path }) => path);
    expect(blank, `${locale}/home.json`).toEqual([]);
  });

  /**
   * Array indices are collapsed, because the lists are genuinely per-locale:
   * the footer links to the pages that exist in that language, so ja has one
   * fewer than en. What may not differ is the set of named slots.
   */
  it.each(locales.filter((l) => l !== 'en'))('%s/home.json has the same slots as en', (locale) => {
    const slots = (value: unknown) => [...new Set(leaves(value).map((l) => l.path.replace(/\[\d+\]/g, '[]')))];
    expect(slots(home(locale))).toEqual(slots(home('en')));
  });
});

/**
 * Two shell rules that only the homepage template ever broke, because it is a
 * separate renderer from the satellite pages (bin/pages/render-home.mjs vs
 * render-page.mjs) and nothing compared the two.
 */
describe('page shell', () => {
  const homepages = pages.filter(({ route }) => route === '/' || /^\/[a-zA-Z-]+\/$/.test(route));

  it('finds every homepage (sanity)', () => {
    expect(homepages.length).toBe(Object.keys(LOCALES).length);
  });

  /**
   * `user-scalable=no` / `maximum-scale=1` take pinch-zoom away from the
   * reader -- WCAG 2.1 SC 1.4.4, and the one thing a person with low vision
   * does first on a phone. The seven homepages carried it (the editor keeps
   * it: it has its own zoom, and a pinch on a document canvas means something
   * else), so the site blocked zoom on exactly the pages a first-time visitor
   * lands on.
   */
  it.each(pages)('$label lets the reader zoom', ({ html, label }) => {
    const viewport = attr(html, /<meta name="viewport" content="([^"]+)"/);
    expect(viewport, `${label} has no viewport meta`).toBeTruthy();
    expect(viewport, label).not.toMatch(/user-scalable\s*=\s*no/);
    expect(viewport, label).not.toMatch(/maximum-scale\s*=\s*[01](\.\d+)?\b/);
  });

  /**
   * A screen reader's "skip to main content" and an agent's reading order both
   * start from the <main> landmark. The satellite pages have had one all along;
   * the homepages wrapped everything in a <section> instead, so on the seven
   * busiest pages of the site there was nothing to skip to.
   */
  it.each(pages)('$label has exactly one main landmark', ({ html, label }) => {
    expect((html.match(/<main[\s>]/g) ?? []).length, label).toBe(1);
  });
});

/**
 * llms.txt is read by agents, and the format it is read in is the one
 * llmstxt.org describes: markdown link lists under H2 sections. Ours listed
 * every page as "- Title: https://url", which is legible to a person and
 * invisible to a parser -- Lighthouse's agentic-browsing audit reported the
 * file as containing no links at all.
 */
describe('llms.txt', () => {
  const llms = readFileSync(resolve(PUBLIC, 'llms.txt'), 'utf8');
  /** Every bullet under the '## Links' and '## Pages' sections. */
  const linkBullets = llms
    .split(/^## /m)
    .filter((section) => /^(Links|Pages)\b/.test(section))
    .flatMap((section) => section.split('\n').filter((line) => line.startsWith('- ')));

  it('lists its pages as markdown links', () => {
    expect(linkBullets.length).toBeGreaterThan(20);
    const unlinked = linkBullets.filter((line) => !/^- \[[^\]]+\]\(\S+\)/.test(line));
    // The Docker image is named, not linked -- ghcr.io/... is a pull target.
    expect(unlinked).toEqual([
      '- Self-host Docker image: ghcr.io/ranuts/document (static site, any static host works too)',
    ]);
  });

  it('links only to pages that exist', () => {
    const site = linkBullets
      .flatMap((line) => [...line.matchAll(/\((https:\/\/edit\.chaxus\.com([^)]*))\)/g)].map((m) => m[2]))
      .map((path) => (path === '' ? '/' : path));
    expect(site.length).toBeGreaterThan(20);
    for (const path of site) {
      if (path.startsWith('/editor') || path.endsWith('.txt')) continue;
      expect(routes.has(path), `llms.txt links to ${path}`).toBe(true);
    }
  });
});
