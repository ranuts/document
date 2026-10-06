import { withBlockingEditorAction } from './editor-action';
import { captureExcelCellFormat, type NativeCellFormat } from './excel-cell-format';
import { withExcelHistoryGroup, type ExcelGroupHistory } from './excel-history-group';
import { captureExcelHistoryOwnership } from './excel-history-ownership';
import { pasteExcelText } from './excel-native-paste';
import { assertExcelTextWritable } from './excel-text-preflight';
import { withExcelTextFormat } from './excel-text-transaction';
import type { NativePasteApi } from './native-paste';

export interface ExcelTextWriteScope {
  api: Pick<NativePasteApi, 'asc_PasteData'> & {
    isDocumentLoadComplete: boolean;
    isLoadFullApi: boolean;
    isViewMode?: boolean;
    canEdit(): boolean;
    isLongAction(): boolean;
    sync_StartAction(type: number, action: number): void;
    sync_EndAction(type: number, action: number): void;
  };
  view: object;
  model: { getSheetProtection(): unknown; isUserProtectedRangesIntersection(range: unknown): boolean };
  cell: NativeCellFormat & { hasMerged(): unknown; getValue(): string };
  history: ExcelGroupHistory & { Create_NewPoint(): void; StartTransaction(): void; EndTransaction(): void };
  nativeRange: unknown;
  readonly: boolean;
  codes: { BlockInteraction: number; ApplyChanges: number };
  clipboardFormat: number;
  closedGroupDescription: number;
  /** Prove original document, sheet, history, target selection and paste helper. */
  isCurrent(): boolean;
  /** Original document/history still exist; independent of active selection. */
  isDocumentCurrent(): boolean;
  /** Bound to the captured helper; must not end a later paste. */
  endPaste(): void;
}

/** Exact single-cell text insertion through the native paste pipeline. */
export async function writeExcelLiteralText(
  scope: ExcelTextWriteScope,
  text: string,
  signal?: AbortSignal,
): Promise<void> {
  signal?.throwIfAborted();
  if (typeof text !== 'string' || !text.length || text.length > 8000 || /[\t\r\n]/.test(text))
    throw new Error('Invalid document tool parameters');
  if (!scope.isCurrent()) throw new Error('Paste target has expired');
  assertExcelTextWritable(scope.api, scope.model, scope.cell, scope.nativeRange, scope.readonly);
  const format = captureExcelCellFormat(scope.cell);
  let editOwned = true;
  let completedOwnership: (() => boolean) | undefined;
  // Navigation invalidates insertion, but does not transfer ownership of our
  // history edits. Only document/history replacement or foreign edits do that.
  const current = () => {
    if (editOwned && completedOwnership && !completedOwnership()) editOwned = false;
    return editOwned && scope.isDocumentCurrent();
  };
  const captureCompletion = () => {
    try {
      completedOwnership = captureExcelHistoryOwnership(scope.history, () => scope.isDocumentCurrent());
    } catch (error) {
      editOwned = false;
      throw error;
    }
  };
  await withBlockingEditorAction(scope.api, scope.codes, () =>
    withExcelHistoryGroup(
      scope.history,
      current,
      scope.closedGroupDescription,
      async (ownsGroup) => {
        const targetCurrent = () => ownsGroup() && scope.isCurrent();
        let temporaryFormatAttempted = false;
        let pendingOwnership: (() => boolean) | undefined;
        await withExcelTextFormat(
          {
            originalFormat: format.originalFormat,
            isCurrent: targetCurrent,
            createPoint: () => scope.history.Create_NewPoint(),
            startTransaction: () => scope.history.StartTransaction(),
            endTransaction: () => {
              const owned = current();
              scope.history.EndTransaction();
              if (owned) captureCompletion();
            },
            setFormat: (value) => {
              if (temporaryFormatAttempted) {
                current();
                const currentFormat = scope.cell.getNumFormat()?.sFormat;
                if (!scope.isDocumentCurrent() || (currentFormat !== '@' && currentFormat !== format.originalFormat)) {
                  editOwned = false;
                  throw new Error('Paste target has expired');
                }
                if (currentFormat === format.originalFormat) return;
              }
              temporaryFormatAttempted = true;
              format.setFormat(value);
              if (completedOwnership && editOwned) captureCompletion();
            },
          },
          async () => {
            try {
              await pasteExcelText(scope.api, scope.view, scope.clipboardFormat, text, {
                signal,
                isCurrent: targetCurrent,
                endPaste: scope.endPaste,
                onNativeCompletion: captureCompletion,
                captureOwnership: () => {
                  const proof = captureExcelHistoryOwnership(scope.history, ownsGroup);
                  pendingOwnership = proof;
                  return () => {
                    const owned = proof();
                    pendingOwnership = undefined;
                    return owned;
                  };
                },
                onOwnershipLost: () => {
                  editOwned = false;
                },
              });
            } catch (error) {
              // Stop/timeout can settle before a native continuation checks its proof.
              if (pendingOwnership && !pendingOwnership()) editOwned = false;
              throw error;
            }
          },
        );
        signal?.throwIfAborted();
        if (!targetCurrent()) throw new Error('Paste target has expired');
        if (scope.cell.getValue() !== text || scope.cell.getNumFormat()?.sFormat !== format.originalFormat)
          throw new Error('The change could not be verified. Check the document and use Undo if needed.');
      },
      () => scope.isDocumentCurrent(),
    ),
  );
}
