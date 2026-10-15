import { afterEach, expect, it, vi } from 'vitest';
import { createConversationStore } from '../../lib/agent-plugin/ui/sessions';
import { createHistorySearch } from '../../lib/agent-plugin/ui/history-search';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('extracts each immutable record once and searches without cloning message arrays', async () => {
  const store = createConversationStore();
  store.history().save([
    { role: 'user', content: 'Quarterly plan' },
    { role: 'assistant', content: 'Revenue forecast' },
  ]);
  const snapshot = store.searchSnapshot();
  expect(snapshot).toBe(store.searchSnapshot());
  const extract = vi.spyOn(snapshot[0], 'text');
  const clone = vi.spyOn(globalThis, 'structuredClone');
  const receive = vi.fn();
  const search = createHistorySearch(receive);
  search.update(snapshot);
  search.query('forecast');
  await vi.waitFor(() =>
    expect(receive).toHaveBeenLastCalledWith(
      expect.objectContaining({
        query: 'forecast',
        matches: [
          expect.objectContaining({ id: store.activeId, snippet: expect.stringContaining('Revenue forecast') }),
        ],
      }),
    ),
  );
  search.query('quarterly');
  await vi.waitFor(() => expect(receive).toHaveBeenLastCalledWith(expect.objectContaining({ query: 'quarterly' })));
  expect(extract).toHaveBeenCalledTimes(1);
  expect(clone).not.toHaveBeenCalled();
  search.dispose();
  clone.mockRestore();
});

it('times out a constructed silent worker and excludes removed records from the fallback', async () => {
  vi.useFakeTimers();
  const post = vi.fn();
  const terminate = vi.fn();
  vi.stubGlobal(
    'Worker',
    class {
      postMessage = post;
      terminate = terminate;
      addEventListener() {}
    },
  );
  const store = createConversationStore();
  const removed = store.activeId;
  store.history().save([{ role: 'user', content: 'Private needle' }]);
  store.create();
  const receive = vi.fn();
  const search = createHistorySearch(receive);
  search.update(store.searchSnapshot());
  search.query('needle');
  await vi.runAllTimersAsync();
  expect(terminate).toHaveBeenCalledOnce();
  expect(receive).toHaveBeenLastCalledWith(
    expect.objectContaining({ matches: [expect.objectContaining({ id: removed })] }),
  );
  await store.remove(removed);
  search.update(store.searchSnapshot());
  search.query('needle');
  await vi.runAllTimersAsync();
  expect(receive).toHaveBeenLastCalledWith(expect.objectContaining({ matches: [] }));
  search.dispose();
});

it('posts only changed corpus entries and rejects stale worker results', async () => {
  vi.useFakeTimers();
  const post = vi.fn();
  const listeners = new Map<string, (event: MessageEvent) => void>();
  vi.stubGlobal(
    'Worker',
    class {
      postMessage = post;
      terminate() {}
      addEventListener(type: string, fn: (event: MessageEvent) => void) {
        listeners.set(type, fn);
      }
    },
  );
  const store = createConversationStore();
  store.history().save([{ role: 'user', content: 'first' }]);
  const receive = vi.fn();
  const search = createHistorySearch(receive);
  search.update(store.searchSnapshot());
  search.query('first');
  await vi.advanceTimersByTimeAsync(0);
  const first = post.mock.calls.find(([message]) => message.type === 'query')![0];
  search.query('latest');
  const latest = post.mock.calls.at(-1)![0];
  listeners.get('message')!({
    data: { ...first, type: 'result', matches: [{ id: store.activeId, snippet: 'old' }] },
  } as MessageEvent);
  expect(receive).not.toHaveBeenCalled();
  listeners.get('message')!({ data: { ...latest, type: 'result', matches: [] } } as MessageEvent);
  expect(receive).toHaveBeenCalledOnce();
  expect(post.mock.calls.filter(([message]) => message.type === 'update')).toHaveLength(1);
  search.dispose();
  listeners.get('message')!({ data: { ...latest, type: 'result', matches: [] } } as MessageEvent);
  expect(receive).toHaveBeenCalledOnce();
});

