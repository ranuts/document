/** Original local bytes for this tab's reload, separate from document history. */
const DB = 'document-active-sources';
const STORE = 'sources';
const POINTER = 'document-active-source';
const LIFETIME = 24 * 60 * 60 * 1000;
let revision = 0;
type Pointer = { docId: string; key: string };
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
const replace = (source: Source) =>
  transaction<boolean>('readwrite', (store, done) => {
    const request = store.get(source.key);
    request.onsuccess = () => {
      if (!request.result) {
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

export async function rememberActiveSource(docId: string, file: File): Promise<boolean> {
  const attempt = ++revision;
  if (!docId) return false;
  let candidateKey: string | undefined;
  try {
    // Storage denial must be discovered before persisting orphaned bytes.
    const previous = pointer();
    const before = sessionStorage.getItem(POINTER);
    sessionStorage.setItem(POINTER, before || 'null');
    const source: Source = {
      docId,
      key: crypto.randomUUID(),
      expiresAt: Date.now() + LIFETIME,
      name: file.name,
      type: file.type,
      lastModified: file.lastModified,
      file,
    };
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
      if (!(await replace(source))) {
        await remove(source.key);
        return false;
      }
    }
    if (attempt !== revision) {
      await remove(source.key);
      return false;
    }
    try {
      sessionStorage.setItem(POINTER, JSON.stringify({ docId, key: source.key }));
    } catch {
      await remove(source.key);
      return false;
    }
    if (previous && previous.key !== source.key) await remove(previous.key);
    return true;
  } catch {
    if (candidateKey) await remove(candidateKey);
    return false;
  }
}

export async function readActiveSource(docId: string): Promise<File | null> {
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
    return file;
  } catch {
    return null;
  }
}

export async function clearActiveSource(): Promise<void> {
  revision++;
  const owned = pointer();
  try {
    sessionStorage.removeItem(POINTER);
  } catch {
    /* best effort */
  }
  if (owned) await remove(owned.key);
  await prune();
}

/** Explicit history deletion also forgets temporary originals in other tabs. */
export async function deleteDocumentSources(docId?: string): Promise<boolean> {
  revision++;
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
