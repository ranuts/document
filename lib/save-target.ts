/**
 * The document's file on the user's own disk.
 *
 * Every save so far has gone through a "save as" dialog and thrown the handle
 * away, so saving twice meant choosing the same file twice, and the second
 * choice raised the browser's "a file with that name already exists" prompt.
 * Keeping the handle turns that into what a desktop editor does: the first
 * save picks the file, every save after it writes to that file.
 *
 * It is also the strongest privacy answer this app has. A document that goes
 * back to the user's own file system needs no copy in the browser at all --
 * the local history exists precisely because, until now, there was nowhere
 * else for the work to be.
 *
 * Chromium only. Safari has no local-disk picker at all and Firefox has said
 * it will not add one, so this is strictly an upgrade: where the API is
 * missing, everything falls back to the download the app already did.
 */
import { t } from '@ranuts/shared/i18n';
import { HANDLES_STORE, requestToPromise, withStores } from './history/db';

/** Only the parts of the File System Access API this module uses. */
interface WritableFileStream {
  write: (data: BufferSource | Blob) => Promise<void>;
  close: () => Promise<void>;
}
interface FileHandle {
  name: string;
  createWritable: () => Promise<WritableFileStream>;
  queryPermission?: (descriptor: { mode: 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (descriptor: { mode: 'readwrite' }) => Promise<PermissionState>;
}
type SavePicker = (options: {
  suggestedName?: string;
  types?: Array<{ description: string; accept: Record<string, string[]> }>;
}) => Promise<FileHandle>;

interface StoredTarget {
  docId: string;
  handle: FileHandle;
  name: string;
  linkedAt: number;
}

/** What happened, so the caller knows whether it still owes the user a save. */
export type SaveOutcome =
  | 'written' // the bytes are in the user's file
  | 'cancelled' // the user dismissed the picker; nothing more to do
  | 'unavailable'; // no API, no permission, or the write failed -- fall back

export function canWriteToDisk(): boolean {
  return typeof (globalThis as { showSaveFilePicker?: SavePicker }).showSaveFilePicker === 'function';
}

/**
 * Handles held for this page's lifetime.
 *
 * The store is what survives a reload; this is what makes a save cost nothing
 * in between. It also keeps the feature working when IndexedDB is not -- a
 * private window, a full disk -- for as long as the tab is open, which is
 * exactly the session the user is in the middle of.
 */
const sessionTargets = new Map<string, StoredTarget>();
const persistedTargets = new Set<string>();

/** Retire cached links after their IndexedDB deletion has committed. */
export function clearSessionSaveTargets(docId?: string): void {
  if (docId === undefined) {
    sessionTargets.clear();
    persistedTargets.clear();
  } else {
    sessionTargets.delete(docId);
    persistedTargets.delete(docId);
  }
}

async function readTarget(docId: string): Promise<StoredTarget | null> {
  const held = sessionTargets.get(docId);
  if (held && !persistedTargets.has(docId)) return held;
  try {
    const record = await withStores([HANDLES_STORE], 'readonly', async (tx) => ({
      target: ((await requestToPromise(tx.objectStore(HANDLES_STORE).get(docId))) as StoredTarget | undefined) ?? null,
    }));
    if (!record) return held ?? null;
    // A different tab may have deleted this link since our last save.
    if (!record.target) clearSessionSaveTargets(docId);
    return record.target;
  } catch {
    return held ?? null;
  }
}

async function writeTarget(target: StoredTarget): Promise<void> {
  sessionTargets.set(target.docId, target);
  try {
    const stored = await withStores([HANDLES_STORE], 'readwrite', async (tx) => {
      tx.objectStore(HANDLES_STORE).put(target);
      return true;
    });
    if (stored) persistedTargets.add(target.docId);
  } catch {
    // Not being able to remember the file costs a picker next time, nothing more.
  }
}

export async function forgetSaveTarget(docId: string): Promise<void> {
  clearSessionSaveTargets(docId);
  try {
    await withStores([HANDLES_STORE], 'readwrite', async (tx) => {
      tx.objectStore(HANDLES_STORE).delete(docId);
      return true;
    });
  } catch {
    /* nothing to forget */
  }
}

/**
 * Permission does not survive a reload on its own: a handle read back from
 * IndexedDB starts at "prompt", and asking requires a user gesture. Saving is
 * one, which is why this is only ever called from a save the user asked for.
 */
async function ensureWritable(handle: FileHandle): Promise<boolean> {
  // A handle with no permission model is already writable -- origin-private
  // handles have no gate to pass. Treating a missing method as a refusal would
  // throw away a working handle on every save.
  if (!handle.queryPermission && !handle.requestPermission) return true;
  try {
    if ((await handle.queryPermission?.({ mode: 'readwrite' })) === 'granted') return true;
    return (await handle.requestPermission?.({ mode: 'readwrite' })) === 'granted';
  } catch {
    return false;
  }
}

function notifySaved(name: string): void {
  (window as unknown as { message?: { success?: (msg: string) => void } }).message?.success?.(
    `${t('fileSavedSuccess')}${name}`,
  );
}

/**
 * Write the document to the file it is linked to, asking for one if it has
 * none yet.
 *
 * Returns 'unavailable' rather than throwing whenever anything is off -- the
 * file was moved or deleted, permission was refused, the API is absent -- so
 * the caller can fall back to the ordinary download and the user still ends up
 * with their document. A failed write also drops the link, so the next save
 * offers the picker instead of failing the same way again; that doubles as the
 * way to save somewhere else.
 */
export async function saveToDiskFile(
  docId: string,
  file: File,
  description: string,
  options: { rememberTarget?: boolean } = {},
): Promise<SaveOutcome> {
  const picker = (globalThis as { showSaveFilePicker?: SavePicker }).showSaveFilePicker;
  if (typeof picker !== 'function') return 'unavailable';

  const existing = await readTarget(docId);
  const extensionOf = (name: string) => /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase();
  const isExport =
    options.rememberTarget === false || (!!existing && extensionOf(existing.name) !== extensionOf(file.name));
  let handle = isExport ? null : (existing?.handle ?? null);

  if (handle && !(await ensureWritable(handle))) {
    await forgetSaveTarget(docId);
    handle = null;
  }

  if (!handle) {
    const extension = file.name.includes('.') ? `.${file.name.split('.').pop()}` : '';
    try {
      handle = await picker({
        suggestedName: file.name,
        types: [
          {
            description,
            accept: { [file.type || 'application/octet-stream']: extension ? [extension] : [] },
          },
        ],
      });
    } catch (error) {
      // AbortError is the user closing the dialog: a decision, not a failure.
      if ((error as { name?: string })?.name === 'AbortError') return 'cancelled';
      return 'unavailable';
    }
  }

  // Establish the chosen link before asynchronous I/O. History deletion can
  // then retire it while the write runs, without a late commit reviving it.
  if (!isExport && handle !== existing?.handle) {
    await writeTarget({ docId, handle, name: handle.name || file.name, linkedAt: Date.now() });
  }

  try {
    const writable = await handle.createWritable();
    await writable.write(file);
    await writable.close();
  } catch {
    if (!isExport) await forgetSaveTarget(docId);
    return 'unavailable';
  }

  notifySaved(handle.name || file.name);
  return 'written';
}

/** Test seam: forget every handle this page is holding. */
export function resetSaveTargetsForTests(): void {
  clearSessionSaveTargets();
}

/** The file name this document writes to, if it is linked to one. */
export async function getSaveTargetName(docId: string): Promise<string | null> {
  return (await readTarget(docId))?.name ?? null;
}
