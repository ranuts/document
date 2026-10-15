/** Each segment is bounded before normalization and before crossing the Worker boundary. */
export interface SearchEntry {
  id: string;
  index: number;
  text: string;
  normalized: string;
}
export interface SearchMatch {
  id: string;
  snippet: string;
}
export interface SearchResult {
  type: 'result';
  revision: number;
  request: number;
  query: string;
  matches: SearchMatch[];
}
export type SearchRequest =
  | { type: 'update'; revision: number; entries: SearchEntry[]; removed: string[] }
  | { type: 'query'; revision: number; request: number; query: string };

export function normalizeSearchWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ');
}

/** Shared identity for the list, engine and Worker results. Never truncate a query. */
export function canonicalSearchQuery(text: string): string {
  return normalizeSearchWhitespace(text).trim().toLocaleLowerCase();
}

export interface CompiledSearchQuery {
  readonly text: string;
  readonly prefix: Uint32Array;
}

/** Count comparisons, including prefix backtracking, so long patterns can yield. */
export function createSearchCompiler(text: string) {
  const compiled: CompiledSearchQuery = { text, prefix: new Uint32Array(text.length) };
  let index = 1;
  let previous = 0;
  return {
    compiled,
    advance(comparisons = 4096): boolean {
      while (index < text.length && comparisons-- > 0) {
        if (previous && text[index] !== text[previous]) previous = compiled.prefix[previous - 1];
        else {
          if (text[index] === text[previous]) previous++;
          compiled.prefix[index++] = previous;
        }
      }
      return index >= text.length;
    },
  };
}

/** Workers compile once per request; main-thread fallback advances cooperatively. */
export function compileSearchQuery(text: string): CompiledSearchQuery {
  const compiler = createSearchCompiler(text);
  while (!compiler.advance()) {
    /* Worker-owned preparation. */
  }
  return compiler.compiled;
}

/** Streaming KMP matching: no whole-record assembly or query-sized overlap buffers. */
export function createSearchMatcher(id: string, compiled: CompiledSearchQuery) {
  const { text: query, prefix } = compiled;
  let matched = 0;
  let tail = '';
  return (entry: SearchEntry): SearchMatch | undefined => {
    if (!query) return;
    for (let index = 0; index < entry.normalized.length; index++) {
      while (matched && entry.normalized[index] !== query[matched]) matched = prefix[matched - 1];
      if (entry.normalized[index] === query[matched]) matched++;
      if (matched === query.length) {
        const text = tail + entry.text;
        const start = Math.max(0, tail.length + index - query.length + 1 - 36);
        return {
          id,
          snippet: `${entry.index || start ? '…' : ''}${text.slice(start, start + 150)}${text.length > start + 150 ? '…' : ''}`,
        };
      }
    }
    tail = (tail + entry.text).slice(-150);
  };
}
