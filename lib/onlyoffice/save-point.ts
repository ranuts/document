/**
 * Moving the SDK's "saved" mark after the host page stored an export.
 *
 * The SDK derives "document modified" from its undo history: the document is
 * modified while `History.Index` differs from `History.SavedIndex`, and
 * `onDocumentStateChange` fires only when that answer flips. With serverless
 * saves (guard 5) nothing ever moves `SavedIndex`, so after the first edit the
 * answer stays "modified" for good and later edits fire nothing. Both standalone
 * disk saves and embedding hosts need to hear about edits after their last save.
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
  items: unknown[] | null;
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
  const head = history.Points[history.Index];
  const items = (head as { Items?: unknown[] } | undefined)?.Items;
  return { frame, index: history.Index, head, items: Array.isArray(items) ? [...items] : null };
}

/** Whether these serialized bytes still match the current editor history. */
export function isSavePointCurrent(point: SavePoint | null): boolean {
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
    const items = (point.head as { Items?: unknown[] } | undefined)?.Items;
    if (
      point.items &&
      (!Array.isArray(items) ||
        items.length !== point.items.length ||
        items.some((item, i) => item !== point.items![i]))
    )
      return false;

    return true;
  } catch {
    // The frame was torn down (another document took over) -- nothing to mark.
    return false;
  }
}

/** Move the SDK save point only while the serialized document is still current. */
export function commitSavePoint(point: SavePoint | null): boolean {
  if (!isSavePointCurrent(point)) return false;
  try {
    point!.frame.AscCommon!.History!.Reset_SavedIndex!(true);
    point!.frame.Asc!.editor!.CheckChangedDocument!();
    return true;
  } catch {
    return false;
  }
}
