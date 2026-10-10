interface ExcelWriteApi {
  isDocumentLoadComplete: boolean;
  isLoadFullApi: boolean;
  isViewMode?: boolean;
  canEdit(): boolean;
}
interface ExcelWriteModel {
  getSheetProtection(): unknown;
  isUserProtectedRangesIntersection(range: unknown): boolean;
}
interface ExcelWriteCell {
  hasMerged(): unknown;
}

/** Read native target restrictions before history, selection or format changes.
 * nativeRange must belong to the captured sheet, not a later active selection.
 */
export function assertExcelTextWritable(
  api: ExcelWriteApi,
  model: ExcelWriteModel,
  cell: ExcelWriteCell,
  nativeRange: unknown,
  readonly: boolean,
): void {
  if (!api.isDocumentLoadComplete || !api.isLoadFullApi) throw new Error('Editor is still loading');
  if (
    typeof api.canEdit !== 'function' ||
    typeof model.getSheetProtection !== 'function' ||
    typeof model.isUserProtectedRangesIntersection !== 'function' ||
    typeof cell.hasMerged !== 'function'
  )
    throw new Error('officeSpreadsheetOnly');
  if (readonly || api.isViewMode || !api.canEdit()) throw new Error('Document is read-only');
  if (model.getSheetProtection() || model.isUserProtectedRangesIntersection(nativeRange))
    throw new Error('officeProtectedRange');
  if (cell.hasMerged()) throw new Error('officeMergedTarget');
}
