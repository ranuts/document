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
 * Output is deterministic and NOT committed: the vite plugin `generated-pages`
 * writes it at dev/build time, and .gitignore keeps it out of the repo so a
 * page cannot go stale. The one exception is COMMITTED below -- the root
 * index.html, which Rollup takes as a build entry -- and `--check` is what
 * keeps that one honest.
 *
 *   node bin/build-pages.mjs            # write into public/
 *   node bin/build-pages.mjs --check    # exit 1 if a committed output would change
 *   node bin/build-pages.mjs --out DIR  # write elsewhere (tests)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Marked } from 'marked';
import { HTMLElementMock } from 'ranui/builder';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://edit.chaxus.com';
const REPO = 'https://github.com/ranuts/document';

/**
 * Stable identities for the three things this site is about.
 *
 * Every page used to emit its own anonymous WebApplication / SoftwareSourceCode
 * node, so 154 pages described 154 unrelated applications that happened to
 * share a name. Naming them once and referring to the name instead is what
 * turns a pile of pages into one entity described from many places -- the model
 * apple.com uses (`#organization`, `#website`, `#brand`, then
 * `manufacturer: { "@id": ... }` everywhere else). It matters more to the
 * machines that answer questions about the site than to the ones that rank it:
 * an assistant reading three of our pages should come away with one editor,
 * not three.
 */
const ID = {
  org: `${ORIGIN}/#organization`,
  site: `${ORIGIN}/#website`,
  app: `${ORIGIN}/#app`,
  source: `${ORIGIN}/#source`,
};
const SITE_NAME = 'Online Document Editor';

/** The publisher and the site, identical on every page so they merge into one. */
const siteEntities = () => [
  {
    '@type': 'Organization',
    '@id': ID.org,
    name: 'ranuts',
    url: ORIGIN + '/',
    logo: `${ORIGIN}/img/pwa-512.png`,
    sameAs: [REPO, 'https://github.com/ranuts', 'https://ran.chaxus.com'],
  },
  {
    '@type': 'WebSite',
    '@id': ID.site,
    name: SITE_NAME,
    url: ORIGIN + '/',
    publisher: { '@id': ID.org },
    // The site is one site in seven languages, which is a fact about the site
    // and not about whichever page is being read. Each page states its own
    // language on its WebPage node.
    inLanguage: Object.keys(LOCALES),
  },
];

/**
 * The editor itself. One entity, `url` always the site root -- a per-page url
 * here would make each translation look like a separate product.
 */
const appEntity = (extra = {}) => ({
  '@type': 'WebApplication',
  '@id': ID.app,
  name: SITE_NAME,
  url: ORIGIN + '/',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Any (web browser)',
  browserRequirements: 'Requires a modern browser with WebAssembly support',
  isAccessibleForFree: true,
  inLanguage: Object.keys(LOCALES),
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  // The repository is the editor's other public identity, not the org's.
  sameAs: [REPO],
  publisher: { '@id': ID.org },
  isPartOf: { '@id': ID.site },
  ...extra,
});

/**
 * The same entity, stated with just enough to be a definition rather than a
 * dangling reference. A documentation page is a page ABOUT the editor, not a
 * listing of it -- it should not carry a price and a category and become
 * eligible for an app rich result. But `about: { "@id": ... }` pointing at
 * nothing is silently dropped by the consumer, which puts the page back to
 * describing an anonymous application. So: named, not detailed.
 */
const appStub = () => ({ '@type': 'WebApplication', '@id': ID.app, name: SITE_NAME, url: ORIGIN + '/' });

/** The repository behind it, named so the node merges instead of repeating. */
const sourceEntity = () => ({
  '@type': 'SoftwareSourceCode',
  '@id': ID.source,
  name: SITE_NAME,
  codeRepository: REPO,
  programmingLanguage: 'TypeScript',
  license: 'https://www.gnu.org/licenses/agpl-3.0.html',
  about: { '@id': ID.app },
});

/** Locales the shell knows about. `prefix` is the URL directory; '' = root. */
export const LOCALES = {
  en: { prefix: '', lang: 'en', label: 'English', home: '/', dir: 'ltr', og: 'en_US' },
  'zh-CN': { prefix: '/zh-CN', lang: 'zh-CN', label: '中文', home: '/zh-CN/', dir: 'ltr', og: 'zh_CN' },
  ja: { prefix: '/ja', lang: 'ja', label: '日本語', home: '/ja/', dir: 'ltr', og: 'ja_JP' },
  de: { prefix: '/de', lang: 'de', label: 'Deutsch', home: '/de/', dir: 'ltr', og: 'de_DE' },
  es: { prefix: '/es', lang: 'es', label: 'Español', home: '/es/', dir: 'ltr', og: 'es_ES' },
  ko: { prefix: '/ko', lang: 'ko', label: '한국어', home: '/ko/', dir: 'ltr', og: 'ko_KR' },
  // pt_BR, not pt_PT: the pages, the shell strings and the vendor locale the
  // editor loads (pt.json) are all Brazilian Portuguese.
  pt: { prefix: '/pt', lang: 'pt', label: 'Português', home: '/pt/', dir: 'ltr', og: 'pt_BR' },
};
const DEFAULT_LOCALE = 'en';

/**
 * The order the language menu lists its entries in.
 *
 * Explicit rather than sorted at render time: `localeCompare` answers according
 * to whatever ICU data the host has, so the order could differ between a local
 * build and CI, and a menu that reorders itself is one nobody can learn. Latin
 * endonyms alphabetically first, then the rest -- a reader scanning for their
 * own language is looking for the shape of a word, not reading the list.
 *
 * Every locale in `LOCALES` must appear here; `landing-pages.test.ts` fails if
 * one is added and this is not.
 */
