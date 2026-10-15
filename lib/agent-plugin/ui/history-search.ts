import { scheduleHistoryTask } from './history-idle';
import type { ConversationSearchRecord } from './sessions';
import {
  matchEntry,
  type SearchEntry,
  type SearchMatch,
  type SearchRequest,
  type SearchResult,
} from './history-search-model';

/** Work gets a bounded task slot even when requestIdleCallback is starved. */
export function createHistorySearch(receive: (result: SearchResult) => void) {
  let worker: Worker | undefined;
  let disposed = false;
  let revision = 0;
  let request = 0;
  let query = '';
  let extraction: (() => void) | undefined;
  let extractStep: (() => void) | undefined;
  let fallback: ReturnType<typeof setTimeout> | undefined;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  let records: readonly ConversationSearchRecord[] | undefined;
  const versions = new Map<string, ConversationSearchRecord>();
  const corpus = new Map<string, SearchEntry>();
  const tombstones = new Set<string>();
  const cancelQuery = () => {
    clearTimeout(fallback);
    clearTimeout(watchdog);
    fallback = undefined;
    watchdog = undefined;
  };
  const runFallback = () => {
    const currentRequest = request;
    const currentRevision = revision;
    const entries = Array.from(corpus.values());
    const matches: SearchMatch[] = [];
    let offset = 0;
    let scan = 0;
    const step = () => {
      if (disposed || request !== currentRequest || revision !== currentRevision) return;
      let budget = 16_384;
      while (offset < entries.length && budget > 0) {
        const entry = entries[offset];
        const end = Math.min(scan + 8192, entry.text.length);
        const text = entry.text.slice(scan, end + query.length);
        const normalized = entry.normalized.slice(scan, end + query.length);
        const match = matchEntry({ id: entry.id, text, normalized }, query);
        budget -= 8192;
        if (match) matches.push(match);
        if (match || end === entry.text.length) {
          offset++;
          scan = 0;
        } else scan = end;
      }
      if (offset < entries.length) fallback = setTimeout(step, 0);
      else receive({ type: 'result', revision, request, query, matches });
    };
    fallback = setTimeout(step, 0);
  };
  const failWorker = () => {
    if (!worker || disposed) return;
    worker.terminate();
    worker = undefined;
    cancelQuery();
    if (!extraction && query) runFallback();
  };
  const post = (message: SearchRequest) => {
    try {
      worker?.postMessage(message);
    } catch {
      failWorker();
    }
  };
  const runQuery = () => {
    cancelQuery();
    if (disposed || extraction || !query) return;
    if (worker) {
      // A worker may construct successfully but never answer (CSP/runtime stalls).
      watchdog = setTimeout(failWorker, 250);
      post({ type: 'query', revision, request, query });
    } else runFallback();
  };
  try {
    worker = new Worker(new URL('./history-search.worker.ts', import.meta.url), { type: 'module' });
    worker.addEventListener('error', failWorker);
    worker.addEventListener('messageerror', failWorker);
    worker.addEventListener('message', (event: MessageEvent<SearchResult>) => {
      const data = event.data;
      if (
        disposed ||
        !worker ||
        extraction ||
        !data ||
        data.type !== 'result' ||
        data.revision !== revision ||
        data.request !== request ||
        data.query !== query
      )
        return;
      cancelQuery();
      const matches = Array.isArray(data.matches)
        ? data.matches.filter((match) => corpus.has(match.id) && typeof match.snippet === 'string')
        : [];
      receive({ ...data, matches });
    });
  } catch {
    worker = undefined;
  }
  return {
    update(next: readonly ConversationSearchRecord[]) {
      if (disposed || next === records) return;
      records = next;
      revision++;
      request++;
      cancelQuery();
      extraction?.();
      const ids = new Set(next.map((entry) => entry.id));
      const removed = Array.from(versions.keys()).filter((id) => !ids.has(id));
      for (const id of removed) tombstones.add(id);
      for (const id of ids) tombstones.delete(id);
      for (const id of removed) {
        versions.delete(id);
        corpus.delete(id);
      }
      const pending = next.filter((entry) => versions.get(entry.id) !== entry);
      let offset = 0;
      let iterator: Iterator<string> | undefined;
      let pieces: string[] = [];
      let normalized: string[] = [];
      let first = true;
      const step = () => {
        if (disposed) return;
        const entries: SearchEntry[] = [];
        let budget = 16_384;
        let count = 0;
        while (offset < pending.length && budget > 0 && count < 8) {
          const entry = pending[offset];
          if (!iterator) {
            iterator = entry.text()[Symbol.iterator]();
            pieces = [entry.title, ' '];
            normalized = [entry.title.toLocaleLowerCase(), ' '];
          }
          const part = iterator.next();
          if (part.done) {
            const value = { id: entry.id, text: pieces.join(''), normalized: normalized.join('') };
            versions.set(entry.id, entry);
            corpus.set(entry.id, value);
            entries.push(value);
            offset++;
            count++;
            iterator = undefined;
          } else {
            const text = part.value.replace(/\s+/g, ' ');
            pieces.push(text);
            normalized.push(text.toLocaleLowerCase());
            budget -= Math.max(1, text.length);
          }
        }
        if (entries.length || first) {
          post({ type: 'update', revision, entries, removed: Array.from(tombstones) });
          tombstones.clear();
        }
        first = false;
        if (offset < pending.length) extraction = scheduleHistoryTask(step, !query);
        else {
          extraction = undefined;
          extractStep = undefined;
          runQuery();
        }
      };
      extractStep = step;
      extraction = scheduleHistoryTask(step, !query);
    },
    query(value: string) {
      if (disposed) return;
      query = value.trim().toLocaleLowerCase();
      request++;
      if (query && extraction && extractStep) {
        extraction();
        extraction = scheduleHistoryTask(extractStep, false);
      }
      runQuery();
    },
    dispose() {
      disposed = true;
      extraction?.();
      extraction = undefined;
      extractStep = undefined;
      cancelQuery();
      worker?.terminate();
      worker = undefined;
      corpus.clear();
      versions.clear();
      tombstones.clear();
      records = undefined;
    },
  };
}
