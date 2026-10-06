import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory, IDBObjectStore, IDBIndex } from 'fake-indexeddb';

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('indexedDB', new IDBFactory());
  sessionStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const sample = () =>
  new File(['original bytes'], '测试 résumé.docx', { type: 'application/test', lastModified: 12345 });
const api = () => import('../../lib/active-document-source');
const retainedCount = () =>
  new Promise<number>((done, fail) => {
    const req = indexedDB.open('document-active-sources', 1);
    req.onerror = () => fail(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const count = db.transaction('sources').objectStore('sources').count();
      count.onsuccess = () => {
        db.close();
        done(count.result);
      };
    };
  });

describe('active tab document source', () => {
  it('retains original bytes and metadata for repeated reads after module reload', async () => {
    const source = await api();
    expect(await source.rememberActiveSource('doc-a', sample())).toBe(true);
    vi.resetModules();
    const reloaded = await api();
    for (let i = 0; i < 2; i++) {
      const file = await reloaded.readActiveSource('doc-a');
      expect(file?.name).toBe('测试 résumé.docx');
      expect(file?.type).toBe('application/test');
      expect(file?.lastModified).toBe(12345);
      expect(await file?.text()).toBe('original bytes');
    }
  });

  it('does not recover a different document or a tab without the source pointer', async () => {
    const source = await api();
    await source.rememberActiveSource('doc-a', sample());
    expect(await source.readActiveSource('doc-b')).toBeNull();
    sessionStorage.clear();
    expect(await source.readActiveSource('doc-a')).toBeNull();
  });

  it('switches the active source to the newer document', async () => {
    const source = await api();
    await source.rememberActiveSource('doc-a', sample());
    await source.rememberActiveSource('doc-b', new File(['new'], 'B.docx'));
    expect(await source.readActiveSource('doc-a')).toBeNull();
    expect(await (await source.readActiveSource('doc-b'))?.text()).toBe('new');
    expect(await retainedCount()).toBe(1);
  });

  it('expires a source after 24 hours without access', async () => {
    const source = await api();
    const now = vi.spyOn(Date, 'now').mockReturnValue(1000);
    await source.rememberActiveSource('doc-a', sample());
    now.mockReturnValue(1000 + 24 * 60 * 60 * 1000);
    expect(await source.readActiveSource('doc-a')).toBeNull();
    expect(await retainedCount()).toBe(0);
    now.mockRestore();
  });

  it('clears the source on explicit release', async () => {
    const source = await api();
    await source.rememberActiveSource('doc-a', sample());
    await source.clearActiveSource();
    expect(await source.readActiveSource('doc-a')).toBeNull();
  });

  it('does not resurrect sources after explicit document deletion', async () => {
    const source = await api();
    await source.rememberActiveSource('doc-a', sample());
    await source.deleteDocumentSources('doc-a');
    expect(await source.readActiveSource('doc-a')).toBeNull();
  });

  it('survives unavailable IndexedDB', async () => {
    vi.stubGlobal('indexedDB', {
      open: () => {
        throw new Error('denied');
      },
    });
    const source = await api();
    expect(await source.rememberActiveSource('doc-a', sample())).toBe(false);
    expect(await source.readActiveSource('doc-a')).toBeNull();
    await source.clearActiveSource();
  });

  it('keeps the newer pointer when an older file read finishes late', async () => {
    const source = await api();
    const first = sample();
    let release!: (bytes: ArrayBuffer) => void;
    const read = vi.spyOn(first, 'arrayBuffer').mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const old = source.rememberActiveSource('doc-a', first);
    await vi.waitFor(() => expect(read).toHaveBeenCalled());
    expect(await source.rememberActiveSource('doc-b', new File(['new'], 'B.docx'))).toBe(true);
    release(new TextEncoder().encode('old').buffer);
    expect(await old).toBe(false);
    expect(await source.readActiveSource('doc-a')).toBeNull();
    expect(await (await source.readActiveSource('doc-b'))?.text()).toBe('new');
    read.mockRestore();
  });

  it('preserves the previous source when storage quota rejects a replacement', async () => {
    const source = await api();
    await source.rememberActiveSource('doc-a', sample());
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    expect(await source.rememberActiveSource('doc-b', sample())).toBe(false);
    put.mockRestore();
    expect(await (await source.readActiveSource('doc-a'))?.text()).toBe('original bytes');
  });

  it('removes an unusable partial record when reading fallback bytes fails', async () => {
    const source = await api();
    const file = sample();
    // Model a browser that silently clones a File as an empty object. Keep
    // the actual IndexedDB transaction/readback; only clone fidelity changes.
    const original = IDBObjectStore.prototype.put;
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      value,
      key,
    ) {
      return original.call(this, { ...value, file: {} }, key);
    });
    const read = vi.spyOn(file, 'arrayBuffer').mockRejectedValue(new Error('read failed'));
    expect(await source.rememberActiveSource('doc-a', file)).toBe(false);
    const count = await new Promise<number>((done, fail) => {
      const req = indexedDB.open('document-active-sources', 1);
      req.onerror = () => fail(req.error);
      req.onsuccess = () => {
        const db = req.result;
        const count = db.transaction('sources').objectStore('sources').count();
        count.onsuccess = () => {
          db.close();
          done(count.result);
        };
      };
    });
    expect(count).toBe(0);
    put.mockRestore();
    read.mockRestore();
  });

  it('does not recreate a source deleted by another tab while a read is finishing', async () => {
    const source = await api();
    await source.rememberActiveSource('doc-a', sample());
    const db = await new Promise<IDBDatabase>((done, fail) => {
      const req = indexedDB.open('document-active-sources', 1);
      req.onsuccess = () => done(req.result);
      req.onerror = () => fail(req.error);
    });
    let deleted: Promise<unknown> = Promise.resolve();
    let queued = false;
    const original = IDBObjectStore.prototype.get;
    vi.spyOn(IDBObjectStore.prototype, 'get').mockImplementation(function (this: IDBObjectStore, key) {
      const req = original.call(this, key);
      req.addEventListener('success', () => {
        if (queued || !req.result) return;
        queued = true;
        deleted = new Promise<void>((done, fail) => {
          const tx = db.transaction('sources', 'readwrite');
          tx.objectStore('sources').delete(key);
          tx.oncomplete = () => done();
          tx.onerror = () => fail(tx.error);
        });
      });
      return req;
    });
    const recovered = await source.readActiveSource('doc-a');
    await deleted;
    const count = await new Promise<number>((done) => {
      const req = db.transaction('sources').objectStore('sources').count();
      req.onsuccess = () => done(req.result);
    });
    db.close();
    expect(count).toBe(0);
    expect(recovered).toBeNull();
  });

  it('does not restore a pending file after another tab deletes its candidate', async () => {
    const firstTab = await api();
    const file = sample();
    let finish!: (buffer: ArrayBuffer) => void;
    const read = vi.spyOn(file, 'arrayBuffer').mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const pending = firstTab.rememberActiveSource('doc-a', file);
    await vi.waitFor(() => expect(read).toHaveBeenCalled());
    vi.resetModules();
    const otherTab = await api();
    await otherTab.deleteDocumentSources('doc-a');
    finish(new TextEncoder().encode('original bytes').buffer);
    expect(await pending).toBe(false);
    expect(await firstTab.readActiveSource('doc-a')).toBeNull();
  });

  it('honors deletion queued during expiry cleanup before file reading', async () => {
    const firstTab = await api();
    vi.resetModules();
    const otherTab = await api();
    const original = IDBIndex.prototype.openKeyCursor;
    let queued = false;
    let deleted: Promise<unknown> = Promise.resolve();
    vi.spyOn(IDBIndex.prototype, 'openKeyCursor').mockImplementation(function (this: IDBIndex, range, direction) {
      const request = original.call(this, range, direction);
      if (this.name === 'expiry')
        request.addEventListener('success', () => {
          if (queued) return;
          queued = true;
          deleted = otherTab.deleteDocumentSources('doc-a');
        });
      return request;
    });
    const remembered = await firstTab.rememberActiveSource('doc-a', sample());
    await deleted;
    expect(remembered).toBe(false);
    expect(await firstTab.readActiveSource('doc-a')).toBeNull();
  });

  it('keeps the source alive for 24 hours from its last successful access', async () => {
    const source = await api();
    const now = vi.spyOn(Date, 'now').mockReturnValue(1000);
    await source.rememberActiveSource('doc-a', sample());
    now.mockReturnValue(1000 + 12 * 60 * 60 * 1000);
    expect(await source.readActiveSource('doc-a')).not.toBeNull();
    now.mockReturnValue(1000 + 35 * 60 * 60 * 1000);
    expect(await source.readActiveSource('doc-a')).not.toBeNull();
  });

  it('does not persist bytes when the tab pointer storage is denied', async () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new DOMException('denied', 'SecurityError');
      },
      setItem: () => {
        throw new DOMException('denied', 'SecurityError');
      },
      removeItem: () => {
        throw new DOMException('denied', 'SecurityError');
      },
    });
    const source = await api();
    expect(await source.rememberActiveSource('doc-a', sample())).toBe(false);
    expect(await source.readActiveSource('doc-a')).toBeNull();
  });

  it('forgets all originals when explicit deletion has no document id', async () => {
    const source = await api();
    await source.rememberActiveSource('doc-a', sample());
    await source.deleteDocumentSources();
    expect(await source.readActiveSource('doc-a')).toBeNull();
  });

  it('does not create a document history database merely for source retention', async () => {
    const source = await api();
    await source.rememberActiveSource('doc-a', sample());
    const names = (await indexedDB.databases()).map((db) => db.name);
    expect(names).not.toContain('document-history');
  });

  it('rejects a mismatched token even when the document id matches', async () => {
    const source = await api();
    await source.rememberActiveSource('doc-a', sample());
    sessionStorage.setItem('document-active-source', JSON.stringify({ docId: 'doc-a', key: 'wrong-token' }));
    expect(await source.readActiveSource('doc-a')).toBeNull();
  });

  it('keeps the previous source when an asynchronous write transaction aborts', async () => {
    const source = await api();
    await source.rememberActiveSource('doc-a', sample());
    const original = IDBObjectStore.prototype.put;
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      value,
      key,
    ) {
      const request = original.call(this, value, key);
      queueMicrotask(() => this.transaction.abort());
      return request;
    });
    expect(await source.rememberActiveSource('doc-b', sample())).toBe(false);
    put.mockRestore();
    expect(await (await source.readActiveSource('doc-a'))?.text()).toBe('original bytes');
    expect(await retainedCount()).toBe(1);
  });
});