export const MENU_ORDER = ['de', 'en', 'es', 'pt', 'zh-CN', 'ja', 'ko'];

/**
 * Build a markup tree with ranui's own DOM implementation, and serialize it.
 *
 * `HTMLElementMock` rather than the `View()`/`Div()` builders. Those choose
 * between the mock and `document.createElement` by environment, and this file
 * renders the same pages in two of them: node for the real build, jsdom under
 * vitest. A real document lowercases the attribute names of an element made
 * with `createElement`, so `viewBox` -- which SVG reads case-sensitively --
 * came back as `viewbox`, and the two environments produced different bytes for
 * the same page. (The builders have no `createElementNS` path at all, so in a
 * real DOM they cannot construct SVG; worth fixing upstream, but the mock is
 * the right tool here either way -- this is markup generation, not DOM work.)
 *
 * What the ecosystem rule is after still holds: no hand-concatenated HTML, and
 * every attribute and text node escaped on the way out.
 */
const el = (tag, attrs = {}, ...children) => {
  const node = new HTMLElementMock(tag);
  for (const [name, value] of Object.entries(attrs)) {
    // Null means "omit" -- how an attribute only some entries carry is
    // expressed without an if.
    if (value == null) continue;
    node.setAttribute(name, String(value));
  }
  for (const child of children) if (child != null) node.appendChild(child);
  return node;
};

/** A leaf carrying text. Separate because setting text replaces children. */
const textEl = (tag, attrs, content) => {
  const node = el(tag, attrs);
  node.textContent = content;
  return node;
};

/**
 * The language switcher: a disclosure button over a list of real links.
 *
 * Links, not a listbox. Switching language is navigation, so the entries are
 * `<a href>` -- middle-clickable, copyable, crawlable, and readable by assistive
 * tech as the set of links they are. WAI-ARIA's own guidance reserves `menu`
 * (and, further off, `combobox`) for commands and form values; a disclosure over
 * links is the pattern for this. The `<r-select>` this replaces announced itself
 * as a combobox, which is a form field.
 *
 * Each entry carries `lang` so a screen reader pronounces it in that language
 * rather than in the page's -- "日本語" read with English phonetics is noise, and
 * these labels exist precisely for readers who cannot read the current page.
 *
 * Aligned to the trigger's leading edge, so the panel's rows start where the
 * trigger's own label does -- 5px apart, which reads as one column rather than
 * two. It was `bottom-end` first, back when the panel was a guessed 152px wide:
 * that overhung the trigger by 67px on the left, and put the menu's labels 65px
 * off the trigger's. Sizing the panel to its content removed the reason for the
 * end alignment along with the overhang. There is 236px of room to the right of
 * the trigger at desktop width, and on a phone the boundary shift pulls the
 * panel back on screen by itself.
 */
