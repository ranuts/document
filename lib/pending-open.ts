// Consume a file handed off by a static landing page (public/open-local.js):
// the page stashes the picked file in IndexedDB and navigates to the app with
// `?open=local`; the app takes it out (one-shot) and opens it. The DB / store /
// key names here must stay in sync with public/open-local.js.
const DB_NAME = 'document-handoff';
const STORE = 'files';
const KEY = 'pending';

/**
 * What is actually stored: the bytes plus the File fields the app needs back.
 *
 * A File cannot be the stored value. Safari fails the whole transaction (with
 * a null error) when asked to structured-clone a File or a Blob into
 * IndexedDB, which broke the handoff outright there -- the landing page took
 * its "IndexedDB unavailable" fallback and dropped the file the visitor had
 * just picked. This shape clones on every engine; public/open-local.js writes
 * it and this module rebuilds the File from it.
 */
type PendingRecord = {
  name: string;
  type: string;
  lastModified: number;
  bytes: Uint8Array | ArrayBuffer;
};

// Duck-typed rather than `instanceof`: the value comes back out of a
// structured clone, and a typed array that crossed a realm boundary answers
// `false` to `instanceof Uint8Array` while being perfectly usable.
const isBytes = (value: unknown): value is Uint8Array | ArrayBuffer =>
  ArrayBuffer.isView(value) || (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer);

const isPendingRecord = (value: unknown): value is PendingRecord =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as PendingRecord).name === 'string' &&
  isBytes((value as PendingRecord).bytes);

/**
 * Turn a stored value back into a File.
 *
 * Still accepts a bare File: a landing page cached before this change writes
 * one, and the visitor who picked a file on it deserves to have it opened
 * rather than silently dropped.
 */
const toFile = (value: unknown): File | null => {
  if (value instanceof File) return value;
  if (!isPendingRecord(value)) return null;
  const view = value.bytes;
  const bytes: Uint8Array<ArrayBuffer> = ArrayBuffer.isView(view)
    ? new Uint8Array(view.buffer as ArrayBuffer, view.byteOffset, view.byteLength)
    : new Uint8Array(view);
  return new File([bytes], value.name, { type: value.type, lastModified: value.lastModified });
};

const toRecord = async (file: File): Promise<PendingRecord> => ({
  name: file.name,
  type: file.type,
  lastModified: file.lastModified,
  bytes: new Uint8Array(await file.arrayBuffer()),
});

/**
 * Stash a picked file for the editor to take on boot, then the caller
 * navigates to `?open=local`. This is the same handoff public/open-local.js
 * performs for the static landing pages; /history needs it too (it is an app
 * page that deliberately does not load the editor bundle, so it cannot open a
 * file itself), and the DB/store/key names belong to this module.
 */
export const stashPendingFile = async (file: File): Promise<boolean> => {
  if (typeof indexedDB === 'undefined') return false;
  // By reference first, bytes only if the store will not keep a File, and the
  // write is confirmed rather than trusted -- the same decision, spelled out,
  // in public/open-local.js.
  if ((await put(file)) && (await peek()) instanceof Blob) return true;
  try {
    return await put(await toRecord(file));
  } catch {
    return false;
  }
};

/** Whatever is under the handoff key right now. Null when it cannot be read. */
const peek = (): Promise<unknown> =>
  new Promise((resolve) => {
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, 1);
    } catch {
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onerror = () => resolve(null);
    req.onsuccess = () => {
      const db = req.result;
      try {
        const read = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
        read.onsuccess = () => {
          db.close();
          resolve(read.result);
        };
        read.onerror = () => {
          db.close();
          resolve(null);
        };
      } catch {
        db.close();
        resolve(null);
      }
    };
  });

/** Put one value under the handoff key. Resolves false rather than throwing. */
const put = (value: File | PendingRecord): Promise<boolean> =>
  new Promise((resolve) => {
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, 1);
    } catch {
      resolve(false);
      return;
    }
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onerror = () => resolve(false);
    req.onsuccess = () => {
      const db = req.result;
      try {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(value, KEY);
        tx.oncomplete = () => {
          db.close();
          resolve(true);
        };
        tx.onerror = () => {
          db.close();
          resolve(false);
        };
      } catch {
        db.close();
        resolve(false);
      }
    };
  });

/** Read and delete the pending handoff file. Resolves null when there is none
 *  (stale `?open=local` URL, reload after consumption) or IndexedDB is unusable. */
export const takePendingFile = (): Promise<File | null> => {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, 1);
    } catch {
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onerror = () => resolve(null);
    req.onsuccess = () => {
      const db = req.result;
      // A fresh DB created by onupgradeneeded above has an empty store — the
      // normal "nothing pending" path resolves null through the get() below.
      try {
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        const get = store.get(KEY);
        get.onsuccess = () => {
          const value = get.result;
          store.delete(KEY);
          tx.oncomplete = () => {
            db.close();
            resolve(toFile(value));
          };
        };
        get.onerror = () => {
          db.close();
          resolve(null);
        };
        tx.onerror = () => {
          db.close();
          resolve(null);
        };
      } catch {
        db.close();
        resolve(null);
      }
    };
  });
};
