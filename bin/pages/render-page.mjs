/**
 * The template every generated page other than a homepage uses: prose from
 * markdown, dropped into the shared shell.
 */
import { ORIGIN, REPO } from './constants.mjs';
import { ID, appEntity, appStub, siteEntities, sourceEntity } from './entities.mjs';
import { DEFAULT_LOCALE, LOCALES } from './locales.mjs';
import { GH_MARK, langMenu, routeFor } from './chrome.mjs';
import { escapeHtml, renderInline } from './markdown.mjs';
import { UI } from './ui.mjs';

export function renderPage({ page, locale, meta, body, headings, faq, steps, source }) {
  const L = LOCALES[locale];
  const ui = UI[locale];
  const route = routeFor(locale, page.slug);
  const url = ORIGIN + route;
  const enUrl = ORIGIN + routeFor(DEFAULT_LOCALE, page.slug);
  const title = meta.title;
  const description = meta.description;

  const isLanding = page.kind === 'landing';
  const cardDescription = meta.ogDescription || description;
  const graph = [
    ...siteEntities(),
    // Every page is a page; a landing page additionally describes the app, and
    // Google's rich results treat a WebApplication node accordingly (price,
    // category, platform). The app node is the same entity everywhere, so a
    // landing page adds to its description rather than declaring a new one.
    {
      '@type': 'WebPage',
      '@id': `${url}#webpage`,
      url,
      name: title,
      description,
      inLanguage: L.lang,
      isPartOf: { '@id': ID.site },
      about: { '@id': ID.app },
      breadcrumb: { '@id': `${url}#breadcrumb` },
    },
    isLanding ? appEntity({ description: meta.appDescription || description }) : appStub(),
    sourceEntity(),
  ];
  // The steps a landing page already lists, as structured data. Taken from the
  // rendered list rather than written separately: the hand-written pages kept a
  // second copy of every step inside the JSON-LD, and the two had drifted apart
  // -- which is exactly what Google's structured-data policy forbids.
  if (isLanding && meta.howTo && steps.length >= 2) {
    graph.push({
      '@type': 'HowTo',
      '@id': `${url}#howto`,
      inLanguage: L.lang,
      name: meta.howTo,
      step: steps.map((text) => ({ '@type': 'HowToStep', text })),
    });
  }
  if (faq.length >= 2) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      inLanguage: L.lang,
      mainEntity: faq.map(({ q, a }) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    });
  }
  const crumbs = [{ '@type': 'ListItem', position: 1, name: ui.home, item: ORIGIN + L.home }];
  if (meta.parent) {
    crumbs.push({ '@type': 'ListItem', position: 2, name: meta.parent.name, item: ORIGIN + meta.parent.href });
  }
  crumbs.push({ '@type': 'ListItem', position: crumbs.length + 1, name: meta.breadcrumb || title, item: url });
  graph.push({ '@type': 'BreadcrumbList', '@id': `${url}#breadcrumb`, itemListElement: crumbs });

  const translations = Object.keys(LOCALES).filter((l) => page.sources[l]);
  const alternates = translations
    .map((l) => `    <link rel="alternate" hreflang="${l}" href="${ORIGIN + routeFor(l, page.slug)}" />`)
    .join('\n');
  // Open Graph carries the same set as hreflang, in its own spelling: the
  // language of this page, then the others it exists in. Without it a share of
  // /ja/ or /pt/ is treated as English by every consumer that reads OG.
  const ogAlternates = translations
    .filter((l) => l !== locale)
    .map((l) => `    <meta property="og:locale:alternate" content="${LOCALES[l].og}" />`)
    .join('\n');
  // The table of contents lives in the sidebar rail, not above the article:
  // on /help it was 14 links between the reader and the first sentence.
  const toc =
    headings.length >= 3
      ? `        <nav class="side-block">\n          <span class="side-label">${ui.onThisPage}</span>\n${headings
          .map((h) => `          <a href="#${h.id}">${escapeHtml(h.text.replace(/<[^>]+>/g, ''))}</a>`)
          .join('\n')}\n        </nav>\n`
      : '';
  const notice = meta.notice ? `        <p class="notice">${escapeHtml(meta.notice)}</p>\n` : '';
  // The lead carries inline emphasis on a landing page ("Got a **.docx** file
  // but no Word installed"), so it is markdown rather than an escaped string.
  const lead = meta.lead ? `        <p class="lead">${renderInline(meta.lead)}</p>\n` : '';
  const cta =
    isLanding && meta.cta
      ? `        <a class="cta" href="${escapeHtml(meta.ctaHref || L.home)}"><r-button type="primary">${escapeHtml(meta.cta)}</r-button></a>\n`
      : '';
  // Every landing page ends on the same promise, so it belongs to the shell
  // rather than to eighteen copies of the same paragraph.
  const ossNote = isLanding ? `        <aside class="oss">${ui.ossNote}</aside>\n` : '';
  // Where the words came from is worth saying on a page generated out of a
  // repository document; on a landing page it is noise.
  const sourceNote = isLanding
    ? ''
    : `\n        <p class="source">${escapeHtml(ui.generatedNote(source))} · <a href="${REPO}/blob/main/${source}" rel="noopener">GitHub</a></p>\n`;
  const footer = ui.footer.map(([href, label]) => `        <a href="${href}">${label}</a>`).join('\n');
  const here = routeFor(locale, page.slug);
  const parentOf = (href) => href.replace(/\/[^/]*$/, '') || '/';
  // Siblings first: from a format page the useful next click is another
  // format, not the embed API. Help and the changelog are one row down in the
  // footer of every page, so they do not need the rail as well.
  const candidates = ui.footer.filter(
    ([href]) =>
      href !== here &&
      href !== LOCALES[locale].home &&
      !new RegExp(`^${LOCALES[locale].prefix}/(help|changelog)$`).test(href),
  );
  const related = [
    ...candidates.filter(([href]) => parentOf(href) === parentOf(here)),
    ...candidates.filter(([href]) => parentOf(href) !== parentOf(here)),
  ]
    .slice(0, 5)
    .map(([href, label]) => `          <a href="${href}">${label}</a>`)
    .join('\n');
  const aside = `      <aside class="side" aria-label="${ui.onThisPage}">
        <div class="side-cta">
          <a class="cta" href="${escapeHtml(meta.ctaHref || L.home)}"><r-button type="primary">${escapeHtml(meta.cta || `${ui.openEditor} \u2192`)}</r-button></a>
          <span class="side-note">${ui.sideNote}</span>
        </div>
${toc}        <nav class="side-block">
          <span class="side-label">${ui.more}</span>
${related}
        </nav>
      </aside>
`;
  const jsonLd = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2)
    .split('\n')
    .map((l) => '      ' + l)
    .join('\n');

  return `<!doctype html>
<!-- GENERATED by bin/build-pages.mjs from ${source} -- edit the markdown, not this file. -->
<html lang="${L.lang}" dir="${L.dir}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link href="/img/64.png" rel="shortcut icon" />
    <link rel="icon" type="image/png" href="/img/64.png" />
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
    <meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff" />
    <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#000000" />

    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${url}" />
${alternates}
    <link rel="alternate" hreflang="x-default" href="${enUrl}" />

    <meta property="og:type" content="${isLanding ? 'website' : 'article'}" />
    <meta property="og:site_name" content="Online Document Editor" />
    <meta property="og:locale" content="${L.og}" />
${ogAlternates}
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(cardDescription)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${ORIGIN}/img/pwa-512.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(cardDescription)}" />
    <meta name="twitter:image" content="${ORIGIN}/img/pwa-512.png" />

    <script type="application/ld+json">
${jsonLd}
    </script>

    <script>
      try {
        var t = localStorage.getItem('ran-theme');
        if (t === 'dark' || t === 'light') {
          document.documentElement.setAttribute('data-ran-theme', t);
          document.documentElement.setAttribute('theme', t);
        }
      } catch (e) {}
    </script>
    <link rel="stylesheet" href="/ran-fonts/fonts.css" />
    <link rel="stylesheet" href="/ran-tokens.css" />
    <link rel="stylesheet" href="/landing.css" />
    <script src="/ranui-iife/button.iife.js" defer></script>
    <script src="/ranui-iife/popover.iife.js" defer></script>
    <script src="/ranui-iife/content.iife.js" defer></script>
    <script src="/ranui-iife/theme-switch.iife.js" defer></script>
    <script src="/lang-switch.js" defer></script>
  </head>

  <body>
    <svg width="0" height="0" style="position: absolute" aria-hidden="true">
      <symbol id="gh-mark" viewBox="0 0 16 16"><path d="${GH_MARK}" /></symbol>
    </svg>

    <header class="bar">
      <a class="brand" href="${L.home}"><span class="logo">D</span>${ui.siteName}</a>
      <nav>
${langMenu(locale, translations, ui, (l) => routeFor(l, page.slug))}
        <a href="${REPO}" rel="noopener" target="_blank">
          <svg class="ghmark" aria-hidden="true"><use href="#gh-mark"></use></svg> GitHub
        </a>
      </nav>
    </header>

    <div class="page">
      <main class="wrap${isLanding ? '' : ' doc'}">
        <p class="eyebrow">${escapeHtml(meta.eyebrow || meta.breadcrumb || title)}</p>
        <h1>${escapeHtml(meta.h1 || title)}</h1>
${lead}${cta}${notice}
        <article>
${body}
        </article>
${ossNote}${sourceNote}      </main>
${aside}    </div>
    <footer class="page-foot">
${footer}
      <a href="${REPO}" rel="noopener">GitHub</a>
      <r-theme-switch class="theme-switch" label="${ui.themeLabel}"></r-theme-switch>
      <p class="tm">${escapeHtml(ui.trademark)}</p>
    </footer>
  </body>
</html>
`;
}

/**
 * Where an output belongs on disk. Everything lives under public/ except the
 * default locale's homepage: that one is the repo-root index.html, which Vite
 * takes as a build entry.
 */
