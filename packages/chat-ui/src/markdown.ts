import { Lexer, type Token, type Tokens } from 'marked';
import { MarkdownPresentation } from './markdown-presentation';
const presentations = new WeakMap<HTMLElement, MarkdownPresentation>();

/** Only a syntactically closed fence is safe to color while a response is still streaming. */
export function closedCodeFence(raw: string): boolean {
  const fence = raw.match(/^ {0,3}(`{3,}|~{3,})[^\n]*\n/);
  return !!fence && new RegExp('(?:^|\\n) {0,3}' + fence[1][0] + '{' + fence[1].length + ',} *\\n?$').test(raw);
}
/** Whether finalization changes any provisional rendering decision, at every nesting level. */
export function completeMarkdownTokens(tokens: Token[]): boolean {
  return tokens.every((token) => {
    if (token.type === 'code') return closedCodeFence(token.raw);
    if (
      token.type === 'link' &&
      !(
        (token.raw.startsWith('[') && token.raw.endsWith(')')) ||
        (token.raw.startsWith('<') && token.raw.endsWith('>'))
      )
    )
      return false;
    if (token.type === 'list') return (token as Tokens.List).items.every((item) => completeMarkdownTokens(item.tokens));
    if (token.type === 'table') {
      const table = token as Tokens.Table;
      return [...table.header, ...table.rows.flat()].every((cell) => completeMarkdownTokens(cell.tokens));
    }
    return !('tokens' in token) || !Array.isArray(token.tokens) || completeMarkdownTokens(token.tokens);
  });
}
function alignCell(cell: HTMLElement, alignment: unknown): void {
  if (alignment === 'left' || alignment === 'center' || alignment === 'right') cell.style.textAlign = alignment;
}
/** Render Markdown tokens into DOM. No model-supplied HTML is parsed or executed. */
export function renderMarkdown(target: HTMLElement, text: string, presentation?: MarkdownPresentation): void {
  let owner = presentation ?? presentations.get(target);
  if (!owner) {
    owner = new MarkdownPresentation(target);
    presentations.set(target, owner);
  }
  owner.releaseTree(target);
  target.classList.add('cui-markdown');
  target.replaceChildren();
  renderMarkdownTokens(target, Lexer.lex(text), false, owner);
  queueMicrotask(() => owner.reconcile());
}
export function renderMarkdownTokens(
  parent: Node,
  tokens: Token[],
  provisional = false,
  presentation?: MarkdownPresentation,
): void {
  for (const token of tokens) {
    if (token.type === 'space') continue;
    if (token.type === 'text' || token.type === 'escape') {
      const value = token as Tokens.Text;
      if (value.tokens) renderMarkdownTokens(parent, value.tokens, provisional, presentation);
      else parent.appendChild(document.createTextNode(value.text));
      continue;
    }
    if (token.type === 'list') {
      const list = token as Tokens.List;
      const el = document.createElement(list.ordered ? 'ol' : 'ul');
      if (list.ordered && typeof list.start === 'number') el.setAttribute('start', String(list.start));
      for (const item of list.items) {
        const li = document.createElement('li');
        renderMarkdownTokens(li, item.tokens, provisional, presentation);
        el.append(li);
      }
      parent.appendChild(el);
      continue;
    }
    if (token.type === 'table') {
      const table = token as Tokens.Table;
      const wrapper = document.createElement('div');
      wrapper.className = 'cui-table';
      wrapper.tabIndex = 0;
      presentation?.table(wrapper);
      const el = document.createElement('table');
      const head = el.createTHead().insertRow();
      for (const [index, cell] of table.header.entries()) {
        const th = document.createElement('th');
        th.scope = 'col';
        alignCell(th, table.align[index]);
        renderMarkdownTokens(th, cell.tokens, provisional, presentation);
        head.append(th);
      }
      const body = el.createTBody();
      for (const row of table.rows) {
        const tr = body.insertRow();
        for (const [index, cell] of row.entries()) {
          const td = tr.insertCell();
          alignCell(td, table.align[index]);
          renderMarkdownTokens(td, cell.tokens, provisional, presentation);
        }
      }
      wrapper.append(el);
      parent.appendChild(wrapper);
      continue;
    }
    if (token.type === 'code') {
      const value = token as Tokens.Code;
      // A closing fence is required during streaming; an unfinished fence remains plain.
      const fence = value.raw.match(/^ {0,3}(`{3,}|~{3,})[^\n]*\n/);
      const closed = closedCodeFence(value.raw);
      if (presentation) parent.appendChild(presentation.code(value.text, value.lang, fence ? closed : !provisional));
      else {
        const pre = document.createElement('pre');
        pre.tabIndex = 0;
        const code = document.createElement('code');
        code.textContent = value.text;
        pre.append(code);
        parent.appendChild(pre);
      }
      continue;
    }
    if (token.type === 'html' || token.type === 'image') {
      parent.appendChild(document.createTextNode(token.raw));
      continue;
    }
    if (token.type === 'link') {
      const link = token as Tokens.Link;
      // Bare URLs and reference definitions may still be receiving URL characters.
      // Only closed inline/angle links are interactive before stream completion.
      const closedInline = link.raw.startsWith('[') && link.raw.endsWith(')');
      const closedAngle = link.raw.startsWith('<') && link.raw.endsWith('>');
      if (provisional && !closedInline && !closedAngle) {
        parent.appendChild(document.createTextNode(link.raw));
        continue;
      }
      // Explicitly allow only web/mail links. No relative, data or javascript URLs.
      if (!/^(https?:\/\/|mailto:)/i.test(link.href)) {
        renderMarkdownTokens(parent, link.tokens, provisional, presentation);
        continue;
      }
      const a = document.createElement('a');
      a.href = link.href;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      renderMarkdownTokens(a, link.tokens, provisional, presentation);
      parent.appendChild(a);
      continue;
    }
    const tags: Record<string, string> = {
      paragraph: 'p',
      strong: 'strong',
      em: 'em',
      del: 'del',
      codespan: 'code',
      blockquote: 'blockquote',
      br: 'br',
      hr: 'hr',
    };
    const tag = token.type === 'heading' ? `h${Math.min((token as Tokens.Heading).depth + 1, 6)}` : tags[token.type];
    if (!tag) {
      parent.appendChild(document.createTextNode(token.raw));
      continue;
    }
    const el = document.createElement(tag);
    if ('tokens' in token && Array.isArray(token.tokens))
      renderMarkdownTokens(el, token.tokens, provisional, presentation);
    else if ('text' in token) el.textContent = String(token.text);
    parent.appendChild(el);
  }
}
