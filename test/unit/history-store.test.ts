import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DB_NAME, resetHistoryDbForTests } from '../../lib/history/db';
import {
  DEFAULT_PAGE_SIZE,
  MAX_REVS_PER_DOC,
  clearAllHistory,
  deleteDoc,
  getDoc,
  getLatestSnapshot,
  historyUsage,
  pruneExpired,
  listDocs,
  markOpened,
  markSavedToDisk,
  putSnapshot,
  resetHistoryClockForTests,
  storageBudget,
} from '../../lib/history/store';
import { MAX_AGE_MS, daysUntilExpiry, hasUnsavedWork } from '../../lib/history/types';

function bytes(size: number, fill = 65): Uint8Array {
  return new Uint8Array(size).fill(fill);
}

async function wipe(): Promise<void> {
  resetHistoryDbForTests();
  resetHistoryClockForTests();
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

// jsdom ships no StorageManager; the budget path reads one when it exists.
function mockQuota(quota: number): void {
  Object.defineProperty(navigator, 'storage', {
    value: { estimate: () => Promise.resolve({ quota, usage: 0 }) },
    configurable: true,
  });
}

describe('history store', () => {
  beforeEach(async () => {
    await wipe();
    mockQuota(2_000_000);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('stores a snapshot and reads its metadata back', async () => {
    const doc = await putSnapshot({ title: 'Report.docx', origin: 'local', bytes: bytes(128) });

    expect(doc).not.toBeNull();
    expect(doc?.title).toBe('Report.docx');
    expect(doc?.ext).toBe('docx');
    expect(doc?.size).toBe(128);
    expect(doc?.totalBytes).toBe(128);
    expect(doc?.revCount).toBe(1);

    const { items, total } = await listDocs();
    expect(total).toBe(1);
    expect(items[0].id).toBe(doc?.id);
  });

  it('appends revisions to the same document and hands back the newest bytes', async () => {
    const first = await putSnapshot({ title: 'Report.docx', origin: 'local', bytes: bytes(10, 1) });
    const second = await putSnapshot({ id: first!.id, title: 'Report.docx', origin: 'local', bytes: bytes(20, 2) });

    expect(second?.id).toBe(first!.id);
    expect(second?.revCount).toBe(2);
    expect(second?.totalBytes).toBe(30);

    const latest = await getLatestSnapshot(first!.id);
    expect(latest?.byteLength).toBe(20);
    expect(latest!.bytes[0]).toBe(2);

    // One document, not two.
    expect((await listDocs()).total).toBe(1);
  });

  it('keeps only the newest revisions and accounts for the bytes it dropped', async () => {
    let id: string | undefined;
    for (let i = 0; i < MAX_REVS_PER_DOC + 2; i += 1) {
      const doc = await putSnapshot({ id, title: 'Long.docx', origin: 'local', bytes: bytes(100) });
      id = doc!.id;
    }

    const doc = await getDoc(id!);
    expect(doc?.revCount).toBe(MAX_REVS_PER_DOC);
    expect(doc?.totalBytes).toBe(MAX_REVS_PER_DOC * 100);
    expect(await historyUsage()).toBe(MAX_REVS_PER_DOC * 100);

    // The surviving revisions are the newest ones.
    const latest = await getLatestSnapshot(id!);
    expect(latest?.rev).toBe(MAX_REVS_PER_DOC + 1);
  });

  it('pages the list newest first and clamps a page past the end', async () => {
    for (let i = 0; i < DEFAULT_PAGE_SIZE + 5; i += 1) {
      await putSnapshot({ title: `Doc-${i}.docx`, origin: 'local', bytes: bytes(8) });
    }

    const first = await listDocs();
    expect(first.items).toHaveLength(DEFAULT_PAGE_SIZE);
    expect(first.total).toBe(DEFAULT_PAGE_SIZE + 5);
    expect(first.items[0].title).toBe(`Doc-${DEFAULT_PAGE_SIZE + 4}.docx`);

    const second = await listDocs({ page: 2 });
    expect(second.items).toHaveLength(5);

    const past = await listDocs({ page: 99 });
    expect(past.page).toBe(2);
    expect(past.items).toHaveLength(5);
  });

  it('searches titles case-insensitively and by substring, including Chinese', async () => {
    await putSnapshot({ title: 'Quarterly Report.docx', origin: 'local', bytes: bytes(8) });
    await putSnapshot({ title: '年度总结报告.docx', origin: 'local', bytes: bytes(8) });
    await putSnapshot({ title: 'budget.xlsx', origin: 'local', bytes: bytes(8) });

    expect((await listDocs({ query: 'report' })).total).toBe(1);
    expect((await listDocs({ query: 'REPORT' })).total).toBe(1);
    // Substring, not prefix -- the thing an IndexedDB key range cannot do.
    expect((await listDocs({ query: '总结' })).total).toBe(1);
    expect((await listDocs({ query: 'nothing' })).total).toBe(0);
  });

  it('deletes a document together with its bytes', async () => {
    const doc = await putSnapshot({ title: 'Gone.docx', origin: 'local', bytes: bytes(64) });

    expect(await deleteDoc(doc!.id)).toBe(true);
    expect(await getDoc(doc!.id)).toBeNull();
    expect(await getLatestSnapshot(doc!.id)).toBeNull();
    expect(await historyUsage()).toBe(0);
  });

  it('clears the library, bytes included', async () => {
    const a = await putSnapshot({ title: 'A.docx', origin: 'local', bytes: bytes(64) });
    await putSnapshot({ title: 'B.docx', origin: 'local', bytes: bytes(64) });

    expect(await clearAllHistory()).toBe(true);
    expect((await listDocs()).total).toBe(0);
    // The promise a "clear everything" button makes is about the content, not
    // the index: the bytes have to be gone too.
    expect(await getLatestSnapshot(a!.id)).toBeNull();
  });

  it('evicts the least-recently-opened document when the budget is exceeded', async () => {
    mockQuota(600);
    expect(await storageBudget()).toBe(300);

    const cold = await putSnapshot({ title: 'Cold.docx', origin: 'local', bytes: bytes(100) });
    const warm = await putSnapshot({ title: 'Warm.docx', origin: 'local', bytes: bytes(100) });
    await markOpened(warm!.id);
    // Pushes the library past the 300-byte budget.
    const fresh = await putSnapshot({ title: 'Fresh.docx', origin: 'local', bytes: bytes(150) });

    const titles = (await listDocs()).items.map((doc) => doc.title);
    expect(titles).toContain('Fresh.docx');
    expect(titles).not.toContain('Cold.docx');
    expect(await getLatestSnapshot(cold!.id)).toBeNull();
    expect(await getDoc(fresh!.id)).not.toBeNull();
  });

  it('makes room and retries once when the browser refuses a write', async () => {
    await putSnapshot({ title: 'Old.docx', origin: 'local', bytes: bytes(16) });

    const put = IDBObjectStore.prototype.put;
    let thrown = false;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args) {
      if (!thrown && this.name === 'blobs') {
        thrown = true;
        throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' });
      }
      return put.apply(this, args as Parameters<typeof put>);
    });

    const doc = await putSnapshot({ title: 'New.docx', origin: 'local', bytes: bytes(16) });

    expect(thrown).toBe(true);
    expect(doc).not.toBeNull();
    // The retry paid for itself by dropping the coldest document.
    expect((await listDocs()).items.map((row) => row.title)).toEqual(['New.docx']);
  });

  it.each(['QuotaExceededError', 'UnknownError'])(
    'preserves recovery when the quota retry fails with %s',
    async (retryError) => {
      const cold = await putSnapshot({ title: 'Recovery.docx', origin: 'local', bytes: bytes(16, 7) });
      const current = await putSnapshot({ title: 'Current.docx', origin: 'local', bytes: bytes(16, 9) });
      const put = IDBObjectStore.prototype.put;
      let attempts = 0;
      vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args) {
        if (this.name === 'blobs') {
          attempts++;
          throw Object.assign(new Error('Snapshot write failed'), {
            name: attempts === 1 ? 'QuotaExceededError' : retryError,
          });
        }
        return put.apply(this, args as Parameters<typeof put>);
      });

      const result = await putSnapshot({
        id: current!.id,
        title: 'Changed.docx',
        origin: 'local',
        bytes: bytes(32, 1),
      });

      expect(result).toBeNull();
      expect(attempts).toBe(2);
      expect(await getDoc(cold!.id)).toEqual(cold);
      expect(Array.from((await getLatestSnapshot(cold!.id))!.bytes)).toEqual(Array(16).fill(7));
      expect(await getDoc(current!.id)).toEqual(current);
      expect(Array.from((await getLatestSnapshot(current!.id))!.bytes)).toEqual(Array(16).fill(9));
      expect((await listDocs()).total).toBe(2);
    },
  );

  it('rejects an impossible snapshot without evicting existing recovery', async () => {
    mockQuota(200);
    const keep = await putSnapshot({ title: 'Keep.docx', origin: 'local', bytes: bytes(40, 7) });
    const large = await putSnapshot({ title: 'Too large.docx', origin: 'local', bytes: bytes(120) });
    expect(large).toBeNull();
    expect(Array.from((await getLatestSnapshot(keep!.id))!.bytes)).toEqual(Array(40).fill(7));
    expect(await historyUsage()).toBe(40);
  });

  it('trims its own revisions to the budget before evicting unrelated history', async () => {
    mockQuota(240);
    const keep = await putSnapshot({ title: 'Keep.docx', origin: 'local', bytes: bytes(10, 7) });
    const first = await putSnapshot({ title: 'Large.docx', origin: 'local', bytes: bytes(60, 1) });
    const next = await putSnapshot({ id: first!.id, title: 'Large.docx', origin: 'local', bytes: bytes(70, 2) });
    expect(next?.revCount).toBe(1);
    expect(next?.totalBytes).toBe(70);
    expect(await historyUsage()).toBe(80);
    expect(Array.from((await getLatestSnapshot(keep!.id))!.bytes)).toEqual(Array(10).fill(7));
    expect(Array.from((await getLatestSnapshot(first!.id))!.bytes)).toEqual(Array(70).fill(2));
  });

  it('reads only the latest blob and prunes without cloning retained versions', async () => {
    const first = await putSnapshot({ title: 'Versions.docx', origin: 'local', bytes: bytes(10, 1) });
    for (const value of [2, 3])
      await putSnapshot({ id: first!.id, title: 'Versions.docx', origin: 'local', bytes: bytes(10, value) });
    const all = IDBIndex.prototype.getAll;
    vi.spyOn(IDBIndex.prototype, 'getAll').mockImplementation(function (this: IDBIndex, ...args) {
      if (this.objectStore.name === 'blobs') throw new Error('Unbounded blob read');
      return all.apply(this, args as Parameters<typeof all>);
    });
    expect(Array.from((await getLatestSnapshot(first!.id))!.bytes)).toEqual(Array(10).fill(3));
    const next = await putSnapshot({ id: first!.id, title: 'Versions.docx', origin: 'local', bytes: bytes(10, 4) });
    expect(next?.totalBytes).toBe(30);
    expect(next?.revCount).toBe(3);
    expect(Array.from((await getLatestSnapshot(first!.id))!.bytes)).toEqual(Array(10).fill(4));
  });

  it('deletes documents that went seven days without being touched', async () => {
    const stale = await putSnapshot({ title: 'Stale.docx', origin: 'local', bytes: bytes(16) });
    const fresh = await putSnapshot({ title: 'Fresh.docx', origin: 'local', bytes: bytes(16) });

    // Only Date is faked: faking timers as well would stall fake-indexeddb,
    // which drives its transactions through the macrotask queue.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + MAX_AGE_MS + 1000);
    // Coming back to the fresh one restarts its clock; nobody touched the other.
    await markOpened(fresh!.id);

    expect(await pruneExpired()).toEqual([stale!.id]);
    expect(await getDoc(stale!.id)).toBeNull();
    expect(await getLatestSnapshot(stale!.id)).toBeNull();
    expect(await getDoc(fresh!.id)).not.toBeNull();
    vi.useRealTimers();
  });

  it('sweeps expired documents on the next write, without waiting for a visit', async () => {
    const stale = await putSnapshot({ title: 'Stale.docx', origin: 'local', bytes: bytes(16) });

    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + MAX_AGE_MS + 1000);
    await putSnapshot({ title: 'Later.docx', origin: 'local', bytes: bytes(16) });

    expect(await getDoc(stale!.id)).toBeNull();
    expect((await listDocs()).items.map((doc) => doc.title)).toEqual(['Later.docx']);
    vi.useRealTimers();
  });

  it('counts the days a document has left', async () => {
    const doc = await putSnapshot({ title: 'Counting.docx', origin: 'local', bytes: bytes(8) });

    expect(daysUntilExpiry(doc!, doc!.updatedAt)).toBe(7);
    expect(daysUntilExpiry(doc!, doc!.updatedAt + 6.5 * 24 * 60 * 60 * 1000)).toBe(1);
    expect(daysUntilExpiry(doc!, doc!.updatedAt + MAX_AGE_MS + 1)).toBe(0);
  });

  it('marks work as unsaved until the bytes reach the disk', async () => {
    const doc = await putSnapshot({ title: 'Unsaved.docx', origin: 'local', bytes: bytes(8) });
    expect(hasUnsavedWork(doc!)).toBe(true);

    await markSavedToDisk(doc!.id);
    expect(hasUnsavedWork((await getDoc(doc!.id))!)).toBe(false);
  });
  it('does not start a snapshot write after cancellation during the storage estimate', async () => {
    const controller = new AbortController();
    let estimated!: (value: { quota: number }) => void;
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {
        estimate: () =>
          new Promise((resolve) => {
            estimated = resolve;
          }),
      },
    });
    const pending = putSnapshot(
      { id: 'cancelled', title: 'Cancelled.docx', origin: 'local', bytes: bytes(4) },
      controller.signal,
    );
    controller.abort();
    estimated({ quota: 1000 });
    expect(await pending).toBeNull();
    expect(await getDoc('cancelled')).toBeNull();
    mockQuota(1000);
  });
  it('rolls back in-progress snapshot writes when their owner cancels', async () => {
    mockQuota(1000);
    const controller = new AbortController();
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args) {
      const request = put.apply(this, args as Parameters<typeof put>);
      if (this.name === 'blobs') controller.abort();
      return request;
    });
    expect(
      await putSnapshot(
        { id: 'rolled-back', title: 'Rollback.docx', origin: 'local', bytes: bytes(4) },
        controller.signal,
      ),
    ).toBeNull();
    expect(await getDoc('rolled-back')).toBeNull();
    expect(await getLatestSnapshot('rolled-back')).toBeNull();
  });
  it('does not evict other recovery documents for an export cancelled at quota failure', async () => {
    mockQuota(1000);
    const old = await putSnapshot({ title: 'Keep.docx', origin: 'local', bytes: bytes(4) });
    const controller = new AbortController();
    const put = IDBObjectStore.prototype.put;
    let first = true;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args) {
      if (this.name === 'blobs' && first) {
        first = false;
        controller.abort();
        throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' });
      }
      return put.apply(this, args as Parameters<typeof put>);
    });
    expect(
      await putSnapshot(
        { id: 'cancelled-quota', title: 'New.docx', origin: 'local', bytes: bytes(4) },
        controller.signal,
      ),
    ).toBeNull();
    expect(await getDoc(old!.id)).not.toBeNull();
    expect(await getDoc('cancelled-quota')).toBeNull();
  });
  it('rolls back quota eviction if the export is cancelled while old blobs are being deleted', async () => {
    mockQuota(1000);
    const old = await putSnapshot({ title: 'Keep.docx', origin: 'local', bytes: bytes(4, 7) });
    const controller = new AbortController();
    const put = IDBObjectStore.prototype.put;
    let first = true;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args) {
      if (this.name === 'blobs' && first) {
        first = false;
        throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' });
      }
      return put.apply(this, args as Parameters<typeof put>);
    });
    const remove = IDBObjectStore.prototype.delete;
    vi.spyOn(IDBObjectStore.prototype, 'delete').mockImplementation(function (this: IDBObjectStore, ...args) {
      const request = remove.apply(this, args);
      if (this.name === 'blobs') controller.abort();
      return request;
    });
    expect(
      await putSnapshot(
        { id: 'aborted-eviction', title: 'New.docx', origin: 'local', bytes: bytes(4) },
        controller.signal,
      ),
    ).toBeNull();
    expect(await getDoc(old!.id)).not.toBeNull();
    expect(Array.from((await getLatestSnapshot(old!.id))!.bytes)).toEqual([7, 7, 7, 7]);
    expect(await getDoc('aborted-eviction')).toBeNull();
  });
});
