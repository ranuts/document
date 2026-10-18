/** Reload bytes for this tab, separate from document history. */
const DB = 'document-active-sources';
const STORE = 'sources';
const POINTER = 'document-active-source';
const LIFETIME = 24 * 60 * 60 * 1000;
let revision = 0;
type Pointer = { docId: string; key: string; savedThroughRevision?: number; historyCreatedAt?: number };
// Heap ownership is never inherited by a duplicate tab. Each open takes a new
// slot; only subsequent disk saves in this runtime may replace that slot.
let activeSlot: Pointer | null = null;
type SourceProvenance = Pick<Pointer, 'savedThroughRevision' | 'historyCreatedAt'>;
// Recovery hands this exact File to the ordinary open path. Its provenance
// comes from the stored bytes, never from a copied tab's stale pointer fields.
const recoveredFiles = new WeakMap<File, SourceProvenance>();
type Source = Pointer & {
  expiresAt: number;
  name: string;
  type: string;
  lastModified: number;
  file?: File;
  bytes?: Uint8Array;
};

function pointer(): Pointer | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(POINTER) || 'null');
    return value && typeof value.docId === 'string' && typeof value.key === 'string' ? value : null;
  } catch {
    return null;
  }
}

async function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    let done = false;
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB, 1);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(STORE, { keyPath: 'key' });
      store.createIndex('expiry', 'expiresAt');
      store.createIndex('document', 'docId');
    };
    request.onerror = request.onblocked = () => {
      done = true;
      resolve(null);
    };
    request.onsuccess = () => {
      if (done) request.result.close();
      else resolve(request.result);
    };
  });
}

async function transaction<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore, result: (value: T) => void) => void,
): Promise<T | null> {
  const db = await open();
  if (!db) return null;
  return new Promise((resolve) => {
    let value: T | null = null;
    try {
      const tx = db.transaction(STORE, mode);
      tx.oncomplete = () => {
        db.close();
        resolve(value);
      };
      tx.onerror = tx.onabort = () => {
        db.close();
        resolve(null);
      };
      try {
        action(tx.objectStore(STORE), (result) => {
          value = result;
        });
      } catch {
        tx.abort();
      }
    } catch {
      db.close();
      resolve(null);
    }
  });
}

const get = (key: string) =>
  transaction<Source>('readonly', (store, done) => {
    const request = store.get(key);
    request.onsuccess = () => done(request.result ?? null);
  });
const put = (source: Source) =>
  transaction<boolean>('readwrite', (store, done) => {
    store.put(source);
    done(true);
  });

// Candidates are registered before reading bytes, then updated in place.
// Deletion by another tab removes that candidate and prevents late writes
// from recreating it.
const replace = (source: Source, accepts: () => boolean = () => true) =>
  transaction<boolean>('readwrite', (store, done) => {
    const request = store.get(source.key);
    request.onsuccess = () => {
      if (!request.result || !accepts()) {
        done(false);
        return;
      }
      try {
        store.put(source);
        done(true);
      } catch {
        store.transaction.abort();
      }
    };
  });
const remove = (key: string) =>
  transaction<boolean>('readwrite', (store, done) => {
    store.delete(key);
    done(true);
  });

async function prune(): Promise<void> {
  await transaction<boolean>('readwrite', (store, done) => {
    const cursor = store.index('expiry').openKeyCursor(IDBKeyRange.upperBound(Date.now()));
    cursor.onsuccess = () => {
      if (cursor.result) {
        store.delete(cursor.result.primaryKey);
        cursor.result.continue();
      } else done(true);
    };
  });
}

function fileOf(source: Source): File | null {
  if (source.file instanceof File) return source.file;
  if (!source.bytes || !ArrayBuffer.isView(source.bytes)) return null;
  const bytes = new Uint8Array(source.bytes.buffer as ArrayBuffer, source.bytes.byteOffset, source.bytes.byteLength);
  return new File([bytes], source.name, { type: source.type, lastModified: source.lastModified });
}

