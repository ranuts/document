export interface RedoHistoryPoint {
  Items: unknown[];
  Description?: number;
  Additional?: Record<string, unknown>;
}
export interface RedoHistory {
  Index: number;
  Points: RedoHistoryPoint[];
  StoredData?: RedoHistoryPoint[][];
  SaveRedoPoints?(): void;
  PopRedoPoints?(): void;
  SavedIndex?: number | null;
  UserSavedIndex?: number | null;
  ForceSave?: boolean;
  LastState?: unknown;
}
/** Preserve an existing redo branch around an owned native group.
 * Restore after cancellation or failed group opening; discard on a successful new edit.
 */
export function preserveNativeRedo(
  history: RedoHistory,
  isCurrent: () => boolean,
): { restore(): void; discard(): void } {
  const current = () => {
    try {
      return isCurrent();
    } catch {
      return false;
    }
  };
  const expired = (): never => {
    throw new Error('Document action has expired');
  };
  const unverified = (): never => {
    throw new Error('Document change could not be verified');
  };
  if (!current()) return expired();
  if (
    !Number.isInteger(history.Index) ||
    !Array.isArray(history.Points) ||
    history.Index < -1 ||
    history.Index >= history.Points.length
  )
    return unverified();
  const index = history.Index;
  if (index === history.Points.length - 1) return { restore() {}, discard() {} };
  if (
    !Array.isArray(history.StoredData) ||
    typeof history.SaveRedoPoints !== 'function' ||
    typeof history.PopRedoPoints !== 'function'
  )
    throw new Error('Editor history API is unavailable');
  const stored = history.StoredData,
    depth = stored.length,
    points = [...history.Points],
    pop = history.PopRedoPoints;
  const metadata = Object.fromEntries(
    (['SavedIndex', 'UserSavedIndex', 'ForceSave', 'LastState'] as const)
      .filter((key) => key in history)
      .map((key) => [key, history[key]]),
  );
  const point = points[index],
    additional = point?.Additional,
    hadAdditional = !!point && 'Additional' in point;
  history.SaveRedoPoints();
  const marker = stored[depth];
  const ownsBackup = () =>
    current() &&
    history.StoredData === stored &&
    stored.length === depth + 1 &&
    stored[depth] === marker &&
    Array.isArray(marker) &&
    marker.length === points.length - index - 1 &&
    marker.every((point, offset) => point === points[index + offset + 1]);
  if (!ownsBackup()) return unverified();
  let finished = false;
  return {
    restore() {
      if (finished) return;
      if (!current()) return expired();
      if (
        !ownsBackup() ||
        history.Index !== index ||
        points.slice(0, index + 1).some((point, offset) => history.Points[offset] !== point)
      )
        return unverified();
      const intact =
        history.Points.length === points.length && points.every((point, offset) => history.Points[offset] === point);
      if (intact) stored.pop();
      else {
        if (history.Points.length !== index + 1) return unverified();
        pop.call(history);
      }
      finished = true;
      if (
        history.StoredData !== stored ||
        stored.length !== depth ||
        history.Index !== index ||
        history.Points.length !== points.length ||
        points.some((point, offset) => history.Points[offset] !== point)
      )
        return unverified();
      Object.assign(history, metadata);
      if (point) {
        if (hadAdditional) point.Additional = additional;
        else delete point.Additional;
      }
    },
    discard() {
      if (finished || !ownsBackup()) return;
      // PopRedoPoints restores the branch; a successful new edit must only release its backup.
      stored.pop();
      finished = true;
    },
  };
}
