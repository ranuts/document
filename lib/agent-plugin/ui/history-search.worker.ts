import { matchEntry, type SearchEntry, type SearchRequest, type SearchResult } from './history-search-model';
const corpus = new Map<string, SearchEntry>();
let revision = 0;
self.addEventListener('message', (event: MessageEvent<SearchRequest>) => {
  const data = event.data;
  if (data.type === 'update') {
    for (const id of data.removed) corpus.delete(id);
    for (const entry of data.entries) corpus.set(entry.id, entry);
    revision = data.revision;
  } else if (data.type === 'query' && data.revision === revision) {
    const matches = Array.from(corpus.values()).flatMap((entry) => matchEntry(entry, data.query) ?? []);
    self.postMessage({ ...data, type: 'result', matches } satisfies SearchResult);
  }
});
