/** Captured source UI: text only, no implicit network access. */
export function safeSourceUri(value?: string): string | undefined {
  if (!value || value.length > 256) return;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
  } catch {
    /* Invalid locators remain plain text. */
  }
}
export function sourceMatches(source: { title: string; text: string }, query: string): boolean {
  const normalize = (text: string) => text.replace(/\s+/gu, ' ').trim().toLocaleLowerCase();
  return normalize(`${source.title}\n${source.text}`).includes(normalize(query));
}
/** Locate a literal normalized query in the original text, retaining whitespace/Unicode offsets. */
export function sourceExcerpt(text: string, query: string, limit = 8000): { text: string; partial: boolean } {
  const needle = query.replace(/\s+/gu, ' ').trim().toLocaleLowerCase();
  let start = 0;
  if (needle) {
    let normalized = '';
    const offsets: number[] = [];
    for (const part of text.matchAll(/\s+|[^\s]/gu)) {
      const token = /\s/.test(part[0]) ? ' ' : part[0];
      normalized += token;
      for (let i = 0; i < token.toLocaleLowerCase().length; i++) offsets.push(part.index);
    }
    const found = normalized.toLocaleLowerCase().indexOf(needle);
    if (found >= 0) start = Math.max(0, offsets[found] - 500);
  }
  return { text: text.slice(start, start + limit), partial: start > 0 || text.length > limit };
}
