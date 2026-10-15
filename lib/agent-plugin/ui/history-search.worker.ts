import {
  compileSearchQuery,
  createSearchMatcher,
  type SearchEntry,
  type SearchRequest,
  type SearchResult,
} from './history-search-model';
const corpus = new Map<string, SearchEntry[]>();
let revision = 0;
self.addEventListener('message', (event: MessageEvent<SearchRequest>) => {
  const data = event.data;
  if (data.type === 'update') {
    for (const id of data.removed) corpus.delete(id);
    for (const entry of data.entries) {
      if (!entry.index) corpus.set(entry.id, []);
      corpus.get(entry.id)?.push(entry);
    }
    revision = data.revision;
  } else if (data.type === 'query' && data.revision === revision) {
    const matches = [];
    const compiled = compileSearchQuery(data.query);
    for (const [id, segments] of corpus) {
      const match = createSearchMatcher(id, compiled);
      for (const segment of segments) {
        const result = match(segment);
        if (result) {
          matches.push(result);
          break;
        }
      }
    }
    self.postMessage({ ...data, type: 'result', matches } satisfies SearchResult);
  }
});
