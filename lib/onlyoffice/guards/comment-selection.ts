/**
 * 8. Comment bulk actions on an empty selection. The spreadsheet's
 * removeAllComments/resolveAllComments read
 * getWorksheet()._getSelection().ranges for the "current selection" variant,
 * but the selection is null until the grid has been focused once -- Review ->
 * Remove comments -> "in current selection" (and the Clear -> Comments path)
 * then throws an uncaught TypeError *after* History.StartTransaction(),
 * leaving an unclosed transaction behind. Found by the UI crawl
 * (test/e2e/ui-crawl.spec.ts). Skip the call when there is nothing selected:
 * removing comments from an empty selection is a no-op anyway.
 */
export function installCommentSelectionGuard(win: Window): boolean {
  const commentWin = win as unknown as {
    Asc?: {
      editor?: Record<string, unknown> & {
        wb?: { getWorksheet?: () => { _getSelection?: () => unknown } | null };
      };
    };
    __ooCommentSelectionGuarded?: boolean;
  };
  const commentApi = commentWin.Asc?.editor;
  if (commentApi && typeof commentApi.asc_RemoveAllComments === 'function' && !commentWin.__ooCommentSelectionGuarded) {
    for (const name of ['asc_RemoveAllComments', 'asc_ResolveAllComments'] as const) {
      const orig = commentApi[name];
      if (typeof orig !== 'function') continue;
      commentApi[name] = function (this: typeof commentApi, ...args: unknown[]) {
        // Signature: (onlyMine, currentSelectionOnly, ...)
        if (args[1]) {
          const sheet = this?.wb?.getWorksheet?.();
          if (!sheet || !sheet._getSelection?.()) {
            console.log(`[OO] ${name} skipped: no cell selection yet`);
            return undefined;
          }
        }
        return (orig as (...a: unknown[]) => unknown).apply(this, args);
      };
    }
    commentWin.__ooCommentSelectionGuarded = true;
    console.log('[OO] comment bulk-action guard installed (no-op without a cell selection)');
  }
  return Boolean(commentWin.__ooCommentSelectionGuarded);
}