it('yields within a single very large conversation and promotes idle extraction for explicit search', async () => {
  vi.useFakeTimers();
  const idle = vi.fn(() => 1);
  const cancelIdle = vi.fn();
  vi.stubGlobal('requestIdleCallback', idle);
  vi.stubGlobal('cancelIdleCallback', cancelIdle);
  const store = createConversationStore();
  store.history().save([{ role: 'user', content: `${'x'.repeat(200_000)} needle` }]);
  const receive = vi.fn();
  const search = createHistorySearch(receive);
  search.update(store.searchSnapshot());
  expect(idle).toHaveBeenCalled();
  search.query('needle');
  expect(cancelIdle).toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(0);
  expect(receive).not.toHaveBeenCalled();
  await vi.runAllTimersAsync();
  expect(receive).toHaveBeenCalledWith(
    expect.objectContaining({ matches: [expect.objectContaining({ id: store.activeId })] }),
  );
  search.dispose();
});

it.each(['error', 'messageerror'])('recovers from worker %s and cancels pending work on disposal', async (failure) => {
  vi.useFakeTimers();
  const listeners = new Map<string, (event?: unknown) => void>();
  const terminate = vi.fn();
  vi.stubGlobal(
    'Worker',
    class {
      postMessage() {}
      terminate = terminate;
      addEventListener(type: string, fn: () => void) {
        listeners.set(type, fn);
      }
    },
  );
  const store = createConversationStore();
  store.history().save([{ role: 'user', content: 'needle' }]);
  const receive = vi.fn();
  const search = createHistorySearch(receive);
  search.update(store.searchSnapshot());
  search.query('needle');
  listeners.get(failure)!();
  await vi.runAllTimersAsync();
  expect(receive).toHaveBeenCalledWith(
    expect.objectContaining({ matches: [expect.objectContaining({ id: store.activeId })] }),
  );
  expect(terminate).toHaveBeenCalledOnce();
  receive.mockClear();
  search.query('needle');
  search.dispose();
  await vi.runAllTimersAsync();
  expect(receive).not.toHaveBeenCalled();
});

it('matches text across extraction chunk boundaries', async () => {
  const store = createConversationStore();
  store.history().save([{ role: 'user', content: `${'x'.repeat(4090)}cross boundary needle` }]);
  const receive = vi.fn();
  const search = createHistorySearch(receive);
  search.update(store.searchSnapshot());
  search.query('cross boundary');
  await vi.waitFor(() =>
    expect(receive).toHaveBeenCalledWith(
      expect.objectContaining({
        matches: [expect.objectContaining({ id: store.activeId, snippet: expect.stringContaining('cross boundary') })],
      }),
    ),
  );
  search.dispose();
});

it('retains worker tombstones when another update supersedes pending extraction', async () => {
  vi.useFakeTimers();
  const post = vi.fn();
  vi.stubGlobal(
    'Worker',
    class {
      postMessage = post;
      terminate() {}
      addEventListener() {}
    },
  );
  const store = createConversationStore();
  const removed = store.activeId;
  store.history().save([{ role: 'user', content: 'removed needle' }]);
  const search = createHistorySearch(vi.fn());
  search.update(store.searchSnapshot());
  await vi.runAllTimersAsync();
  post.mockClear();
  await store.remove(removed);
  search.update(store.searchSnapshot());
  store.create();
  search.update(store.searchSnapshot());
  await vi.runAllTimersAsync();
  expect(post.mock.calls.some(([message]) => message.type === 'update' && message.removed.includes(removed))).toBe(
    true,
  );
  search.dispose();
});

