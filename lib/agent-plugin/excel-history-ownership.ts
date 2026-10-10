import type { RedoHistory } from './native-redo';

/** Snapshot a pending native stage. History items are native append-only records;
 * the proof detects structural changes, not mutations inside a record's payload.
 * Capture again at each async boundary, never reuse it after owned insertion.
 */
export function captureExcelHistoryOwnership(
  history: RedoHistory,
  isCurrent: () => boolean = () => true,
): () => boolean {
  const index = history.Index,
    points = history.Points;
  if (!Number.isInteger(index) || !Array.isArray(points) || index < -1 || index >= points.length)
    throw new Error('Editor history API is unavailable');
  const captured = points.map((point) => ({
    point,
    items: point.Items,
    values: [...point.Items],
    description: point.Description,
  }));
  return () => {
    try {
      return (
        isCurrent() &&
        history.Index === index &&
        history.Points === points &&
        points.length === captured.length &&
        captured.every(
          ({ point, items, values, description }, offset) =>
            points[offset] === point &&
            point.Description === description &&
            point.Items === items &&
            items.length === values.length &&
            values.every((item, position) => items[position] === item),
        )
      );
    } catch {
      return false;
    }
  };
}
