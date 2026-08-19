/**
 * 5. Serverless save semantics. The SDK's coauthoring autosave loop
 * (autoSaveGap, ticking every 40ms) pushes each edit to a Document Server and,
 * on the fake success our serverless build produces, marks the history as
 * saved: isDocumentCanSave flips back to false within 1-2s of every keystroke,
 * so the toolbar Save button and Ctrl+S stay permanently disabled and the user
 * cannot save at all (verified live: canSave true -> false exactly
 * autoSaveGapFast later; with the gap at 0 the button stays lit). Two
 * coordinated patches, mirroring what the SDK itself does for the desktop
 * offline mode:
 * 5a. kill the autosave loop (gap 0 makes _autoSave a no-op);
 * 5b. route user-initiated asc_Save (Save button / Ctrl+S) to asc_DownloadAs
 *    in the document's own format, which produces the onlyoffice-file-stream
 *    our save UX consumes. Autosave-flagged calls keep the original path so
 *    nothing else changes.
 */
export function installServerlessSaveSemantics(win: Window): boolean {
  const saveWin = win as unknown as {
    Asc?: {
      editor?: {
        autoSaveGap?: number;
        autoSaveGapFast?: number;
        autoSaveGapRealTime?: number;
        asc_setAutoSaveGap?: (gap: number) => void;
        asc_Save?: (isAutoSave?: boolean, isUndoRequest?: boolean) => boolean;
        asc_DownloadAs?: (options: unknown) => void;
        documentFormatSave?: number;
      };
      asc_CDownloadOptions?: new (fileType: number) => unknown;
    };
    __ooServerlessSavePatched?: boolean;
  };
  const saveApi = saveWin.Asc?.editor;
  if (
    saveApi &&
    typeof saveApi.asc_Save === 'function' &&
    saveWin.Asc?.asc_CDownloadOptions &&
    !saveWin.__ooServerlessSavePatched
  ) {
    saveApi.autoSaveGap = 0;
    saveApi.autoSaveGapFast = 0;
    saveApi.autoSaveGapRealTime = 0;
    // The app layer re-applies the user's autosave preference from
    // localStorage on ready and on settings changes; pin the setter so
    // those calls cannot resurrect the loop.
    saveApi.asc_setAutoSaveGap = function () {
      this.autoSaveGap = 0;
    };
    const origSave = saveApi.asc_Save;
    const DownloadOptions = saveWin.Asc.asc_CDownloadOptions;
    saveApi.asc_Save = function (isAutoSave?: boolean, isUndoRequest?: boolean) {
      if (isAutoSave) return origSave.call(this, isAutoSave, isUndoRequest);
      const format = typeof this.documentFormatSave === 'number' ? this.documentFormatSave : undefined;
      if (format === undefined || typeof this.asc_DownloadAs !== 'function') {
        return origSave.call(this, isAutoSave, isUndoRequest);
      }
      this.asc_DownloadAs(new DownloadOptions(format));
      return true;
    };
    saveWin.__ooServerlessSavePatched = true;
    console.log('[OO] serverless save semantics installed (autosave loop off, Save/Ctrl+S -> download stream)');
  }
  return Boolean(saveWin.__ooServerlessSavePatched);
}
