import { Lexer, type Token, type Tokens } from 'marked';

/** Render Markdown tokens into DOM. No model-supplied HTML is parsed or executed. */
export function renderMarkdown(target: HTMLElement, text: string): void {
  target.replaceChildren();
  appendTokens(target, Lexer.lex(text));
}
function appendTokens(parent: Node, tokens: Token[]): void {
  for (const token of tokens) {
    if (token.type === 'space') continue;
    if (token.type === 'text' || token.type === 'escape') {
      const value = token as Tokens.Text;
      if (value.tokens) appendTokens(parent, value.tokens);
      else parent.appendChild(document.createTextNode(value.text));
      continue;
    }
    if (token.type === 'list') {
      const list = token as Tokens.List;
      const el = document.createElement(list.ordered ? 'ol' : 'ul');
      if (list.ordered && typeof list.start === 'number') el.setAttribute('start', String(list.start));
      for (const item of list.items) {
        const li = document.createElement('li');
        appendTokens(li, item.tokens);
        el.append(li);
      }
      parent.appendChild(el);
      continue;
    }
    if (token.type === 'table') {
      const table = token as Tokens.Table;
      const wrapper = document.createElement('div');
      wrapper.className = 'cui-table';
      const el = document.createElement('table');
      const head = el.createTHead().insertRow();
      for (const cell of table.header) {
        const th = document.createElement('th');
        appendTokens(th, cell.tokens);
        head.append(th);
      }
      const body = el.createTBody();
      for (const row of table.rows) {
        const tr = body.insertRow();
        for (const cell of row) appendTokens(tr.insertCell(), cell.tokens);
      }
      wrapper.append(el);
      parent.appendChild(wrapper);
      continue;
    }
    if (token.type === 'code') {
      const pre = document.createElement('pre');
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
      // Explicitly allow only web/mail links. No relative, data or javascript URLs.
      if (!/^(https?:\/\/|mailto:)/i.test(link.href)) {
        appendTokens(parent, link.tokens);
        continue;
      }
      const a = document.createElement('a');
      a.href = link.href;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      appendTokens(a, link.tokens);
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
    if ('tokens' in token && Array.isArray(token.tokens)) appendTokens(el, token.tokens);
    else if ('text' in token) el.textContent = String(token.text);
    parent.appendChild(el);
  }
}
