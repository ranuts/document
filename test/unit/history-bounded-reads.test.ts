import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BLOBS_BY_DOC,
  BLOBS_STORE,
  DB_NAME,
  DOCS_BY_UPDATED,
  DOCS_STORE,
  HANDLES_STORE,
  openHistoryDb,
  requestToPromise,
  resetHistoryDbForTests,
  withStores,
} from '../../lib/history/db';
import {
  getDoc,
  getLatestSnapshot,
  historyUsage,
  putSnapshot,
  resetHistoryClockForTests,
} from '../../lib/history/store';
import type { HistoryDoc, HistorySnapshot } from '../../lib/history/types';

const legacyDoc: HistoryDoc = {
  id: 'legacy',
  title: 'Legacy.docx',
  titleLower: 'legacy.docx',
  ext: 'docx',
  origin: 'local',
  size: 19,
  totalBytes: 39,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  lastOpenedAt: Date.now(),
  revCount: 3,
  nextRev: 25,
  savedToDiskAt: 123,
};
const legacySnapshots: HistorySnapshot[] = [
  { docId: 'legacy', rev: 2, savedAt: 300, byteLength: 7, bytes: new Uint8Array(7).fill(2) },
  { docId: 'legacy', rev: 11, savedAt: 200, byteLength: 13, bytes: new Uint8Array(13).fill(11) },
  { docId: 'legacy', rev: 24, savedAt: 100, byteLength: 19, bytes: new Uint8Array(19).fill(24) },
];

async function seedLegacy(version = 2): Promise<IDBDatabase> {
  const request = indexedDB.open(DB_NAME, version);
  request.onupgradeneeded = () => {
    const docs = request.result.createObjectStore(DOCS_STORE, { keyPath: 'id' });
    docs.createIndex(DOCS_BY_UPDATED, 'updatedAt');
    const blobs = request.result.createObjectStore(BLOBS_STORE, { keyPath: ['docId', 'rev'] });
    blobs.createIndex(BLOBS_BY_DOC, 'docId');
    if (version === 2) request.result.createObjectStore(HANDLES_STORE, { keyPath: 'docId' });
  };
  const db = await requestToPromise(request);
  const stores = version === 2 ? [DOCS_STORE, BLOBS_STORE, HANDLES_STORE] : [DOCS_STORE, BLOBS_STORE];
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(stores, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
    tx.objectStore(DOCS_STORE).put(legacyDoc);
    for (const snapshot of legacySnapshots) tx.objectStore(BLOBS_STORE).put(snapshot);
    if (version === 2) tx.objectStore(HANDLES_STORE).put({ docId: 'legacy', handle: { name: 'Legacy.docx' } });
  });
  return db;
}

function forbidBulkBlobReads(): void {
  const storeGetAll = IDBObjectStore.prototype.getAll;
  vi.spyOn(IDBObjectStore.prototype, 'getAll').mockImplementation(function (this: IDBObjectStore, ...args) {
    if (this.name === BLOBS_STORE) throw new Error('Bulk snapshot reads copy every revision');
    return storeGetAll.apply(this, args);
  });
  const indexGetAll = IDBIndex.prototype.getAll;
  vi.spyOn(IDBIndex.prototype, 'getAll').mockImplementation(function (this: IDBIndex, ...args) {
    if (this.objectStore.name === BLOBS_STORE) throw new Error('Bulk snapshot reads copy every revision');
    return indexGetAll.apply(this, args);
  });
}

function forbidBlobValueCursors(): void {
  const storeCursor = IDBObjectStore.prototype.openCursor;
  vi.spyOn(IDBObjectStore.prototype, 'openCursor').mockImplementation(function (this: IDBObjectStore, ...args) {
    if (this.name === BLOBS_STORE) throw new Error('Trimming must not clone snapshot bytes');
    return storeCursor.apply(this, args);
  });
  const indexCursor = IDBIndex.prototype.openCursor;
  vi.spyOn(IDBIndex.prototype, 'openCursor').mockImplementation(function (this: IDBIndex, ...args) {
    if (this.objectStore.name === BLOBS_STORE) throw new Error('Trimming must not clone snapshot bytes');
    return indexCursor.apply(this, args);
  });
}

