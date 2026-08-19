/**
 * 7. Whole-sheet series-settings guard (cell editor). After Ctrl+A the
 * selection is the full 1048576 x 16384 grid; asc_GetSeriesSettings (the
 * chart-insert dialog's data source) then builds series over every cell of
 * that selection, which pins the main thread and exhausts memory until "Array
 * buffer allocation failed" -- the renderer dies or, at best, the document can
 * no longer be saved. Found by the api-surface sweep (minimal repro:
 * asc_EditSelectAll then asc_GetSeriesSettings), reachable from the UI as
 * select-all -> insert chart. Clamp oversized selections to the used area for
 * the duration of the call, restoring afterwards, so the vendor logic sees at
 * most the cells that actually hold data.
 */
export function installSeriesSettingsGuard(win: Window): boolean {
  const seriesWin = win as unknown as {
    Asc?: {
      editor?: {
        asc_GetSeriesSettings?: () => unknown;
        wb?: {
          getWorksheet?: () => {
            setSelection?: (range: unknown) => void;
            model?: {
              selectionRange?: { getLast?: () => { r1: number; c1: number; r2: number; c2: number } };
              getRowsCount?: () => number;
              getColsCount?: () => number;
            };
          };
        };
      };
      Range?: new (c1: number, r1: number, c2: number, r2: number) => unknown;
    };
    __ooSeriesSelectionGuarded?: boolean;
  };
  const seriesApi = seriesWin.Asc?.editor;
  const RangeCtor = seriesWin.Asc?.Range;
  if (
    seriesApi &&
    typeof seriesApi.asc_GetSeriesSettings === 'function' &&
    RangeCtor &&
    !seriesWin.__ooSeriesSelectionGuarded
  ) {
    const origSeries = seriesApi.asc_GetSeriesSettings;
    const MAX_SERIES_CELLS = 200_000;
    seriesApi.asc_GetSeriesSettings = function (this: typeof seriesApi) {
      try {
        const ws = this.wb?.getWorksheet?.();
        const model = ws?.model;
        const last = model?.selectionRange?.getLast?.();
        if (ws && model && last && typeof ws.setSelection === 'function') {
          const area = (last.r2 - last.r1 + 1) * (last.c2 - last.c1 + 1);
          if (area > MAX_SERIES_CELLS) {
            const rows = Math.max(1, model.getRowsCount?.() ?? 1);
            const cols = Math.max(1, model.getColsCount?.() ?? 1);
            const saved = { r1: last.r1, c1: last.c1, r2: last.r2, c2: last.c2 };
            ws.setSelection(new RangeCtor(last.c1, last.r1, Math.min(last.c2, cols), Math.min(last.r2, rows)));
            try {
              return origSeries.call(this);
            } finally {
              ws.setSelection(new RangeCtor(saved.c1, saved.r1, saved.c2, saved.r2));
            }
          }
        }
      } catch {
        // any probing failure falls through to the vendor behavior
      }
      return origSeries.call(this);
    };
    seriesWin.__ooSeriesSelectionGuarded = true;
    console.log('[OO] whole-sheet series-settings guard installed');
  }
  return Boolean(seriesWin.__ooSeriesSelectionGuarded);
}
