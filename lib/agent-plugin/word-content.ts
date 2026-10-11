import { Lexer, type Token, type Tokens } from 'marked';
import { escapeHtml } from 'ranuts/utils';

/** Literal insertion is the default, including Markdown-looking user data. */
export function textToHtml(text: string): string {
  const html = escapeHtml(text).replace(/\r\n|\r|\n/g, '<br />');
  return / {2,}|\t|(?:^|[\r\n]) | $| [\r\n]/.test(text) ? `<span style="white-space: pre-wrap">${html}</span>` : html;
}
export interface WordContent {
  html: string;
  text: string;
}
/** Serialize an explicit document artifact, never model-supplied HTML or URLs.
 * The semantic text is also the expected native readback, independent of Markdown markers.
 */
export function wordContent(text: string, format: 'plain' | 'markdown' = 'plain'): WordContent {
  if (format === 'plain') return { html: textToHtml(text), text };
  if (format !== 'markdown' || text.length > 8000) throw new Error('Invalid document tool parameters');
  const render = (tokens: Token[], depth = 0): WordContent => {
    if (depth > 12) throw new Error('Invalid document tool parameters');
    const parts: WordContent[] = [];
    const wrap = (tag: string, body: WordContent) => ({ html: `<${tag}>${body.html}</${tag}>`, text: body.text });
    for (const token of tokens) {
      if (token.type === 'space') continue;
      let part: WordContent;
      if (token.type === 'list') {
        const list = token as Tokens.List;
        const items = list.items.map((item) => render(item.tokens, depth + 1));
        part = {
          html: `<${list.ordered ? 'ol' : 'ul'}${list.ordered ? ` start="${Number(list.start) || 1}"` : ''}>${items.map((item) => `<li>${item.html}</li>`).join('')}</${list.ordered ? 'ol' : 'ul'}>`,
          text: items.map((item) => item.text.replace(/\n$/, '')).join('\n'),
        };
      } else if (token.type === 'table') {
        throw new Error('agentWordFormatUnsupported');
      } else if (token.type === 'code') {
        const code = (token as Tokens.Code).text;
        part = { html: `<pre>${escapeHtml(code)}</pre>`, text: code };
      } else if (token.type === 'br') part = { html: '<br />', text: '\n' };
      else if (token.type === 'hr') part = { html: '<p>—</p>', text: '—' };
      else if (token.type === 'html' || token.type === 'image') part = { html: textToHtml(token.raw), text: token.raw };
      else {
        const body =
          'tokens' in token && Array.isArray(token.tokens)
            ? render(token.tokens, depth + 1)
            : {
                html: textToHtml('text' in token ? String(token.text) : token.raw),
                text: 'text' in token ? String(token.text) : token.raw,
              };
        const tags: Record<string, string> = {
          paragraph: 'p',
          strong: 'strong',
          em: 'em',
          del: 's',
          codespan: 'code',
          blockquote: 'blockquote',
        };
        const tag = token.type === 'heading' ? `h${(token as Tokens.Heading).depth}` : tags[token.type];
        // Links retain their label only. No model-controlled URL reaches native paste.
        part = tag ? wrap(tag, body) : body;
      }
      const block = ['heading', 'paragraph', 'list', 'table', 'code', 'blockquote', 'hr', 'html'].includes(token.type);
      if (block) part.text = part.text.replace(/\n$/, '') + '\n';
      parts.push(part);
    }
    return { html: parts.map((p) => p.html).join(''), text: parts.map((p) => p.text).join('') };
  };
  const tokens = Lexer.lex(text);
  const formatted = (items: Token[]): boolean =>
    items.some(
      (token) =>
        ['heading', 'list', 'table', 'code', 'strong', 'em', 'del', 'codespan', 'link', 'blockquote', 'hr'].includes(
          token.type,
        ) ||
        ('tokens' in token && Array.isArray(token.tokens) && formatted(token.tokens)),
    );
  if (!formatted(tokens)) return { html: textToHtml(text), text };
  const result = render(tokens);
  return result;
}