const langMenu = (locale, locales, ui, hrefFor) =>
  el(
    'r-popover',
    {
      class: 'lang-menu',
      placement: 'bottom',
      trigger: 'click',
      // The host *is* the button. r-popover puts `tabindex`, `aria-haspopup`
      // and `aria-expanded` on itself, so a <button> inside it would be a
      // second tab stop carrying the accessible name while the state stayed
      // outside -- a screen reader would never announce "Language, collapsed"
      // as one control. `role` and the name go here instead, which is also what
      // ARIA's disclosure pattern asks for: one button, reporting its own state.
      role: 'button',
      'aria-label': ui.langAria,
    },
    el(
      'span',
      { class: 'lang-trigger' },
      el(
        'svg',
        { class: 'langmark', 'aria-hidden': 'true', viewBox: '0 0 16 16' },
        el('circle', { cx: '8', cy: '8', r: '6.25', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }),
        el('path', {
          d: 'M1.75 8h12.5M8 1.75c1.7 1.8 2.6 3.9 2.6 6.25S9.7 12.45 8 14.25M8 1.75c-1.7 1.8-2.6 3.9-2.6 6.25s.9 4.45 2.6 6.25',
          fill: 'none',
          stroke: 'currentColor',
          'stroke-width': '1.2',
        }),
      ),
      textEl('span', { class: 'lang-current' }, LOCALES[locale].label),
      el(
        'svg',
        { class: 'lang-caret', 'aria-hidden': 'true', viewBox: '0 0 12 12' },
        el('path', {
          d: 'M2.75 4.5 6 7.75 9.25 4.5',
          fill: 'none',
          stroke: 'currentColor',
          'stroke-width': '1.4',
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
        }),
      ),
    ),
    el(
      'r-content',
      {},
      el(
        'div',
        { class: 'lang-list' },
        ...MENU_ORDER.filter((l) => locales.includes(l)).map((l) =>
          textEl(
            'a',
            {
              class: l === locale ? 'lang-option is-current' : 'lang-option',
              href: hrefFor(l),
              lang: LOCALES[l].lang,
              hreflang: LOCALES[l].lang,
              'aria-current': l === locale ? 'page' : null,
            },
            LOCALES[l].label,
          ),
        ),
      ),
    ),
  ).serialize();

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
      ['/onlyoffice-online-free', 'ONLYOFFICE online'],
      ['/edit-documents-without-account', 'No account'],
      ['/embed-document-editor', 'Embed API'],
    ],
    generatedNote: (src) => `Source: ${src} in the repository`,
    ossNote: `<strong>Open source &amp; self-hostable.</strong> Under AGPL-3.0 — verify that nothing is uploaded, or run your own copy: <a href="${REPO}" rel="noopener">github.com/ranuts/document</a>.`,
    trademark: `ONLYOFFICE is a trademark of Ascensio System SIA. This site is not an official ONLYOFFICE product and is not affiliated with or endorsed by Ascensio System SIA.`,
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
      ['/zh-CN/onlyoffice-online-free', 'OnlyOffice 在线版'],
      ['/zh-CN/edit-documents-without-account', '免账号'],
      ['/zh-CN/embed-document-editor', 'Embed API'],
    ],
    generatedNote: (src) => `来源：仓库中的 ${src}`,
    ossNote: `<strong>开源 · 可自托管。</strong>采用 AGPL-3.0——你可以核实没有任何上传，或者自建一份：<a href="${REPO}" rel="noopener">github.com/ranuts/document</a>。`,
    trademark: `ONLYOFFICE 是 Ascensio System SIA 的商标。本站并非官方 ONLYOFFICE 产品，与 Ascensio System SIA 无隶属关系，也未获其背书。`,
  },
  ja: {
    siteName: 'Document Editor',
    langAria: '言語',
    themeLabel: 'テーマ',
    home: 'ホーム',
    openEditor: 'エディタを開く',
    onThisPage: 'このページの目次',
    more: '関連ページ',
    sideNote: 'お使いの端末で動作します。アップロードなし、登録不要。',
    footer: [
      ['/ja/', 'エディタを開く'],
      ['/ja/help', 'ヘルプ'],
      ['/ja/changelog', '変更履歴'],
      ['/ja/open/docx', 'DOCX を開く'],
      ['/ja/open/xlsx', 'XLSX を開く'],
      ['/ja/open/pptx', 'PPTX を開く'],
      ['/ja/open/pdf', 'PDF を開く'],
      ['/ja/convert/xlsx-to-csv', 'XLSX を CSV に'],
      ['/ja/convert/csv-to-xlsx', 'CSV を XLSX に'],
      ['/ja/no-signup-document-editor', '登録不要'],
      ['/ja/private-document-editor', 'プライバシー'],
      ['/ja/offline-document-editor', 'オフライン'],
      ['/ja/edit-documents-without-account', 'アカウント不要'],
      ['/ja/embed-document-editor', 'Embed API'],
    ],
    generatedNote: (src) => `ソース: リポジトリの ${src}`,
    ossNote: `<strong>オープンソース・セルフホスト可能。</strong>AGPL-3.0 のもとで公開——何もアップロードされないことを自分で確認でき、自分で運用することもできます: <a href="${REPO}" rel="noopener">github.com/ranuts/document</a>。`,
    trademark: `ONLYOFFICE は Ascensio System SIA の商標です。本サイトは公式の ONLYOFFICE 製品ではなく、Ascensio System SIA との提携も推奨関係もありません。`,
  },
  de: {
    siteName: 'Document Editor',
    langAria: 'Sprache',
    themeLabel: 'Design',
    home: 'Startseite',
    openEditor: 'Editor öffnen',
    onThisPage: 'Auf dieser Seite',
    more: 'Verwandte Seiten',
    sideNote: 'Läuft auf Ihrem Gerät. Kein Upload, keine Anmeldung.',
    footer: [
      ['/de/', 'Editor öffnen'],
      ['/de/help', 'Hilfe'],
      ['/de/changelog', 'Änderungen'],
      ['/de/open/docx', 'DOCX öffnen'],
      ['/de/open/xlsx', 'XLSX öffnen'],
      ['/de/open/pptx', 'PPTX öffnen'],
      ['/de/open/pdf', 'PDF öffnen'],
      ['/de/convert/xlsx-to-csv', 'XLSX zu CSV'],
      ['/de/convert/csv-to-xlsx', 'CSV zu XLSX'],
      ['/de/no-signup-document-editor', 'Ohne Anmeldung'],
      ['/de/private-document-editor', 'Datenschutz'],
      ['/de/offline-document-editor', 'Offline'],
      ['/de/edit-documents-without-account', 'Ohne Konto'],
      ['/de/embed-document-editor', 'Embed API'],
    ],
    generatedNote: (src) => `Quelle: ${src} im Repository`,
    ossNote: `<strong>Open Source &amp; selbst hostbar.</strong> Unter AGPL-3.0 — prüfen Sie selbst, dass nichts hochgeladen wird, oder betreiben Sie eine eigene Kopie: <a href="${REPO}" rel="noopener">github.com/ranuts/document</a>.`,
    trademark: `ONLYOFFICE ist eine Marke von Ascensio System SIA. Diese Website ist kein offizielles ONLYOFFICE-Produkt und steht in keiner Verbindung zu Ascensio System SIA.`,
  },
  es: {
    siteName: 'Document Editor',
    langAria: 'Idioma',
    themeLabel: 'Tema',
    home: 'Inicio',
    openEditor: 'Abrir el editor',
    onThisPage: 'En esta página',
    more: 'Páginas relacionadas',
    sideNote: 'Funciona en tu dispositivo. Sin subidas, sin registro.',
    footer: [
      ['/es/', 'Abrir el editor'],
      ['/es/help', 'Ayuda'],
      ['/es/changelog', 'Novedades'],
      ['/es/open/docx', 'Abrir DOCX'],
      ['/es/open/xlsx', 'Abrir XLSX'],
      ['/es/open/pptx', 'Abrir PPTX'],
      ['/es/open/pdf', 'Abrir PDF'],
      ['/es/convert/xlsx-to-csv', 'XLSX a CSV'],
      ['/es/convert/csv-to-xlsx', 'CSV a XLSX'],
      ['/es/no-signup-document-editor', 'Sin registro'],
      ['/es/private-document-editor', 'Privacidad'],
      ['/es/offline-document-editor', 'Sin conexión'],
      ['/es/edit-documents-without-account', 'Sin cuenta'],
      ['/es/embed-document-editor', 'Embed API'],
    ],
    generatedNote: (src) => `Fuente: ${src} en el repositorio`,
    ossNote: `<strong>Código abierto y autoalojable.</strong> Bajo AGPL-3.0: comprueba que no se sube nada, o ejecuta tu propia copia: <a href="${REPO}" rel="noopener">github.com/ranuts/document</a>.`,
    trademark: `ONLYOFFICE es una marca de Ascensio System SIA. Este sitio no es un producto oficial de ONLYOFFICE ni está afiliado a Ascensio System SIA ni respaldado por ella.`,
  },
  ko: {
    siteName: 'Document Editor',
    langAria: '언어',
    themeLabel: '테마',
    home: '홈',
    openEditor: '편집기 열기',
    onThisPage: '이 페이지의 목차',
    more: '관련 페이지',
    sideNote: '기기에서 실행됩니다. 업로드 없음, 가입 불필요.',
    footer: [
      ['/ko/', '편집기 열기'],
      ['/ko/help', '도움말'],
      ['/ko/changelog', '변경 내역'],
      ['/ko/open/docx', 'DOCX 열기'],
      ['/ko/open/xlsx', 'XLSX 열기'],
      ['/ko/open/pptx', 'PPTX 열기'],
      ['/ko/open/pdf', 'PDF 열기'],
      ['/ko/convert/xlsx-to-csv', 'XLSX를 CSV로'],
      ['/ko/convert/csv-to-xlsx', 'CSV를 XLSX로'],
      ['/ko/no-signup-document-editor', '가입 불필요'],
      ['/ko/private-document-editor', '개인정보'],
      ['/ko/offline-document-editor', '오프라인'],
      ['/ko/edit-documents-without-account', '계정 불필요'],
      ['/ko/embed-document-editor', 'Embed API'],
    ],
    generatedNote: (src) => `출처: 저장소의 ${src}`,
    ossNote: `<strong>오픈 소스이며 직접 호스팅할 수 있습니다.</strong> AGPL-3.0으로 공개되어 있어, 아무것도 업로드되지 않는다는 것을 직접 확인하거나 직접 운영할 수 있습니다: <a href="${REPO}" rel="noopener">github.com/ranuts/document</a>.`,
    trademark: `ONLYOFFICE는 Ascensio System SIA의 상표입니다. 이 사이트는 공식 ONLYOFFICE 제품이 아니며 Ascensio System SIA와 제휴하거나 후원받지 않았습니다.`,
  },
  pt: {
    siteName: 'Document Editor',
    langAria: 'Idioma',
    themeLabel: 'Tema',
    home: 'Início',
    openEditor: 'Abrir o editor',
    onThisPage: 'Nesta página',
    more: 'Páginas relacionadas',
    sideNote: 'Roda no seu dispositivo. Sem uploads, sem cadastro.',
    footer: [
      ['/pt/', 'Abrir o editor'],
      ['/pt/help', 'Ajuda'],
      ['/pt/changelog', 'Novidades'],
      ['/pt/open/docx', 'Abrir DOCX'],
      ['/pt/open/xlsx', 'Abrir XLSX'],
      ['/pt/open/pptx', 'Abrir PPTX'],
      ['/pt/open/pdf', 'Abrir PDF'],
      ['/pt/convert/xlsx-to-csv', 'XLSX para CSV'],
      ['/pt/convert/csv-to-xlsx', 'CSV para XLSX'],
      ['/pt/no-signup-document-editor', 'Sem cadastro'],
      ['/pt/private-document-editor', 'Privacidade'],
      ['/pt/offline-document-editor', 'Offline'],
      ['/pt/edit-documents-without-account', 'Sem conta'],
      ['/pt/embed-document-editor', 'Embed API'],
    ],
    generatedNote: (src) => `Fonte: ${src} no repositório`,
    ossNote: `<strong>Código aberto e auto-hospedável.</strong> Sob a AGPL-3.0 — confira você mesmo que nada é enviado, ou rode a sua própria cópia: <a href="${REPO}" rel="noopener">github.com/ranuts/document</a>.`,
    trademark: `ONLYOFFICE é uma marca da Ascensio System SIA. Este site não é um produto oficial do ONLYOFFICE nem tem afiliação ou endosso da Ascensio System SIA.`,
  },
};

