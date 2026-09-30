/**
 * Moving the SDK's "saved" mark after the host page stored an export.
 *
 * The SDK derives "document modified" from its undo history: the document is
 * modified while `History.Index` differs from `History.SavedIndex`, and
 * `onDocumentStateChange` fires only when that answer flips. With serverless
 * saves (guard 5) nothing ever moves `SavedIndex`, so after the first edit the
 * answer stays "modified" for good and later edits fire nothing. That is fine
 * for the standalone page, but an embedding host that saves on its own cadence
 * needs to hear about the edits after its last save.
 *
 * So after an embed save, do what the SDK itself does after a server save:
 * `History.Reset_SavedIndex(true)` followed by `CheckChangedDocument()` (the
 * same pair every editor -- word, cell, slide -- runs on its save callback).
 *
 * Only when the history did not move while the export ran: an edit made during
 * the conversion is not in the saved bytes, and marking it saved would lose
 * it. The head point is compared by identity, not just the index, so undo
 * followed by a new edit (same index, different content) still counts as moved.
 */

type SdkHistory = {
  Index?: number;
  Points?: unknown[];
  Reset_SavedIndex?: (isUserSave?: boolean) => void;
};

type SdkFrameWindow = Window & {
  AscCommon?: { History?: SdkHistory };
  Asc?: { editor?: { CheckChangedDocument?: () => void } };
};

export type SavePoint = {
  frame: SdkFrameWindow;
  index: number;
  head: unknown;
};

function findSdkFrame(): SdkFrameWindow | null {
  for (let i = 0; i < window.frames.length; i++) {
    try {
      const win = window.frames[i] as SdkFrameWindow;
      if (win.AscCommon?.History && win.Asc?.editor) return win;
    } catch {
      // cross-origin frame -- not the editor
    }
  }
  return null;
}

/** Where the undo history stands right now; null when the SDK is not reachable. */
export function captureSavePoint(): SavePoint | null {
  const frame = findSdkFrame();
  const history = frame?.AscCommon?.History;
  if (!frame || !history || typeof history.Index !== 'number' || !Array.isArray(history.Points)) {
    return null;
  }
  return { frame, index: history.Index, head: history.Points[history.Index] };
}

/**
 * Marks the document saved at `point` if the history is still there.
 * Returns true when the SDK now considers the document unmodified.
 */
export function commitSavePoint(point: SavePoint | null): boolean {
  if (!point) return false;
  try {
    const history = point.frame.AscCommon?.History;
    const api = point.frame.Asc?.editor;
    if (!history || !api) return false;
    if (typeof history.Reset_SavedIndex !== 'function' || typeof api.CheckChangedDocument !== 'function') {
      return false;
    }
    if (history.Index !== point.index || history.Points?.[point.index] !== point.head) {
      return false;
    }

    history.Reset_SavedIndex(true);
    api.CheckChangedDocument();
    return true;
  } catch {
    // The frame was torn down (another document took over) -- nothing to mark.
    return false;
  }
}
