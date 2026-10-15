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

/** Streaming KMP matching: no whole-record assembly or query-sized overlap buffers. */
export function createSearchMatcher(id: string, query: string) {
  const prefix = new Uint32Array(query.length);
  for (let index = 1, previous = 0; index < query.length; index++) {
    while (previous && query[index] !== query[previous]) previous = prefix[previous - 1];
    if (query[index] === query[previous]) previous++;
    prefix[index] = previous;
  }
  let matched = 0;
  let tail = '';
  return (entry: SearchEntry): SearchMatch | undefined => {
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
