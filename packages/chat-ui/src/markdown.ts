import { Lexer, type Token, type Tokens } from 'marked';

/** Render Markdown tokens into DOM. No model-supplied HTML is parsed or executed. */
export function renderMarkdown(target: HTMLElement, text: string): void {
  target.replaceChildren();
  renderMarkdownTokens(target, Lexer.lex(text));
}
export function renderMarkdownTokens(parent: Node, tokens: Token[], provisional = false): void {
  for (const token of tokens) {
    if (token.type === 'space') continue;
    if (token.type === 'text' || token.type === 'escape') {
      const value = token as Tokens.Text;
      if (value.tokens) renderMarkdownTokens(parent, value.tokens, provisional);
      else parent.appendChild(document.createTextNode(value.text));
      continue;
    }
    if (token.type === 'list') {
      const list = token as Tokens.List;
      const el = document.createElement(list.ordered ? 'ol' : 'ul');
      if (list.ordered && typeof list.start === 'number') el.setAttribute('start', String(list.start));
      for (const item of list.items) {
        const li = document.createElement('li');
        renderMarkdownTokens(li, item.tokens, provisional);
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
      const el = document.createElement('table');
      const head = el.createTHead().insertRow();
      for (const cell of table.header) {
        const th = document.createElement('th');
        th.scope = 'col';
        renderMarkdownTokens(th, cell.tokens, provisional);
        head.append(th);
      }
      const body = el.createTBody();
      for (const row of table.rows) {
        const tr = body.insertRow();
        for (const cell of row) renderMarkdownTokens(tr.insertCell(), cell.tokens, provisional);
      }
      wrapper.append(el);
      parent.appendChild(wrapper);
      continue;
    }
    if (token.type === 'code') {
      const pre = document.createElement('pre');
      pre.tabIndex = 0;
      const code = document.createElement('code');
      code.textContent = (token as Tokens.Code).text;
      pre.append(code);
      parent.appendChild(pre);
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
        renderMarkdownTokens(parent, link.tokens, provisional);
        continue;
      }
      const a = document.createElement('a');
      a.href = link.href;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      renderMarkdownTokens(a, link.tokens, provisional);
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
    if ('tokens' in token && Array.isArray(token.tokens)) renderMarkdownTokens(el, token.tokens, provisional);
    else if ('text' in token) el.textContent = String(token.text);
    parent.appendChild(el);
  }
}