/**
 * Pages to generate. `sources` may point at any markdown file in the repo;
 * frontmatter (title / description / eyebrow / breadcrumb) is optional and
 * can be overridden per locale in `meta`. When a locale has no source of its
 * own it may reuse another (e.g. the changelog is maintained in English only)
 * -- `notice` is then rendered above the body.
 */
/**
 * Landing-page slugs, in the order they were written. The list is explicit
 * rather than a directory scan so a stray markdown file cannot quietly become
 * a public page, and so the order the sitemap and llms.txt see is stable.
 */
export const LANDING_SLUGS = [
  'offline-document-editor',
  // en + zh only, on purpose: this one targets people searching for ONLYOFFICE
  // itself, and the shell derives hreflang and the language switch from the
  // sources a page actually has (see `translations` in renderPage), so a page
  // in two languages stays correct in two languages.
  'onlyoffice-online-free',
  'no-signup-document-editor',
  'private-document-editor',
  'edit-documents-without-account',
  'embed-document-editor',
  'webmcp-document-editor',
  'open/docx',
  'open/xlsx',
  'open/pptx',
  'open/pdf',
  'open/odt',
  'open/ods',
  'open/odp',
  'convert/docx-to-pdf',
  'convert/xlsx-to-pdf',
  'convert/pptx-to-pdf',
  'convert/xlsx-to-csv',
  'convert/csv-to-xlsx',
];

