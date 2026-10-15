export interface SearchEntry {
  id: string;
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

export function matchEntry(entry: SearchEntry, query: string): SearchMatch | undefined {
  const index = entry.normalized.indexOf(query);
  if (index < 0) return;
  const start = Math.max(0, index - 36);
  return {
    id: entry.id,
    snippet: `${start ? '…' : ''}${entry.text.slice(start, start + 150)}${entry.text.length > start + 150 ? '…' : ''}`,
  };
}
