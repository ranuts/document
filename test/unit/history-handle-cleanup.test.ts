import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { HANDLES_STORE, requestToPromise, withStores, resetHistoryDbForTests } from '../../lib/history/db';
import {
  clearAllHistory,
  deleteDoc,
  getDoc,
  getLatestSnapshot,
  historyUsage,
  pruneExpired,
  putSnapshot,
  resetHistoryClockForTests,
} from '../../lib/history/store';
import { MAX_AGE_MS } from '../../lib/history/types';
beforeEach(() => {
  resetHistoryDbForTests();
  resetHistoryClockForTests();
  vi.stubGlobal('indexedDB', new IDBFactory());
});
afterEach(() => {
  resetHistoryDbForTests();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
async function addTarget(id: string) {
  await withStores([HANDLES_STORE], 'readwrite', async (tx) => {
    tx.objectStore(HANDLES_STORE).put({
      docId: id,
      name: 'Report.docx',
      linkedAt: Date.now(),
      handle: { name: 'Report.docx' },
    });
    return true;
  });
}
async function targetIds() {
  return withStores([HANDLES_STORE], 'readonly', async (tx) =>
    requestToPromise(tx.objectStore(HANDLES_STORE).getAllKeys()),
  );
}
it.each(['delete', 'clear', 'expire', 'budget'])(
  'removes stored file targets when documents leave history by %s',
  async (mode) => {
    await putSnapshot({ id: 'old', title: 'Old.docx', origin: 'local', bytes: new Uint8Array(100) });
    await addTarget('old');
    if (mode === 'delete') await deleteDoc('old');
    if (mode === 'clear') await clearAllHistory();
    if (mode === 'expire') {
      vi.spyOn(Date, 'now').mockReturnValue(Date.now() + MAX_AGE_MS + 10);
      await pruneExpired();
    }
    if (mode === 'budget') {
      vi.stubGlobal('navigator', { storage: { estimate: async () => ({ quota: 400 }) } });
      await putSnapshot({ id: 'new', title: 'New.docx', origin: 'local', bytes: new Uint8Array(150) });
      expect(await getDoc('new')).not.toBeNull();
    }
    expect(await getDoc('old')).toBeNull();
    expect(await targetIds()).toEqual([]);
  },
);
it('also clears targets that have never had a recovery snapshot', async () => {
  await addTarget('saved-without-snapshot');
  await clearAllHistory();
  expect(await targetIds()).toEqual([]);
});

it('keeps an actively updated expired document and its file target while sweeping other expired documents', async () => {
  await putSnapshot({ id: 'active', title: 'Active.docx', origin: 'local', bytes: new Uint8Array([1, 2]) });
  await putSnapshot({ id: 'stale', title: 'Stale.docx', origin: 'local', bytes: new Uint8Array([9]) });
  await addTarget('active');
  await addTarget('stale');
  vi.spyOn(Date, 'now').mockReturnValue(Date.now() + MAX_AGE_MS + 10);

  const updated = await putSnapshot({
    id: 'active',
    title: 'Active.docx',
    origin: 'local',
    bytes: new Uint8Array([3, 4, 5]),
  });

  expect(Array.from((await getLatestSnapshot('active'))?.bytes ?? [])).toEqual([3, 4, 5]);
  expect(updated).toMatchObject({ id: 'active', revCount: 2, totalBytes: 5, nextRev: 2 });
  expect(await getDoc('active')).toEqual(updated);
  expect(await historyUsage()).toBe(5);
  expect(await targetIds()).toEqual(['active']);
  expect(await getDoc('stale')).toBeNull();
  expect(await getLatestSnapshot('stale')).toBeNull();
});
