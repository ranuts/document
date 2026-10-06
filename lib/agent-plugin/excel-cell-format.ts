export interface NativeCellFormat {
  getNumFormat(): { sFormat: string } | null;
  setNumFormat(format: string): unknown;
}

/** Bind restoration to the original native cell, independently of active sheet
 * or selection. Caller must own its document/history and blocking action.
 */
export function captureExcelCellFormat(cell: NativeCellFormat): {
  readonly originalFormat: string;
  setFormat(format: string): void;
} {
  if (typeof cell.getNumFormat !== 'function' || typeof cell.setNumFormat !== 'function')
    throw new Error('Original cell format is unavailable');
  const originalFormat = cell.getNumFormat()?.sFormat;
  if (typeof originalFormat !== 'string' || !originalFormat.length)
    throw new Error('Original cell format is unavailable');
  const set = cell.setNumFormat;
  return Object.freeze({
    originalFormat,
    setFormat(format: string) {
      set.call(cell, format);
    },
  });
}