beforeEach(() => {
  resetHistoryDbForTests();
  resetHistoryClockForTests();
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.stubGlobal('navigator', { storage: { estimate: async () => ({ quota: 10000 }) } });
});
afterEach(() => {
  resetHistoryDbForTests();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('bounded history snapshot reads', () => {
  it('reads only the highest revision even when revision numbers have gaps and timestamps disagree', async () => {
    (await seedLegacy()).close();
    forbidBulkBlobReads();
    const advance = IDBCursor.prototype.continue;
    vi.spyOn(IDBCursor.prototype, 'continue').mockImplementation(function (this: IDBCursor, ...args) {
      const store = this.source instanceof IDBIndex ? this.source.objectStore : this.source;
      if (store.name === BLOBS_STORE) throw new Error('Latest read must stop at its first snapshot');
      return advance.apply(this, args);
    });

    const latest = await getLatestSnapshot('legacy');
    expect(latest?.rev).toBe(24);
    expect(Array.from(latest!.bytes)).toEqual(Array.from({ length: 19 }, () => 24));
    expect(await getLatestSnapshot('missing')).toBeNull();
  });

  it.each([1, 2])(
    'trims legacy v%s revisions without reading blob values and keeps exact accounting',
    async (version) => {
      (await seedLegacy(version)).close();
      forbidBulkBlobReads();
      forbidBlobValueCursors();

      const doc = await putSnapshot({
        id: 'legacy',
        title: 'Legacy.docx',
        origin: 'new',
        bytes: new Uint8Array(23).fill(25),
      });
      expect(doc).toMatchObject({
        revCount: 3,
        totalBytes: 55,
        nextRev: 26,
        size: 23,
        origin: 'local',
        savedToDiskAt: 123,
      });
      expect(await historyUsage()).toBe(55);
      expect(await getDoc('legacy')).toEqual(doc);
      const retained = await withStores([BLOBS_STORE], 'readonly', (tx) =>
        requestToPromise(tx.objectStore(BLOBS_STORE).index(BLOBS_BY_DOC).getAllKeys(IDBKeyRange.only('legacy'))),
      );
      expect(retained).toEqual([
        ['legacy', 11],
        ['legacy', 24],
        ['legacy', 25],
      ]);
      const handle = await withStores([HANDLES_STORE], 'readonly', (tx) =>
        requestToPromise(tx.objectStore(HANDLES_STORE).get('legacy')),
      );
      expect(handle).toEqual(version === 2 ? { docId: 'legacy', handle: { name: 'Legacy.docx' } } : undefined);
    },
  );

  it('rolls back trimming, revision allocation and byte accounting when the owner cancels during deletion', async () => {
    (await seedLegacy()).close();
    const controller = new AbortController();
    const remove = IDBObjectStore.prototype.delete;
    vi.spyOn(IDBObjectStore.prototype, 'delete').mockImplementation(function (this: IDBObjectStore, ...args) {
      const request = remove.apply(this, args);
      if (this.name === BLOBS_STORE) controller.abort();
      return request;
    });

    expect(
      await putSnapshot(
        { id: 'legacy', title: 'Changed.docx', origin: 'local', bytes: new Uint8Array(23) },
        controller.signal,
      ),
    ).toBeNull();
    expect(await getDoc('legacy')).toEqual(legacyDoc);
    expect(await historyUsage()).toBe(39);
    expect((await getLatestSnapshot('legacy'))?.rev).toBe(24);
    const retained = await withStores([BLOBS_STORE], 'readonly', (tx) =>
      requestToPromise(tx.objectStore(BLOBS_STORE).index(BLOBS_BY_DOC).getAllKeys(IDBKeyRange.only('legacy'))),
    );
    expect(retained).toEqual([
      ['legacy', 2],
      ['legacy', 11],
      ['legacy', 24],
    ]);
  });

  it('can retry a blocked legacy upgrade after the other tab releases its connection', async () => {
    const oldTab = await seedLegacy();
    try {
      expect(await openHistoryDb()).toBeNull();
    } finally {
      oldTab.close();
    }
    // Let the previously blocked open finish before retrying. Its connection
    // must not remain open after the caller has been told storage is unavailable.
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME);
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
    expect(await getDoc('legacy')).toEqual(legacyDoc);
    expect((await getLatestSnapshot('legacy'))?.rev).toBe(24);
  });
});
