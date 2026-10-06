/** Methods must be bound to the captured cell/history, inside an owned blocking
 * editor action. paste must guard delayed insertion and settle only when native
 * completion or cancellation cleanup finishes. This scope does not cancel paste.
 */
export interface ExcelTextFormatScope {
  readonly originalFormat: string;
  isCurrent(): boolean;
  createPoint(): void;
  startTransaction(): void;
  endTransaction(): void;
  setFormat(format: string): void;
}

/** Group temporary text formatting and native writing into one Undo action. */
export async function withExcelTextFormat<T>(scope: ExcelTextFormatScope, paste: () => Promise<T>): Promise<T> {
  if (!scope.isCurrent()) throw new Error('Paste target has expired');
  if (typeof scope.originalFormat !== 'string' || !scope.originalFormat.length)
    throw new Error('Original cell format is unavailable');
  scope.createPoint();
  scope.startTransaction();
  try {
    scope.setFormat('@');
    if (!scope.isCurrent()) throw new Error('Paste target has expired');
    return await paste();
  } finally {
    try {
      scope.setFormat(scope.originalFormat);
    } finally {
      scope.endTransaction();
    }
  }
}
