import { getEditorContext, requireEditorContext } from './editor-bridge';
import { getReadonlyMode } from '../onlyoffice/readonly';
import { parseOfficeRange } from './office-tools';
import { assertExcelTextWritable } from './excel-text-preflight';
import { writeExcelLiteralText, type ExcelTextWriteScope } from './excel-text-write';

/** Capture all native objects before selecting or changing the target. */
export async function writeExcelCellText(address: string, text: string, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
  const bounds = parseOfficeRange(address);
  if (bounds.c1 !== bounds.c2 || bounds.r1 !== bounds.r2) throw new Error('officeInvalidRange');
  const context = requireEditorContext(),
    api = context.api;
  const wb = api.wb as
    | {
        getWorksheet(): {
          model: ExcelTextWriteScope['model'] & {
            getId(): string;
            getRange3(r1: number, c1: number, r2: number, c2: number): ExcelTextWriteScope['cell'];
            selectionRange: {
              activeCell: { row: number; col: number };
              ranges: Array<{ r1: number; r2: number; c1: number; c2: number }>;
            };
          };
        };
      }
    | undefined;
  const workbook = api.wbModel as { getWorksheetById(id: string): unknown } | undefined;
  const Range = context.Asc.Range as (new (c1: number, r1: number, c2: number, r2: number) => unknown) | undefined;
  const history = context.AscCommon?.History;
  const paste = context.AscCommon?.g_specialPasteHelper;
  const view = wb?.getWorksheet(),
    model = view?.model;
  if (
    !model ||
    typeof model.getRange3 !== 'function' ||
    typeof model.getId !== 'function' ||
    typeof workbook?.getWorksheetById !== 'function' ||
    typeof Range !== 'function' ||
    typeof api.asc_findCell !== 'function' ||
    typeof api.asc_PasteData !== 'function'
  )
    throw new Error('officeSpreadsheetOnly');
  if (
    !history ||
    [
      'Create_NewPoint',
      'StartTransaction',
      'EndTransaction',
      'startGroupPoints',
      'endGroupPoints',
      'cancelGroupPoints',
      '_getLongPointIndex',
    ].some((key) => typeof (history as unknown as Record<string, unknown>)[key] !== 'function')
  )
    throw new Error('Editor history API is unavailable');
  const clipboardFormat = context.AscCommon?.c_oAscClipboardDataFormat?.Text,
    closed = context.AscDFH?.historydescription_GroupPoints,
    type = context.Asc.c_oAscAsyncActionType?.BlockInteraction,
    action = context.Asc.c_oAscAsyncAction?.ApplyChanges;
  if (
    !paste ||
    paste.Api !== api ||
    typeof paste.Paste_Process_End !== 'function' ||
    clipboardFormat === undefined ||
    closed === undefined ||
    type === undefined ||
    action === undefined
  )
    throw new Error('Editor action API is unavailable');
  const id = model.getId(),
    cell = model.getRange3(bounds.r1, bounds.c1, bounds.r2, bounds.c2),
    nativeRange = new Range(bounds.c1, bounds.r1, bounds.c2, bounds.r2);
  const nativeApi = api as unknown as ExcelTextWriteScope['api'];
  assertExcelTextWritable(nativeApi, model, cell, nativeRange, getReadonlyMode());
  const documentCurrent = () => {
    const current = getEditorContext();
    return (
      current?.api === api &&
      current.AscCommon?.History === history &&
      api.wb === wb &&
      api.wbModel === workbook &&
      workbook.getWorksheetById(id) === model
    );
  };
  api.asc_findCell(address.toUpperCase());
  await writeExcelLiteralText(
    {
      api: nativeApi,
      view: view!,
      model,
      cell,
      history: history as ExcelTextWriteScope['history'],
      nativeRange,
      readonly: getReadonlyMode(),
      codes: { BlockInteraction: type, ApplyChanges: action },
      clipboardFormat,
      closedGroupDescription: closed,
      isDocumentCurrent: documentCurrent,
      isCurrent: () => {
        const selection = model.selectionRange;
        return (
          documentCurrent() &&
          !getReadonlyMode() &&
          wb!.getWorksheet() === view &&
          getEditorContext()?.AscCommon?.g_specialPasteHelper === paste &&
          paste.Api === api &&
          selection.activeCell.row === bounds.r1 &&
          selection.activeCell.col === bounds.c1 &&
          selection.ranges.length === 1 &&
          selection.ranges.every(
            (range) =>
              range.r1 === bounds.r1 && range.r2 === bounds.r2 && range.c1 === bounds.c1 && range.c2 === bounds.c2,
          )
        );
      },
      endPaste: () => {
        if (getEditorContext()?.AscCommon?.g_specialPasteHelper === paste && paste.Api === api)
          paste.Paste_Process_End();
      },
    },
    text,
    signal,
  );
}
