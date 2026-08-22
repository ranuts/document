#!/usr/bin/env node
/**
 * Markdown -> static HTML pages on the landing-page shell.
 *
 * The hand-written landing pages under public/ share one shell (ran tokens,
 * ranui IIFE components, top bar with language select, canonical/hreflang,
 * JSON-LD, footer inter-links). Help pages and release notes are "many
 * pages x every locale, edited often", so they are generated from markdown
 * into that same shell instead of being hand-written.
 *
 * Model: PAGES below is a list of { slug, sources: { <locale>: <md file> } }.
 * Every locale renders to public/<localePrefix><slug>.html; the shell links
 * all locales of the same slug to each other (hreflang + language select).
 * Adding a locale to LOCALES is enough for the shell; content is per file.
 *
 * Output is deterministic and committed (public/ is served as-is by vite dev
 * and copied by the build); bin/build.sh runs this first, and
 * test/unit/generated-pages.test.ts fails when a committed page is stale.
 *
 *   node bin/build-pages.mjs            # write into public/
 *   node bin/build-pages.mjs --check    # exit 1 if any output would change
 *   node bin/build-pages.mjs --out DIR  # write elsewhere (tests)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Marked } from 'marked';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://edit.chaxus.com';
const REPO = 'https://github.com/ranuts/document';

/** Locales the shell knows about. `prefix` is the URL directory; '' = root. */
export const LOCALES = {
  en: { prefix: '', lang: 'en', label: 'EN', home: '/', dir: 'ltr' },
  'zh-CN': { prefix: '/zh-CN', lang: 'zh-CN', label: '中文', home: '/zh-CN/', dir: 'ltr' },
};
const DEFAULT_LOCALE = 'en';

/** Per-locale chrome strings (the shell itself is bilingual). */
const UI = {
  en: {
    siteName: 'Document Editor',
    langAria: 'Language',
    themeLabel: 'Theme',
    home: 'Home',
    openEditor: 'Open editor',
    onThisPage: 'On this page',
    more: 'Related pages',
    sideNote: 'Runs on your device. No upload, no sign-up.',
    footer: [
      ['/', 'Open editor'],
      ['/help', 'Help'],
      ['/changelog', 'Changelog'],
      ['/open/docx', 'Open DOCX'],
      ['/open/xlsx', 'Open XLSX'],
      ['/open/pptx', 'Open PPTX'],
      ['/open/pdf', 'Open PDF'],
      ['/convert/xlsx-to-csv', 'XLSX to CSV'],
      ['/convert/csv-to-xlsx', 'CSV to XLSX'],
      ['/no-signup-document-editor', 'No sign-up'],
      ['/private-document-editor', 'Private editor'],
      ['/offline-document-editor', 'Offline'],
      ['/edit-documents-without-account', 'No account'],
      ['/embed-document-editor', 'Embed API'],
    ],
    generatedNote: (src) => `Source: ${src} in the repository`,
  },
  'zh-CN': {
    siteName: 'Document Editor',
    langAria: '语言',
    themeLabel: '主题',
    home: '首页',
    openEditor: '打开编辑器',
    onThisPage: '本页目录',
    more: '相关页面',
    sideNote: '在你的设备上运行，不上传、免注册。',
    footer: [
      ['/zh-CN/', '打开编辑器'],
      ['/zh-CN/help', '帮助'],
      ['/zh-CN/changelog', '更新日志'],
      ['/zh-CN/open/docx', '打开 DOCX'],
      ['/zh-CN/open/xlsx', '打开 XLSX'],
      ['/zh-CN/open/pptx', '打开 PPTX'],
      ['/zh-CN/open/pdf', '打开 PDF'],
      ['/zh-CN/convert/xlsx-to-csv', 'XLSX 转 CSV'],
      ['/zh-CN/convert/csv-to-xlsx', 'CSV 转 XLSX'],
      ['/zh-CN/no-signup-document-editor', '免注册'],
      ['/zh-CN/private-document-editor', '隐私编辑器'],
      ['/zh-CN/offline-document-editor', '离线'],
      ['/zh-CN/edit-documents-without-account', '免账号'],
      ['/zh-CN/embed-document-editor', 'Embed API'],
    ],
    generatedNote: (src) => `来源：仓库中的 ${src}`,
  },
};

/**
 * Pages to generate. `sources` may point at any markdown file in the repo;
 * frontmatter (title / description / eyebrow / breadcrumb) is optional and
 * can be overridden per locale in `meta`. When a locale has no source of its
 * own it may reuse another (e.g. the changelog is maintained in English only)
 * -- `notice` is then rendered above the body.
 */