it('bounds every transfer and processing slice for a multi-megabyte conversation', async () => {
  vi.useFakeTimers();
  const post = vi.fn();
  vi.stubGlobal(
    'Worker',
    class {
      postMessage = post;
      terminate() {}
      addEventListener() {}
    },
  );
  const store = createConversationStore();
  store.history().save([{ role: 'user', content: `${'x'.repeat(3 * 1024 * 1024)} tail needle` }]);
  const normalize = vi.spyOn(String.prototype, 'toLocaleLowerCase');
  const join = vi.spyOn(Array.prototype, 'join');
  const search = createHistorySearch(vi.fn());
  search.update(store.searchSnapshot());
  search.query('tail needle');
  try {
    await vi.advanceTimersByTimeAsync(0);
    expect(post.mock.calls.some(([message]) => message.type === 'query')).toBe(false);
    await vi.runAllTimersAsync();
    const updates = post.mock.calls.map(([message]) => message).filter((message) => message.type === 'update');
    expect(updates.length).toBeGreaterThan(100);
    expect(Math.max(...updates.map((message) => JSON.stringify(message).length))).toBeLessThan(40_000);
    expect(normalize.mock.instances.every((value) => String(value).length <= 4096)).toBe(true);
    expect(join.mock.instances.every((value) => Array.isArray(value) && value.length < 100)).toBe(true);
    expect(updates.flatMap((message) => message.entries).some((entry) => entry.text.includes('tail needle'))).toBe(
      true,
    );
  } finally {
    search.dispose();
    normalize.mockRestore();
    join.mockRestore();
  }
});

it('suspends actual worker and scheduled work, then restarts from current authoritative records', async () => {
  vi.useFakeTimers();
  const workers: {
    post: ReturnType<typeof vi.fn>;
    terminate: ReturnType<typeof vi.fn>;
    listeners: Map<string, (event: MessageEvent) => void>;
  }[] = [];
  vi.stubGlobal(
    'Worker',
    class {
      postMessage = vi.fn();
      terminate = vi.fn();
      listeners = new Map<string, (event: MessageEvent) => void>();
      constructor() {
        workers.push({ post: this.postMessage, terminate: this.terminate, listeners: this.listeners });
      }
      addEventListener(type: string, callback: (event: MessageEvent) => void) {
        this.listeners.set(type, callback);
      }
    },
  );
  const store = createConversationStore();
  store.history().save([{ role: 'user', content: 'old needle' }]);
  const receive = vi.fn();
  const search = createHistorySearch(receive);
  search.update(store.searchSnapshot());
  search.query('needle');
  search.suspend();
  expect(workers[0].terminate).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
  store.history().save([{ role: 'user', content: 'new needle' }]);
  search.resume(store.searchSnapshot());
  search.query('needle');
  await vi.advanceTimersByTimeAsync(0);
  expect(workers).toHaveLength(2);
  expect(
    workers[1].post.mock.calls.some(
      ([message]) =>
        message.type === 'update' &&
        message.entries.some((entry: { text: string }) => entry.text.includes('new needle')),
    ),
  ).toBe(true);
  const latest = workers[1].post.mock.calls.at(-1)![0];
  workers[0].listeners.get('message')!({
    data: { ...latest, type: 'result', matches: [{ id: store.activeId, snippet: 'late old needle' }] },
  } as MessageEvent);
  expect(receive).not.toHaveBeenCalled();
  workers[1].listeners.get('message')!({
    data: { ...latest, type: 'result', matches: [{ id: store.activeId, snippet: 'new needle' }] },
  } as MessageEvent);
  expect(receive).toHaveBeenCalledWith(
    expect.objectContaining({ matches: [expect.objectContaining({ snippet: 'new needle' })] }),
  );
  search.dispose();
});

it('yields the first message block without mapping or filtering the remaining block array', () => {
  const store = createConversationStore();
  store.history().save([
    {
      role: 'user',
      content: Array.from({ length: 10_000 }, (_, index) => ({ type: 'text' as const, text: `Block ${index}` })),
    },
  ]);
  const record = store.searchSnapshot()[0];
  const filter = vi.spyOn(Array.prototype, 'filter');
  const map = vi.spyOn(Array.prototype, 'map');
  try {
    const first = record.text()[Symbol.iterator]().next();
    const filterCalls = filter.mock.calls.length;
    const mapCalls = map.mock.calls.length;
    expect(first.value).toBe('Block 0');
    expect(filterCalls).toBe(0);
    expect(mapCalls).toBe(0);
  } finally {
    filter.mockRestore();
    map.mockRestore();
  }
});

