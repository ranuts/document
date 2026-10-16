/** Cache unchanged text/query pairs so syncing preserves mark and focused row nodes. */
const highlightedText = new WeakMap<HTMLElement, { text: string; query: string }>();

export function renderSearchText(element: HTMLElement, text: string, query: string) {
  const previous = highlightedText.get(element);
  if (previous?.text === text && previous.query === query) return;
  highlightedText.set(element, { text, query });
  if (!query) {
    element.textContent = text;
    return;
  }
  // Search collapses whitespace and lowercases. Keep source offsets even when
  // whitespace contracts or Unicode lowercase expands (for example İ → i̇).
  let normalized = '';
  const starts: number[] = [];
  const ends: number[] = [];
  for (const part of text.matchAll(/\s+|[^\s]/gu)) {
    const token = /\s/.test(part[0]) ? ' ' : part[0];
    normalized += token;
    for (let index = 0; index < token.toLocaleLowerCase().length; index++) {
      starts.push(part.index);
      ends.push(part.index + part[0].length);
    }
  }
  // Lowercase the whole string to preserve contextual mappings such as final sigma.
  normalized = normalized.toLocaleLowerCase();
  const fragment = document.createDocumentFragment();
  let cursor = 0;
  let offset = 0;
  while ((offset = normalized.indexOf(query, offset)) !== -1) {
    const start = starts[offset];
    const end = ends[offset + query.length - 1];
    if (start >= cursor) {
      fragment.append(document.createTextNode(text.slice(cursor, start)));
      const mark = document.createElement('mark');
      mark.className = 'agent-search-match';
      mark.textContent = text.slice(start, end);
      fragment.append(mark);
      cursor = end;
    }
    offset += query.length;
  }
  fragment.append(document.createTextNode(text.slice(cursor)));
  element.replaceChildren(fragment);
}