export const PAGES = [
  {
    slug: 'help',
    sources: { en: 'content/en/help.md', 'zh-CN': 'content/zh-CN/help.md' },
  },
  {
    slug: 'help/embed-api',
    sources: { en: 'docs/embed-api.md', 'zh-CN': 'docs/embed-api.zh.md' },
    meta: {
      en: {
        title: 'Embed API — iframe + postMessage reference',
        description:
          'Reference for embedding the document editor in your own web app: iframe setup, postMessage commands (open URL/File/buffer, read-only, save), responses and origin restriction.',
        eyebrow: 'Help · Embed API',
        breadcrumb: 'Embed API',
        parent: { href: '/help', name: 'Help' },
      },
      'zh-CN': {
        title: 'Embed API——iframe + postMessage 参考',
        description:
          '在你自己的 Web 应用中嵌入文档编辑器的参考：iframe 接入、postMessage 命令（按 URL/File/buffer 打开、只读、保存）、响应格式与来源限制。',
        eyebrow: '帮助 · Embed API',
        breadcrumb: 'Embed API',
        parent: { href: '/zh-CN/help', name: '帮助' },
      },
    },

    stripFirstHeading: true,
  },
  {
    slug: 'changelog',
    sources: { en: 'CHANGELOG.md', 'zh-CN': 'CHANGELOG.md' },
    meta: {
      en: {
        title: 'Changelog — what changed in the online document editor',
        description:
          'User-facing release notes for edit.chaxus.com: new formats, editor fixes, performance and privacy changes, in reverse chronological order.',
        eyebrow: 'Changelog',
        breadcrumb: 'Changelog',
      },
      'zh-CN': {
        title: '更新日志——在线文档编辑器改了什么',
        description: 'edit.chaxus.com 面向用户的版本记录：新增格式、编辑器修复、性能与隐私改动，按时间倒序。',
        eyebrow: '更新日志',
        breadcrumb: '更新日志',
        notice: '更新日志以英文维护（单一数据源 CHANGELOG.md），中文版稍后补充。',
      },
    },
    stripFirstHeading: true,
  },
];

// ---------------------------------------------------------------------------

const escapeHtml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Minimal frontmatter: `---\nkey: value\n---` with scalar values only. */
function parseFrontmatter(md) {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, body: md };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    data[key] = value;
  }
  return { data, body: md.slice(m[0].length) };
}

const slugify = (text) =>
  String(text)
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '') || 'section';

/** Render markdown to HTML with heading ids (for a table of contents / deep links). */
function renderMarkdown(md, { stripFirstHeading = false } = {}) {
  const marked = new Marked({ gfm: true, breaks: false });
  const used = new Map();
  const headings = [];
  let first = true;
  marked.use({
    renderer: {
      heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens);
        if (stripFirstHeading && first && depth === 1) {
          first = false;
          return '';
        }
        first = false;
        let id = slugify(text);
        const n = used.get(id) || 0;
        used.set(id, n + 1);
        if (n) id = `${id}-${n + 1}`;
        if (depth === 2) headings.push({ id, text });
        return `<h${depth} id="${id}">${text}</h${depth}>\n`;
      },
      link({ href, title, tokens }) {
        const text = this.parser.parseInline(tokens);
        const external = /^https?:\/\//.test(href) && !href.startsWith(ORIGIN);
        const t = title ? ` title="${escapeHtml(title)}"` : '';
        const rel = external ? ' rel="noopener"' : '';
        return `<a href="${escapeHtml(href)}"${t}${rel}>${text}</a>`;
      },
    },
  });
  const html = marked.parse(md);
  return { html, headings };
}

/** FAQ pairs: an h3 ending in ?/？ followed by a paragraph. Feeds FAQPage JSON-LD. */
function extractFaq(html) {
  const out = [];
  const re = /<h3 id="[^"]*">([^<]*[?？])<\/h3>\s*<p>([\s\S]*?)<\/p>/g;
  let m;
  while ((m = re.exec(html))) {
    const strip = (s) =>
      s
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    out.push({ q: strip(m[1]), a: strip(m[2]) });
  }
  return out;
}

const GH_MARK =
  'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z';

function routeFor(locale, slug) {
  return `${LOCALES[locale].prefix}/${slug}`;
}

