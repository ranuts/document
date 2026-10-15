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
