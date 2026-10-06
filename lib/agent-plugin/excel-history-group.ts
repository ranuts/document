import { preserveNativeRedo, type RedoHistory, type RedoHistoryPoint } from './native-redo';

export interface ExcelGroupHistory extends RedoHistory {
  startGroupPoints(): void;
  cancelGroupPoints(): unknown;
  endGroupPoints(): void;
  _getLongPointIndex(): number;
}

/** Caller holds a blocking action and proves document/history/edit ownership.
 * Excel cancellation retains its marker until endGroupPoints; close it before
 * restoring old Redo. Never merge or undo points after ownership is lost.
 */
export async function withExcelHistoryGroup<T>(
  history: ExcelGroupHistory,
  isCurrent: () => boolean,
  closedDescription: number,
  work: (ownsGroup: () => boolean) => Promise<T>,
  isHistoryCurrent: () => boolean = isCurrent,
): Promise<T> {
  const current = () => {
    try {
      return isCurrent();
    } catch {
      return false;
    }
  };
  if (!current()) throw new Error('Document action has expired');
  if (!Number.isInteger(closedDescription)) throw new Error('Editor history API is unavailable');
  if (history._getLongPointIndex() !== -1) throw new Error('Editor is busy');
  const previousIndex = history.Index;
  const prefix = history.Points.slice(0, previousIndex + 1);
  // Releasing an owned backup only requires original history identity, whereas
  // rolling back or restoring the branch also requires exclusive edit ownership.
  const redo = preserveNativeRedo(history, isHistoryCurrent);
  const openedIndex = previousIndex + 1;
  let marker: RedoHistoryPoint | undefined, openedDescription: number | undefined;
  let closed = false,
    restoring = false;
  const ownsGroup = () =>
    current() &&
    !!marker &&
    history.Points[openedIndex] === marker &&
    history.Index >= openedIndex &&
    history.Points.length === history.Index + 1 &&
    history._getLongPointIndex() === openedIndex &&
    prefix.every((point, index) => history.Points[index] === point);
  try {
    history.startGroupPoints();
    marker = history.Points[openedIndex];
    openedDescription = marker?.Description;
    if (!ownsGroup()) throw new Error('Document action has expired');
    const result = await work(ownsGroup);
    if (!ownsGroup()) throw new Error('Document action has expired');
    history.endGroupPoints();
    closed = true;
    return result;
  } catch (error) {
    if (
      !marker &&
      current() &&
      history.Index === openedIndex &&
      history.Points.length === openedIndex + 1 &&
      history.Points[openedIndex]?.Items.length === 0 &&
      history._getLongPointIndex() === openedIndex &&
      prefix.every((point, index) => history.Points[index] === point)
    ) {
      marker = history.Points[openedIndex];
      openedDescription = marker.Description;
    }
    if (ownsGroup()) {
      history.cancelGroupPoints();
      history.endGroupPoints();
      closed = true;
      restoring = true;
      redo.restore();
    } else if (!marker && current()) {
      restoring = true;
      redo.restore();
    }
    throw error;
  } finally {
    if (!closed && marker && history.Points.includes(marker) && marker.Description === openedDescription)
      marker.Description = closedDescription;
    if (!restoring) redo.discard();
  }
}