it('finds a query spanning more than two segments without assembling the record', async () => {
  vi.useFakeTimers();
  const store = createConversationStore();
  const phrase = `start${'a'.repeat(12_000)}end`;
  store.history().save([{ role: 'user', content: `${'z'.repeat(4090)}${phrase} tail needle` }]);
  const receive = vi.fn();
  const search = createHistorySearch(receive);
  search.update(store.searchSnapshot());
  search.query(phrase);
  await vi.runAllTimersAsync();
  expect(receive).toHaveBeenCalledWith(
    expect.objectContaining({ matches: [expect.objectContaining({ id: store.activeId })] }),
  );
  search.dispose();
});

it.each(['idle', 'watchdog', 'fallback'])('cancels pending %s work when suspended', async (phase) => {
  vi.useFakeTimers();
  const cancelIdle = vi.fn();
  if (phase === 'idle') {
    vi.stubGlobal('requestIdleCallback', () => 1);
    vi.stubGlobal('cancelIdleCallback', cancelIdle);
  }
  if (phase === 'watchdog')
    vi.stubGlobal(
      'Worker',
      class {
        postMessage() {}
        terminate() {}
        addEventListener() {}
      },
    );
  else vi.stubGlobal('Worker', undefined);
  const store = createConversationStore();
  store.history().save([{ role: 'user', content: 'needle' }]);
  const receive = vi.fn();
  const search = createHistorySearch(receive);
  search.update(store.searchSnapshot());
  if (phase !== 'idle') {
    search.query('needle');
    await vi.advanceTimersByTimeAsync(0);
  }
  expect(vi.getTimerCount()).toBeGreaterThan(0);
  search.suspend();
  expect(vi.getTimerCount()).toBe(0);
  if (phase === 'idle') expect(cancelIdle).toHaveBeenCalled();
  await vi.runAllTimersAsync();
  expect(receive).not.toHaveBeenCalled();
  search.dispose();
});

it('processes multiple bounded corpus posts in one task before yielding', async () => {
  vi.useFakeTimers();
  const post = vi.fn();
  vi.stubGlobal(
    'Worker',
    class {
      postMessage = post;
      terminate() {}
      addEventListener() {}
    },
  );
  const store = createConversationStore();
  store.history().save([{ role: 'user', content: 'x'.repeat(1024 * 1024) }]);
  const search = createHistorySearch(vi.fn());
  search.update(store.searchSnapshot());
  search.query('missing');
  await vi.advanceTimersByTimeAsync(0);
  const updates = post.mock.calls.map(([message]) => message).filter((message) => message.type === 'update');
  expect(updates.length).toBeGreaterThan(1);
  expect(updates.length).toBeLessThanOrEqual(32);
  expect(updates.every((message) => JSON.stringify(message).length < 40_000)).toBe(true);
  expect(post.mock.calls.some(([message]) => message.type === 'query')).toBe(false);
  search.dispose();
});

it('yields after the time budget even when more bounded transfer batches remain', async () => {
  vi.useFakeTimers();
  let elapsed = 0;
  const now = vi.spyOn(performance, 'now').mockImplementation(() => elapsed);
  const post = vi.fn((message: { type: string }) => {
    if (message.type === 'update') elapsed += 2;
  });
  vi.stubGlobal(
    'Worker',
    class {
      postMessage = post;
      terminate() {}
      addEventListener() {}
    },
  );
  const store = createConversationStore();
  store.history().save([{ role: 'user', content: 'x'.repeat(1024 * 1024) }]);
  const search = createHistorySearch(vi.fn());
  try {
    search.update(store.searchSnapshot());
    search.query('missing');
    await vi.advanceTimersByTimeAsync(0);
    expect(post.mock.calls.filter(([message]) => message.type === 'update')).toHaveLength(2);
    expect(vi.getTimerCount()).toBe(1);
  } finally {
    search.dispose();
    now.mockRestore();
  }
});