export const PAGES = [
  {
    slug: 'help',
    sources: {
      en: 'content/en/help.md',
      'zh-CN': 'content/zh-CN/help.md',
      ja: 'content/ja/help.md',
      de: 'content/de/help.md',
      es: 'content/es/help.md',
      ko: 'content/ko/help.md',
      pt: 'content/pt/help.md',
    },
  },
  {
    slug: 'help/embed-api',
    sources: {
      en: 'docs/embed-api.md',
      'zh-CN': 'docs/embed-api.zh.md',
      ja: 'docs/embed-api.md',
      de: 'docs/embed-api.md',
      es: 'docs/embed-api.md',
      ko: 'docs/embed-api.md',
      pt: 'docs/embed-api.md',
    },
    meta: {
      en: {
        title: 'Embed API — iframe + postMessage reference',
        description:
          'Reference for embedding the document editor in your own web app: iframe setup, postMessage commands (open URL/File/buffer, read-only, save), responses and origin restriction.',
        eyebrow: 'Help · Embed API',
        breadcrumb: 'Embed API',
        parent: { href: '/help', name: 'Help' },
      },
      ko: {
        title: 'Embed API — iframe + postMessage 참고',
        description:
          '내 웹 앱에 문서 편집기를 임베드하기 위한 참고 문서: iframe 설정, postMessage 명령(URL/File/buffer로 열기, 읽기 전용, 저장), 응답, 오리진 제한.',
        eyebrow: '도움말 · Embed API',
        breadcrumb: 'Embed API',
        parent: { href: '/ko/help', name: '도움말' },
        notice: 'Embed API 참고 문서는 영어로 관리됩니다(단일 출처). 한국어판은 추후 추가됩니다.',
      },
      pt: {
        title: 'Embed API — referência de iframe + postMessage',
        description:
          'Referência para incorporar o editor de documentos no seu app web: configuração do iframe, comandos postMessage (abrir de URL/File/buffer, somente leitura, salvar), respostas e restrição de origem.',
        eyebrow: 'Ajuda · Embed API',
        breadcrumb: 'Embed API',
        parent: { href: '/pt/help', name: 'Ajuda' },
        notice: 'A referência da Embed API é mantida em inglês (fonte única). A versão em português virá depois.',
      },
      de: {
        title: 'Embed API — Referenz zu iframe + postMessage',
        description:
          'Referenz zum Einbetten des Dokumenteneditors in Ihre eigene Web-App: iframe-Einrichtung, postMessage-Befehle (aus URL/File/Buffer öffnen, schreibgeschützt, speichern), Antworten und Origin-Beschränkung.',
        eyebrow: 'Hilfe · Embed API',
        breadcrumb: 'Embed API',
        parent: { href: '/de/help', name: 'Hilfe' },
        notice: 'Die Embed-API-Referenz wird auf Englisch gepflegt (eine einzige Quelle). Eine deutsche Fassung folgt.',
      },
      es: {
        title: 'Embed API — referencia de iframe + postMessage',
        description:
          'Referencia para integrar el editor de documentos en tu propia aplicación web: configuración del iframe, comandos postMessage (abrir desde URL/File/buffer, solo lectura, guardar), respuestas y restricción de origen.',
        eyebrow: 'Ayuda · Embed API',
        breadcrumb: 'Embed API',
        parent: { href: '/es/help', name: 'Ayuda' },
        notice:
          'La referencia de la Embed API se mantiene en inglés (una única fuente). La versión en español llegará más adelante.',
      },
      ja: {
        title: 'Embed API — iframe + postMessage リファレンス',
        description:
          '自分の Web アプリにドキュメントエディタを埋め込むためのリファレンス: iframe の設定、postMessage コマンド（URL / File / buffer から開く、読み取り専用、保存）、応答、オリジン制限。',
        eyebrow: 'ヘルプ · Embed API',
        breadcrumb: 'Embed API',
        parent: { href: '/ja/help', name: 'ヘルプ' },
        notice: 'Embed API リファレンスは英語で管理されています（単一の情報源）。日本語版は今後追加します。',
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
    sources: {
      en: 'CHANGELOG.md',
      'zh-CN': 'CHANGELOG.md',
      ja: 'CHANGELOG.md',
      de: 'CHANGELOG.md',
      es: 'CHANGELOG.md',
      ko: 'CHANGELOG.md',
      pt: 'CHANGELOG.md',
    },
    meta: {
      en: {
        title: 'Changelog — what changed in the online document editor',
        description:
          'User-facing release notes for edit.chaxus.com: new formats, editor fixes, performance and privacy changes, in reverse chronological order.',
        eyebrow: 'Changelog',
        breadcrumb: 'Changelog',
      },
      ko: {
        title: '변경 내역 — 온라인 문서 편집기가 무엇이 달라졌나',
        description:
          'edit.chaxus.com의 사용자 대상 릴리스 노트: 새 형식, 편집기 수정, 성능과 프라이버시 변경 사항을 최신순으로 정리했습니다.',
        eyebrow: '변경 내역',
        breadcrumb: '변경 내역',
        notice: '변경 내역은 영어로 관리됩니다(단일 출처 CHANGELOG.md). 한국어판은 추후 추가됩니다.',
      },
      pt: {
        title: 'Novidades — o que mudou no editor de documentos online',
        description:
          'Notas de versão do edit.chaxus.com: novos formatos, correções do editor, mudanças de desempenho e privacidade, em ordem cronológica inversa.',
        eyebrow: 'Novidades',
        breadcrumb: 'Novidades',
        notice: 'As novidades são mantidas em inglês (fonte única, CHANGELOG.md). A versão em português virá depois.',
      },
      de: {
        title: 'Änderungen — was sich im Online-Dokumenteneditor geändert hat',
        description:
          'Versionshinweise für edit.chaxus.com: neue Formate, Korrekturen im Editor, Änderungen an Leistung und Datenschutz, in umgekehrt chronologischer Reihenfolge.',
        eyebrow: 'Änderungen',
        breadcrumb: 'Änderungen',
        notice:
          'Die Änderungen werden auf Englisch gepflegt (eine einzige Quelle, CHANGELOG.md). Eine deutsche Fassung folgt.',
      },
      es: {
        title: 'Novedades — qué ha cambiado en el editor de documentos en línea',
        description:
          'Notas de versión de edit.chaxus.com: formatos nuevos, correcciones del editor, cambios de rendimiento y privacidad, en orden cronológico inverso.',
        eyebrow: 'Novedades',
        breadcrumb: 'Novedades',
        notice:
          'Las novedades se mantienen en inglés (una única fuente, CHANGELOG.md). La versión en español llegará más adelante.',
      },
      ja: {
        title: '変更履歴 — オンラインドキュメントエディタの更新内容',
        description:
          'edit.chaxus.com のユーザー向けリリースノート: 新しい形式、エディタの修正、パフォーマンスとプライバシーの変更を、新しい順に掲載しています。',
        eyebrow: '変更履歴',
        breadcrumb: '変更履歴',
        notice: '変更履歴は英語で管理されています（単一の情報源 CHANGELOG.md）。日本語版は今後追加します。',
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
  // The SEO landing pages. They were 36 hand-written HTML files (18 slugs x 2
  // locales) with the same shell copy-pasted into each: canonical, hreflang,
  // JSON-LD, top bar, rail, footer. That is maintainable at two languages and
  // not at eight -- every fix had to be applied 2n times, and adding a locale
  // meant writing 18 more files by hand. The copy now lives in content/<locale>/,
  // and everything around it comes from this shell like /help does.
  ...LANDING_SLUGS.map((slug) => ({
    slug,
    kind: 'landing',
    sources: Object.fromEntries(
      Object.keys(LOCALES)
        .filter((locale) => existsSync(resolve(ROOT, `content/${locale}/${slug}.md`)))
        .map((locale) => [locale, `content/${locale}/${slug}.md`]),
    ),
  })),
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

/** Inline markdown only (no <p> wrapper): used for the lead paragraph. */
function renderInline(md) {
  return new Marked({ gfm: true, breaks: false }).parseInline(md).trim();
}

/**
 * Give the FAQ section the markup the hand-written pages had: the heading
 * carries `class="faq"` and its question/answer pairs sit in a `.faq` block,
 * which is what draws the hairline between questions (landing.css). The
 * section is found by its content -- the first question-shaped h3 -- rather
 * than by a magic heading string, so it works in every language.
 */
function wrapFaqSection(html) {
  const first = html.search(/<h3 id="[^"]*">[^<]*[?？]<\/h3>/);
  if (first < 0) return html;
  const start = html.lastIndexOf('<h2', first);
  if (start < 0) return html;
  const headingEnd = html.indexOf('</h2>', start) + '</h2>'.length;
  const heading = html.slice(start, headingEnd).replace('<h2 ', '<h2 class="faq" ');
  return `${html.slice(0, start)}${heading}\n<div class="faq">\n${html.slice(headingEnd).trim()}\n</div>\n`;
}

/**
 * Plain text out of rendered HTML. Structured data carries text, not markup,
 * and it must read as the page reads: marked escapes an apostrophe to &#39;,
 * which would otherwise reach Google's parser literally.
 */
function textOf(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The first ordered list on the page: the "how it works" steps. Feeds HowTo. */
function extractSteps(html) {
  const list = /<ol>([\s\S]*?)<\/ol>/.exec(html);
  if (!list) return [];
  return [...list[1].matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => textOf(m[1]));
}

/** FAQ pairs: an h3 ending in ?/？ followed by a paragraph. Feeds FAQPage JSON-LD. */
function extractFaq(html) {
  const out = [];
  const re = /<h3 id="[^"]*">([^<]*[?？])<\/h3>\s*<p>([\s\S]*?)<\/p>/g;
  let m;
  while ((m = re.exec(html))) {
    out.push({ q: textOf(m[1]), a: textOf(m[2]) });
  }
  return out;
}

const GH_MARK =
  'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z';

function routeFor(locale, slug) {
  return `${LOCALES[locale].prefix}/${slug}`;
}

/**
 * The homepage.
 *
 * It is not prose, so it is not markdown: every string on it sits in a fixed
 * slot (a hero line, a row of the format index, one of four pillars), and the
 * decoration around them -- the CSS document window, the reveal classes, the
 * prefetch hooks -- is layout, not content. content/<locale>/home.json holds
 * exactly the strings; this holds exactly the structure. Adding a language is
 * then one JSON file rather than one more 520-line HTML file to keep in step.
 */
function renderHome({ locale, data, locales }) {
  const L = LOCALES[locale];
  const ui = UI[locale];
  const home = L.home;
  const url = ORIGIN + home;
  const e = escapeHtml;
  /**
   * Links into the app carry the locale. The app's own i18n resolves its
   * language from `?locale=` first (then cookie, then localStorage, then
   * navigator.language), so without this a visitor who chose Japanese on the
   * site would land in an editor guessing from browser settings -- which is
   * how the hand-written Chinese homepage always did it, and what the first
   * generated version of this template dropped.
   */
  const editor = (query) => `/editor?${locale === DEFAULT_LOCALE ? '' : `locale=${locale}&`}${query}`;
  const alternates = locales
    .map((l) => `    <link rel="alternate" hreflang="${l}" href="${ORIGIN + LOCALES[l].home}" />`)
    .join('\n');
  const ogAlternates = locales
    .filter((l) => l !== locale)
    .map((l) => `    <meta property="og:locale:alternate" content="${LOCALES[l].og}" />`)
    .join('\n');

  const graph = [
    ...siteEntities(),
    appEntity({
      description: data.description,
      ...(data.featureList ? { featureList: data.featureList } : {}),
      ...(data.ecosystem
        ? { isPartOf: [{ '@id': ID.site }, { '@type': 'SoftwareApplication', ...data.ecosystem }] }
        : {}),
    }),
    // This page: one homepage per language, each pointing at the same app.
    {
      '@type': 'WebPage',
      '@id': `${url}#webpage`,
      url,
      name: data.title,
      description: data.description,
      inLanguage: L.lang,
      isPartOf: { '@id': ID.site },
      about: { '@id': ID.app },
      primaryImageOfPage: `${ORIGIN}/img/pwa-512.png`,
    },
    {
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      inLanguage: L.lang,
      mainEntity: data.sections.faq.items.map(({ q, a }) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    },
    sourceEntity(),
  ];
  const jsonLd = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2)
    .split('\n')
    .map((l) => '      ' + l)
    .join('\n');

  const rows = data.sections.formats.rows
    .map(
      (r) => `          <a class="row" href="${e(r.href)}">
            <span class="ext">${e(r.ext)}</span>
            <span class="name">${e(r.name)}</span>
            <span class="desc">${e(r.desc)}</span>
            <span class="go" aria-hidden="true">&rarr;</span>
          </a>`,
    )
    .join('\n');
  const pillars = data.sections.pillars.items
    .map(
      (p) => `          <div class="pillar">
            <span class="k">${e(p.k)}</span>
            <h3>${e(p.h3)}</h3>
            <p>${e(p.p)}</p>
          </div>`,
    )
    .join('\n');
  const steps = data.sections.steps.items
    .map(
      (st) => `          <div class="step">
            <div class="n">${e(st.n)}</div>
            <h3>${e(st.h3)}</h3>
            <p>${e(st.p)}</p>
            <span class="loc">${e(st.loc)}</span>
          </div>`,
    )
    .join('\n');
  const faq = data.sections.faq.items
    .map(
      (f, i) => `            <details${i === 0 ? ' open' : ''}>
              <summary>${e(f.q)}</summary>
              <p class="a">${e(f.a)}</p>
            </details>`,
    )
    .join('\n');
  const nav = data.nav.map((l) => `            <a class="navlink" href="${e(l.href)}">${e(l.label)}</a>`).join('\n');
  const footLinks = data.foot.links.map((l) => `          <a href="${e(l.href)}">${e(l.label)}</a>`).join('\n');
  const trust = data.trust.map((t) => `<span>${e(t)}</span>`).join('');

  return `<!doctype html>
<!-- GENERATED by bin/build-pages.mjs from content/${locale}/home.json -- edit the JSON, not this file. -->
<html lang="${L.lang}" dir="${L.dir}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link href="/img/64.png" rel="shortcut icon" />
    <link rel="icon" type="image/png" href="/img/64.png" />
    <link rel="manifest" href="/manifest.json" />
    <!-- Route split: this is a static landing page, /editor hosts the app. Deep
         links that used to target it (?file= ?src= ?new= ?open=local ?embed=
         ?embedded= ?readonly ?agent) and any embedding iframe keep working:
         hand them to /editor with the same query before anything renders. -->
    <script>
      (function () {
        try {
          var q = location.search;
          var deep = /[?&](file|src|new|open|embed|embedded|readonly|agent)(=|&|$)/.test(q);
          var framed = window.parent !== window;
          if (deep || framed) {
            location.replace('/editor' + (q || (framed ? '?embed=1' : '')) + location.hash);
          }
        } catch (e) {}
      })();
    </script>
    <meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff" />
    <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#000000" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black" />

    <title>${e(data.title)}</title>
    <meta name="description" content="${e(data.description)}" />
    <link rel="canonical" href="${url}" />
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
${alternates}
    <link rel="alternate" hreflang="x-default" href="${ORIGIN + LOCALES[DEFAULT_LOCALE].home}" />
    <!-- No-flash theme restore: apply a forced light/dark before first paint so a
         dark-mode visitor never sees a white flash. -->
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
    <link rel="stylesheet" href="/home.css" />

    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Online Document Editor" />
    <meta property="og:locale" content="${L.og}" />
${ogAlternates}
    <meta property="og:title" content="${e(data.title)}" />
    <meta property="og:description" content="${e(data.ogDescription || data.description)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${ORIGIN}/img/pwa-512.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${e(data.title)}" />
    <meta name="twitter:description" content="${e(data.ogDescription || data.description)}" />
    <meta name="twitter:image" content="${ORIGIN}/img/pwa-512.png" />

    <script type="application/ld+json">
${jsonLd}
    </script>

    <script src="/ranui-iife/button.iife.js" defer></script>
    <script src="/ranui-iife/popover.iife.js" defer></script>
    <script src="/ranui-iife/content.iife.js" defer></script>
    <script src="/ranui-iife/theme-switch.iife.js" defer></script>
    <script src="/lang-switch.js" defer></script>
    <script src="/open-local.js" defer></script>
    <script src="/landing-prefetch.js" defer></script>
    <script src="/history-recent.js" defer></script>
  </head>

  <body>
    <svg width="0" height="0" style="position: absolute" aria-hidden="true">
      <symbol id="gh-mark" viewBox="0 0 16 16">
        <path d="${GH_MARK}" />
      </symbol>
    </svg>
    <section id="landing-hero">
      <header class="bar">
        <div class="wrap">
          <a class="brand" href="${home}"><span class="logo">D</span>${e(ui.siteName)}</a>
          <nav>
${nav}
            <a class="navlink gh" href="${REPO}" rel="noopener" target="_blank">
              <svg class="ghmark" aria-hidden="true"><use href="#gh-mark"></use></svg> GitHub
            </a>
${langMenu(locale, locales, ui, (l) => LOCALES[l].home)}
          </nav>
        </div>
      </header>

      <div class="hero wrap">
        <div class="hero-copy">
          <span class="chip reveal d1"><span class="dot"></span>${data.chip}</span>
          <h1 class="reveal d2">${e(data.h1.plain)} <span class="accent">${e(data.h1.accent)}</span></h1>
          <p class="sub reveal d3">${e(data.sub)}</p>
          <div class="cta reveal d4">
            <r-button type="primary" id="hero-open" data-open-local="${editor('open=local')}">${e(data.cta.open)}</r-button>
            <a href="${editor('new=docx')}" data-prefetch="docx"><r-button id="hero-new-docx">${e(data.cta.docx)}</r-button></a>
            <a href="${editor('new=xlsx')}" data-prefetch="xlsx"><r-button id="hero-new-xlsx">${e(data.cta.xlsx)}</r-button></a>
            <a href="${editor('new=pptx')}" data-prefetch="pptx"><r-button id="hero-new-pptx">${e(data.cta.pptx)}</r-button></a>
          </div>
          <!-- Autosave is a promise about the user's data, so it is served HTML
               rather than drawn by script: the retention window and the way to
               inspect and delete what is kept are visible to a first-time
               visitor, to a crawler, and with JavaScript off. -->
          <div class="recent reveal d5">
            <span data-recent-slot data-recent-label="${e(data.recent.label)}" hidden></span>
            <span class="recent-note">${e(data.recent.note)}</span>
            <a class="recent-all" href="${locale === DEFAULT_LOCALE ? '/history' : `/history?locale=${locale}`}"
              >${e(data.recent.all)}</a
            >
          </div>
          <div class="trust reveal d5">${trust}</div>
        </div>

        <!-- Decorative "document being edited locally" window -- pure CSS, no JS. -->
        <div class="docwin reveal d3" aria-hidden="true">
          <div class="dw-bar">
            <span class="dw-dots"><i></i><i></i><i></i></span>
            <span class="dw-file">${e(data.docwin.file)}</span>
            <span class="dw-badge">${e(data.docwin.badge)}</span>
          </div>
          <div class="dw-tabs"><span class="on">.docx</span><span>.xlsx</span><span>.pptx</span><span>.csv</span></div>
          <div class="dw-body">
            <div class="dw-sheet">
              <span class="dl t"></span>
              <span class="dl w92"></span>
              <span class="dl w78"></span>
              <p class="dw-text"><mark>${e(data.docwin.selected)}</mark><i class="caret"></i></p>
              <span class="dl w85"></span>
              <span class="dl w60"></span>
              <span class="dl t2"></span>
              <span class="dl w88"></span>
              <span class="dl w92"></span>
              <span class="dl w70"></span>
            </div>
            <aside class="dw-note">
              <b>${e(data.docwin.noteAuthor)}</b>
              <span>${e(data.docwin.noteBody)}</span>
            </aside>
          </div>
          <div class="dw-net"><i class="ok"></i>${e(data.docwin.net)}</div>
        </div>
      </div>

      <div class="section wrap">
        <div class="section-head">
          <span class="eyebrow">${e(data.sections.formats.eyebrow)}</span>
          <h2>${e(data.sections.formats.h2)}</h2>
        </div>
        <div class="index">
${rows}
        </div>
      </div>

      <div class="section wrap">
        <div class="section-head">
          <span class="eyebrow">${e(data.sections.pillars.eyebrow)}</span>
          <h2>${e(data.sections.pillars.h2)}</h2>
        </div>
        <div class="pillars">
${pillars}
        </div>
      </div>

      <div class="section wrap">
        <div class="section-head">
          <span class="eyebrow">${e(data.sections.steps.eyebrow)}</span>
          <h2>${e(data.sections.steps.h2)}</h2>
        </div>
        <div class="steps">
${steps}
        </div>
      </div>

      <div class="section wrap faq-sec">
        <div class="section-head">
          <span class="eyebrow">${e(data.sections.faq.eyebrow)}</span>
          <h2>${e(data.sections.faq.h2)}</h2>
          <p class="head-note">${data.sections.faq.note}</p>
        </div>
        <div class="faq">
          <div class="qa">
${faq}
          </div>
        </div>
      </div>

      <div class="eco">
        <div class="wrap">
          <span class="eco-label">
            <svg class="gitmark" aria-hidden="true"><use href="#gh-mark"></use></svg>
            ${e(data.eco.label)}
          </span>
          <nav>
            <span class="here"><b>${e(data.eco.here.name)}</b> <small>${e(data.eco.here.role)}</small></span>
            <a href="${e(data.eco.other.href)}" rel="noopener" target="_blank">
              <b>${e(data.eco.other.name)}</b> <small>${e(data.eco.other.role)}</small>
            </a>
          </nav>
        </div>
      </div>

      <footer class="foot wrap">
        <span>${e(data.foot.copy)}</span>
        <nav>
${footLinks}
        </nav>
        <r-theme-switch class="theme-switch" label="${e(ui.themeLabel)}"></r-theme-switch>
        <span class="lic">${e(data.foot.license)}</span>
        <p class="tm">${e(ui.trademark)}</p>
      </footer>
    </section>

    <!-- Registers the service worker (so the landing works offline / installs as
         an app) and promotes a waiting one, which is what makes a deploy reach a
         returning visitor. See public/sw-register.js. -->
    <script src="/sw-register.js" defer></script>
  </body>
</html>
`;
}

function renderPage({ page, locale, meta, body, headings, faq, steps, source }) {
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
