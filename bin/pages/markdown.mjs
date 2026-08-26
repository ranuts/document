/**
 * Markdown in, page-ready HTML out: frontmatter, the renderer, and the small
 * extractors the templates need (headings for the rail, FAQ and steps for
 * the structured data).
 */
import { Marked } from 'marked';
import { ORIGIN } from './constants.mjs';

export const escapeHtml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Minimal frontmatter: `---\nkey: value\n---` with scalar values only. */
export function parseFrontmatter(md) {
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

export const slugify = (text) =>
  String(text)
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '') || 'section';

/** Render markdown to HTML with heading ids (for a table of contents / deep links). */
export function renderMarkdown(md, { stripFirstHeading = false } = {}) {
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
export function renderInline(md) {
  return new Marked({ gfm: true, breaks: false }).parseInline(md).trim();
}

/**
 * Give the FAQ section the markup the hand-written pages had: the heading
 * carries `class="faq"` and its question/answer pairs sit in a `.faq` block,
 * which is what draws the hairline between questions (landing.css). The
 * section is found by its content -- the first question-shaped h3 -- rather
 * than by a magic heading string, so it works in every language.
 */
export function wrapFaqSection(html) {
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
export function textOf(html) {
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
export function extractSteps(html) {
  const list = /<ol>([\s\S]*?)<\/ol>/.exec(html);
  if (!list) return [];
  return [...list[1].matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => textOf(m[1]));
}

/** FAQ pairs: an h3 ending in ?/？ followed by a paragraph. Feeds FAQPage JSON-LD. */
export function extractFaq(html) {
  const out = [];
  const re = /<h3 id="[^"]*">([^<]*[?？])<\/h3>\s*<p>([\s\S]*?)<\/p>/g;
  let m;
  while ((m = re.exec(html))) {
    out.push({ q: textOf(m[1]), a: textOf(m[2]) });
  }
  return out;
}