function renderPage({ page, locale, meta, body, headings, faq, source }) {
  const L = LOCALES[locale];
  const ui = UI[locale];
  const route = routeFor(locale, page.slug);
  const url = ORIGIN + route;
  const enUrl = ORIGIN + routeFor(DEFAULT_LOCALE, page.slug);
  const title = meta.title;
  const description = meta.description;

  const graph = [
    {
      '@type': 'WebPage',
      name: title,
      url,
      description,
      inLanguage: L.lang,
      isPartOf: { '@type': 'WebSite', name: 'Online Document Editor', url: ORIGIN + '/' },
    },
    {
      '@type': 'SoftwareSourceCode',
      name: 'Online Document Editor',
      codeRepository: REPO,
      programmingLanguage: 'TypeScript',
      license: 'https://www.gnu.org/licenses/agpl-3.0.html',
    },
  ];
  if (faq.length >= 2) {
    graph.push({
      '@type': 'FAQPage',
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
  graph.push({ '@type': 'BreadcrumbList', itemListElement: crumbs });

  const alternates = Object.keys(LOCALES)
    .filter((l) => page.sources[l])
    .map((l) => `    <link rel="alternate" hreflang="${l}" href="${ORIGIN + routeFor(l, page.slug)}" />`)
    .join('\n');
  const langOptions = Object.keys(LOCALES)
    .filter((l) => page.sources[l])
    .map(
      (l) => `            <r-option value="${l}" data-href="${routeFor(l, page.slug)}">${LOCALES[l].label}</r-option>`,
    )
    .join('\n');
  // The table of contents lives in the sidebar rail, not above the article:
  // on /help it was 14 links between the reader and the first sentence.
  const toc =
    headings.length >= 3
      ? `        <nav class="side-block">\n          <span class="side-label">${ui.onThisPage}</span>\n${headings
          .map((h) => `          <a href="#${h.id}">${escapeHtml(h.text.replace(/<[^>]+>/g, ''))}</a>`)
          .join('\n')}\n        </nav>\n`
      : '';
  const notice = meta.notice ? `      <p class="notice">${escapeHtml(meta.notice)}</p>\n` : '';
  const footer = ui.footer.map(([href, label]) => `        <a href="${href}">${label}</a>`).join('\n');
  const here = routeFor(locale, page.slug);
  const related = ui.footer
    .filter(([href]) => href !== here && href !== LOCALES[locale].home)
    .slice(0, 5)
    .map(([href, label]) => `          <a href="${href}">${label}</a>`)
    .join('\n');
  const aside = `      <aside class="side" aria-label="${ui.onThisPage}">
        <div class="side-cta">
          <a class="cta" href="${LOCALES[locale].home}"><r-button type="primary">${ui.openEditor} \u2192</r-button></a>
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
    <meta name="robots" content="index, follow" />
    <meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff" />
    <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#000000" />

    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${url}" />
${alternates}
    <link rel="alternate" hreflang="x-default" href="${enUrl}" />

    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Online Document Editor" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${ORIGIN}/img/pwa-512.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
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
    <script src="/ranui-iife/select.iife.js" defer></script>
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
        <span class="lang-wrap">
          <svg class="langmark" aria-hidden="true" viewBox="0 0 16 16">
            <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" stroke-width="1.5" />
            <path
              d="M1.75 8h12.5M8 1.75c1.7 1.8 2.6 3.9 2.6 6.25S9.7 12.45 8 14.25M8 1.75c-1.7 1.8-2.6 3.9-2.6 6.25s.9 4.45 2.6 6.25"
              fill="none"
              stroke="currentColor"
              stroke-width="1.2"
            />
          </svg>
          <r-select class="lang-select" type="text" value="${locale}" aria-label="${ui.langAria}">
${langOptions}
          </r-select>
        </span>
        <a href="${REPO}" rel="noopener" target="_blank">
          <svg class="ghmark" aria-hidden="true"><use href="#gh-mark"></use></svg> GitHub
        </a>
      </nav>
    </header>

    <div class="page">
      <main class="wrap doc">
        <p class="eyebrow">${escapeHtml(meta.eyebrow || meta.breadcrumb || title)}</p>
        <h1>${escapeHtml(meta.h1 || title)}</h1>
${meta.lead ? `        <p class="lead">${escapeHtml(meta.lead)}</p>\n` : ''}${notice}
        <article>
${body}
        </article>

        <p class="source">${escapeHtml(ui.generatedNote(source))} · <a href="${REPO}/blob/main/${source}" rel="noopener">GitHub</a></p>
      </main>
${aside}    </div>
    <footer class="page-foot">
${footer}
      <a href="${REPO}" rel="noopener">GitHub</a>
      <r-theme-switch class="theme-switch" label="${ui.themeLabel}"></r-theme-switch>
    </footer>
  </body>
</html>
`;
}

export function generate({ outDir = resolve(ROOT, 'public') } = {}) {
  const outputs = [];
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
      const out = renderPage({ page, locale, meta, body: html, headings, faq, source: src });
      const rel = `${LOCALES[locale].prefix}/${page.slug}.html`.replace(/^\//, '');
      outputs.push({ rel, route: routeFor(locale, page.slug), html: out, source: src, locale });
    }
  }
  if (outDir) {
    for (const o of outputs) {
      const target = resolve(outDir, o.rel);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, o.html);
    }
  }
  return outputs;
}

/** True when every committed output matches a fresh render. */
export function check({ publicDir = resolve(ROOT, 'public') } = {}) {
  const stale = [];
  for (const o of generate({ outDir: null })) {
    const target = resolve(publicDir, o.rel);
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
