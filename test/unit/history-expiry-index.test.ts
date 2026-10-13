import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BLOBS_STORE,
  DOCS_BY_UPDATED,
  DOCS_STORE,
  HANDLES_STORE,
  requestToPromise,
  resetHistoryDbForTests,
  withStores,
} from '../../lib/history/db';
import {
  getDoc,
  getLatestSnapshot,
  pruneExpired,
  putSnapshot,
  resetHistoryClockForTests,
} from '../../lib/history/store';
import { MAX_AGE_MS, type HistoryDoc } from '../../lib/history/types';

const NOW = 2_000_000_000_000;
const CUTOFF = NOW - MAX_AGE_MS;
const EXPIRED_IDS = ['boundary-a', 'boundary-b', 'earlier'];

function doc(id: string, updatedAt: number, lastOpenedAt = updatedAt): HistoryDoc {
  return {
    id,
    title: `${id}.docx`,
    titleLower: `${id}.docx`,
    ext: 'docx',
    origin: 'local',
    size: 1,
    totalBytes: 1,
    createdAt: updatedAt,
    updatedAt,
    lastOpenedAt,
    revCount: 1,
    nextRev: 1,
  };
}

async function seedLibrary(): Promise<void> {
  const rows = Array.from({ length: 2000 }, (_, index) => doc(`recent-${index}`, NOW - index));
  rows.push(
    doc('boundary-b', CUTOFF),
    doc('earlier', CUTOFF - 1),
    doc('boundary-a', CUTOFF),
    doc('reopened-a', CUTOFF - 2, NOW),
    doc('reopened-b', CUTOFF - 3, NOW),
  );
  await withStores([DOCS_STORE, BLOBS_STORE, HANDLES_STORE], 'readwrite', async (tx) => {
    for (const row of rows) {
      tx.objectStore(DOCS_STORE).put(row);
      tx.objectStore(BLOBS_STORE).put({
        docId: row.id,
        rev: 0,
        savedAt: row.updatedAt,
        bytes: new Uint8Array([1]),
        byteLength: 1,
      });
      tx.objectStore(HANDLES_STORE).put({ docId: row.id, handle: { name: row.title } });
    }
    return true;
  });
}

function recordMetadataReads(): Array<{ source: string; rows: number }> {
  const reads: Array<{ source: string; rows: number }> = [];
  const storeGetAll = IDBObjectStore.prototype.getAll;
  vi.spyOn(IDBObjectStore.prototype, 'getAll').mockImplementation(function (this: IDBObjectStore, ...args) {
    const request = storeGetAll.apply(this, args);
    if (this.name === DOCS_STORE) {
      request.addEventListener('success', () => reads.push({ source: 'store', rows: request.result.length }));
    }
    return request;
  });
  const indexGetAll = IDBIndex.prototype.getAll;
  vi.spyOn(IDBIndex.prototype, 'getAll').mockImplementation(function (this: IDBIndex, ...args) {
    const request = indexGetAll.apply(this, args);
    if (this.objectStore.name === DOCS_STORE) {
      const source = this.name;
      request.addEventListener('success', () => reads.push({ source, rows: request.result.length }));
    }
    return request;
  });
  return reads;
}

async function storedHandle(id: string): Promise<unknown> {
  return withStores([HANDLES_STORE], 'readonly', (tx) => requestToPromise(tx.objectStore(HANDLES_STORE).get(id)));
}

beforeEach(async () => {
  resetHistoryDbForTests();
  resetHistoryClockForTests();
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.stubGlobal('navigator', { storage: { estimate: async () => ({ quota: 1_000_000 }) } });
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
  await seedLibrary();
});

afterEach(() => {
  resetHistoryDbForTests();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('indexed history expiry', () => {
  it('reads only five expiry candidates among 2005 documents and preserves boundary/tie ordering', async () => {
    const reads = recordMetadataReads();
    expect(await pruneExpired()).toEqual(EXPIRED_IDS);
    expect(reads).toEqual([{ source: DOCS_BY_UPDATED, rows: 5 }]);

    for (const id of EXPIRED_IDS) {
      expect(await getDoc(id)).toBeNull();
      expect(await getLatestSnapshot(id)).toBeNull();
      expect(await storedHandle(id)).toBeUndefined();
    }
    for (const id of ['recent-0', 'recent-1999', 'reopened-a', 'reopened-b']) {
      expect(await getDoc(id)).not.toBeNull();
      expect(Array.from((await getLatestSnapshot(id))!.bytes)).toEqual([1]);
      expect(await storedHandle(id)).toEqual({ docId: id, handle: { name: `${id}.docx` } });
    }
  });

  it('leaves only the budget full scan when a snapshot also sweeps expiry', async () => {
    const reads = recordMetadataReads();
    const saved = await putSnapshot({ id: 'fresh', title: 'Fresh.docx', origin: 'local', bytes: new Uint8Array(7) });
    expect(saved).toMatchObject({ id: 'fresh', totalBytes: 7, revCount: 1 });
    expect(reads).toEqual([
      { source: DOCS_BY_UPDATED, rows: 5 },
      { source: 'store', rows: 2003 },
    ]);
    expect(await getDoc('earlier')).toBeNull();
    expect(await getDoc('reopened-a')).not.toBeNull();
    expect((await getLatestSnapshot('fresh'))?.byteLength).toBe(7);
  });

  it('rolls back expiry, handles and the new snapshot when its owner cancels during deletion', async () => {
    const reads = recordMetadataReads();
    const controller = new AbortController();
    const remove = IDBObjectStore.prototype.delete;
    vi.spyOn(IDBObjectStore.prototype, 'delete').mockImplementation(function (this: IDBObjectStore, ...args) {
      const request = remove.apply(this, args);
      if (this.name === BLOBS_STORE) controller.abort();
      return request;
    });

    expect(
      await putSnapshot(
        { id: 'cancelled', title: 'Cancelled.docx', origin: 'local', bytes: new Uint8Array(7) },
        controller.signal,
      ),
    ).toBeNull();
    expect(reads).toEqual([{ source: DOCS_BY_UPDATED, rows: 5 }]);
    expect(await getDoc('cancelled')).toBeNull();
    expect(await getLatestSnapshot('cancelled')).toBeNull();
    for (const id of EXPIRED_IDS) {
      expect(await getDoc(id)).not.toBeNull();
      expect(Array.from((await getLatestSnapshot(id))!.bytes)).toEqual([1]);
      expect(await storedHandle(id)).toEqual({ docId: id, handle: { name: `${id}.docx` } });
    }
  });
});
