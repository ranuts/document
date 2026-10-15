import { scheduleHistoryTask } from './history-idle';
import type { ConversationSearchRecord } from './sessions';
import {
  createSearchMatcher,
  type SearchEntry,
  type SearchMatch,
  type SearchRequest,
  type SearchResult,
} from './history-search-model';

/** All main-thread text processing and Worker upserts stay segmented. */
export function createHistorySearch(receive: (result: SearchResult) => void) {
  let worker: Worker | undefined;
  let disposed = false;
  let suspended = false;
  let generation = 0;
  let revision = 0;
  let request = 0;
  let query = '';
  let extraction: (() => void) | undefined;
  let extractStep: (() => void) | undefined;
  let fallback: ReturnType<typeof setTimeout> | undefined;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  let records: readonly ConversationSearchRecord[] | undefined;
  const versions = new Map<string, ConversationSearchRecord>();
  const corpus = new Map<string, SearchEntry[]>();
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
    const currentGeneration = generation;
    const entries = corpus.entries();
    const matches: SearchMatch[] = [];
    let current = entries.next();
    let segment = 0;
    let match = current.done ? undefined : createSearchMatcher(current.value[0], query);
    const step = () => {
      if (
        disposed ||
        suspended ||
        generation !== currentGeneration ||
        request !== currentRequest ||
        revision !== currentRevision
      )
        return;
      let budget = 16_384;
      let count = 0;
      while (!current.done && budget > 0 && count < 32) {
        const part = current.value[1][segment++];
        const result = part && match?.(part);
        budget -= Math.max(1, part?.text.length ?? 0);
        count++;
        if (result) matches.push(result);
        if (result || segment >= current.value[1].length) {
          current = entries.next();
          segment = 0;
          match = current.done ? undefined : createSearchMatcher(current.value[0], query);
        }
      }
      if (!current.done) fallback = setTimeout(step, 0);
      else receive({ type: 'result', revision, request, query, matches });
    };
    fallback = setTimeout(step, 0);
  };
  const failWorker = () => {
    if (!worker || disposed || suspended) return;
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
    if (disposed || suspended || extraction || !query) return;
    if (worker) {
      watchdog = setTimeout(failWorker, 250);
      post({ type: 'query', revision, request, query });
    } else runFallback();
  };
  function startWorker() {
    try {
      const instance = new Worker(new URL('./history-search.worker.ts', import.meta.url), { type: 'module' });
      worker = instance;
      const fail = () => {
        if (worker === instance) failWorker();
      };
      instance.addEventListener('error', fail);
      instance.addEventListener('messageerror', fail);
      instance.addEventListener('message', (event: MessageEvent<SearchResult>) => {
        const data = event.data;
        if (
          disposed ||
          suspended ||
          worker !== instance ||
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
  }
  function update(next: readonly ConversationSearchRecord[]) {
    if (disposed || suspended || next === records) return;
    records = next;
    revision++;
    request++;
    cancelQuery();
    extraction?.();
    const currentGeneration = ++generation;
    const ids = new Set(next.map((entry) => entry.id));
    const removed = Array.from(corpus.keys()).filter((id) => !ids.has(id));
    for (const id of removed) {
      tombstones.add(id);
      versions.delete(id);
      corpus.delete(id);
    }
    for (const id of ids) tombstones.delete(id);
    const pending = next.filter((entry) => versions.get(entry.id) !== entry);
    let offset = 0;
    let iterator: Iterator<string> | undefined;
    let segments: SearchEntry[] = [];
    let first = true;
    let previousSpace = false;
    function* textFor(entry: ConversationSearchRecord) {
      for (let start = 0; start < entry.title.length; start += 4096) yield entry.title.slice(start, start + 4096);
      yield ' ';
      yield* entry.text();
    }
    const step = () => {
      if (disposed || suspended || generation !== currentGeneration) return;
      const entries: SearchEntry[] = [];
      let budget = 8192;
      let count = 0;
      while (offset < pending.length && budget > 0 && count < 32) {
        const entry = pending[offset];
        if (!iterator) {
          iterator = textFor(entry);
          segments = [];
          previousSpace = false;
          corpus.set(entry.id, segments);
        }
        const part = iterator.next();
        count++;
        if (part.done) {
          versions.set(entry.id, entry);
          offset++;
          iterator = undefined;
        } else {
          let text = part.value.replace(/\s+/g, ' ');
          if (previousSpace && text.startsWith(' ')) text = text.slice(1);
          if (text) previousSpace = text.endsWith(' ');
          const value = { id: entry.id, index: segments.length, text, normalized: text.toLocaleLowerCase() };
          segments.push(value);
          entries.push(value);
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
  }
  // Worker identity, rather than corpus revision, isolates each worker lifetime.
  startWorker();
  const stop = () => {
    generation++;
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
  };
  return {
    update,
    query(value: string) {
      if (disposed || suspended) return;
      query = value.trim().toLocaleLowerCase();
      request++;
      if (query && extraction && extractStep) {
        extraction();
        extraction = scheduleHistoryTask(extractStep, false);
      }
      runQuery();
    },
    suspend() {
      if (!disposed && !suspended) {
        suspended = true;
        stop();
      }
    },
    resume(next: readonly ConversationSearchRecord[]) {
      if (disposed || !suspended) return;
      suspended = false;
      startWorker();
      update(next);
    },
    dispose() {
      disposed = true;
      stop();
    },
  };
}