export async function rememberActiveSource(
  docId: string,
  file: File,
  options: { savedThroughRevision?: number; historyCreatedAt?: number; isCurrent?: () => boolean } = {},
): Promise<boolean> {
  const attempt = ++revision;
  if (!docId || options.isCurrent?.() === false) return false;
  let candidateKey: string | undefined;
  try {
    // Storage denial must be discovered before persisting orphaned bytes.
    const previous = pointer();
    const before = sessionStorage.getItem(POINTER);
    sessionStorage.setItem(POINTER, before || 'null');
    const isCurrent = () => attempt === revision && options.isCurrent?.() !== false;
    const ownedSlot =
      options.savedThroughRevision !== undefined && activeSlot?.docId === docId && activeSlot.key === previous?.key;
    // Expiry or explicit deletion by another page can retire an idle slot.
    // Only absence observed before this write starts permits a fresh candidate;
    // deletion while preparing the replacement must still cancel the write.
    const existingSlot = ownedSlot ? await get(activeSlot!.key) : null;
    if (!isCurrent()) return false;
    const reuseSlot = !!existingSlot && existingSlot.expiresAt > Date.now();
    const provenance = options.savedThroughRevision !== undefined ? options : recoveredFiles.get(file);
    const source: Source = {
      docId,
      key: reuseSlot ? activeSlot!.key : crypto.randomUUID(),
      expiresAt: Date.now() + LIFETIME,
      name: file.name,
      type: file.type,
      lastModified: file.lastModified,
      file,
      savedThroughRevision: provenance?.savedThroughRevision,
      historyCreatedAt: provenance?.historyCreatedAt,
    };
    if (reuseSlot) {
      // Prepare the complete replacement before opening a write transaction.
      // A failed file read or transaction leaves the previous usable bytes
      // intact, and deleting the slot while reading still prevents resurrection.
      delete source.file;
      source.bytes = new Uint8Array(await file.arrayBuffer());
      if (!isCurrent() || !(await replace(source, isCurrent))) return false;
      await prune();
    } else {
      candidateKey = source.key;
      const candidate = { ...source };
      delete candidate.file;
      if (!(await put(candidate))) return false;
      // Register before cleanup yields: a deletion during that cleanup must
      // remove our candidate too, rather than precede its later creation.
      await prune();
      const reference = (await replace(source)) ? await get(source.key) : null;
      if (!(reference?.file instanceof File)) {
        delete source.file;
        source.bytes = new Uint8Array(await file.arrayBuffer());
        if (!(await replace(source, isCurrent))) {
          await remove(source.key);
          return false;
        }
      }
    }
    if (!isCurrent()) {
      if (candidateKey) await remove(candidateKey);
      return false;
    }
    try {
      sessionStorage.setItem(
        POINTER,
        JSON.stringify({
          docId,
          key: source.key,
          savedThroughRevision: source.savedThroughRevision,
          historyCreatedAt: source.historyCreatedAt,
        }),
      );
    } catch {
      if (candidateKey) await remove(candidateKey);
      return false;
    }
    activeSlot = { docId, key: source.key };
    // Duplicate tabs inherit sessionStorage, including the previous key.
    // Detach this pointer only; expiry and explicit history deletion collect
    // records after every tab has had the chance to keep using its own copy.
    return true;
  } catch {
    if (candidateKey) await remove(candidateKey);
    return false;
  }
}

export async function readActiveSourceRecord(
  docId: string,
): Promise<{ file: File; savedThroughRevision?: number; historyCreatedAt?: number } | null> {
  const attempt = revision;
  try {
    await prune();
    const owned = pointer();
    if (!owned || owned.docId !== docId) return null;
    const source = await get(owned.key);
    if (!source || source.docId !== docId || source.expiresAt <= Date.now() || pointer()?.key !== owned.key)
      return null;
    const file = fileOf(source);
    if (!file) return null;
    // Renew only a record that still exists. A separate tab may have deleted
    // it since the read; writing our old copy back would undo that deletion.
    const alive = await transaction<boolean>('readwrite', (store, done) => {
      const request = store.get(owned.key);
      request.onsuccess = () => {
        if (!request.result || revision !== attempt || pointer()?.key !== owned.key) {
          done(false);
          return;
        }
        try {
          store.put({ ...request.result, expiresAt: Date.now() + LIFETIME });
        } catch {
          store.transaction.abort();
          return;
        }
        done(true);
      };
    });
    if (alive === false || revision !== attempt || pointer()?.key !== owned.key) return null;
    const provenance = { savedThroughRevision: source.savedThroughRevision, historyCreatedAt: source.historyCreatedAt };
    recoveredFiles.set(file, provenance);
    return { file, ...provenance };
  } catch {
    return null;
  }
}

export async function readActiveSource(docId: string): Promise<File | null> {
  return (await readActiveSourceRecord(docId))?.file ?? null;
}

export async function clearActiveSource(): Promise<void> {
  revision++;
  activeSlot = null;
  try {
    sessionStorage.removeItem(POINTER);
  } catch {
    /* best effort */
  }
  // Another tab may still own the inherited pointer.
  await prune();
}

/** Explicit history deletion also forgets temporary originals in other tabs. */
export async function deleteDocumentSources(docId?: string): Promise<boolean> {
  revision++;
  if (docId === undefined || activeSlot?.docId === docId) activeSlot = null;
  const owned = pointer();
  if (docId === undefined || owned?.docId === docId) {
    try {
      sessionStorage.removeItem(POINTER);
    } catch {
      /* best effort */
    }
  }
  return (
    (await transaction<boolean>('readwrite', (store, done) => {
      if (docId === undefined) {
        store.clear();
        done(true);
        return;
      }
      const cursor = store.index('document').openKeyCursor(IDBKeyRange.only(docId));
      cursor.onsuccess = () => {
        if (cursor.result) {
          store.delete(cursor.result.primaryKey);
          cursor.result.continue();
        } else done(true);
      };
    })) ?? false
  );
}
