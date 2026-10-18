/**
 * Wiring for the local history feature. Kept in one place so the editor entry
 * has a single call, and so the pieces that must not import each other -- the
 * save channel and the autosave scheduler -- stay uncoupled.
 */
import { setDiskWriter, setSavedToDiskListener } from '../onlyoffice/save-stream';
import { saveToDiskFile } from '../save-target';
import { cancelPendingSnapshot, getActiveDocumentId } from './autosave';
import { extensionOf, markSavedToDisk, pruneExpired, readDocumentRecord } from './store';
import { getDocmentObj } from '@ranuts/shared/store';
import { rememberActiveSource } from '../active-document-source';

export function initDocumentHistory(): void {
  // Expiry has to happen on its own, not when someone thinks to visit the
  // history page: "this browser forgets after seven days" is only a promise if
  // nothing has to be done to collect on it.
  void pruneExpired();

  // Saving writes back to the file the document came from, once the user has
  // pointed at one. The document id is what links the two, which is why this
  // is wired here rather than inside the save channel.
  setDiskWriter(async (file) => {
    const docId = getActiveDocumentId();
    if (!docId) return 'unavailable';
    const sourceName = getDocmentObj()?.fileName || file.name;
    return saveToDiskFile(docId, file, 'Document', {
      rememberTarget: extensionOf(sourceName) === extensionOf(file.name),
    });
  });

  setSavedToDiskListener(async (file, ownsExport) => {
    const id = getActiveDocumentId();
    if (!id) return;
    const isCurrent = () => getActiveDocumentId() === id && ownsExport();
    // An old autosave may still be exporting or reading bytes. It must not
    // finish after this save and acquire a newer recovery revision.
    cancelPendingSnapshot();
    const record = await readDocumentRecord(id);
    if (!record || !isCurrent()) return;
    const nextRev = record.doc?.nextRev ?? 0;
    const historyCreatedAt = record.doc?.createdAt;
    const retained = await rememberActiveSource(id, file, {
      savedThroughRevision: nextRev,
      historyCreatedAt,
      isCurrent,
    });
    if (!retained || !isCurrent()) return;
    // A snapshot made while retaining the source belongs to later edits;
    // mark only the history revision actually covered by these saved bytes.
    await markSavedToDisk(id, { nextRev, createdAt: historyCreatedAt, isCurrent });
  });
}

export {
  beginAutosaveSession,
  clearDocumentSession,
  getActiveDocumentId,
  isAutosaveEnabled,
  setAutosaveEnabled,
  stopAutosaveSession,
} from './autosave';
export { clearAllHistory, deleteDoc, getLatestSnapshot, listDocs } from './store';
export type { HistoryDoc } from './types';
