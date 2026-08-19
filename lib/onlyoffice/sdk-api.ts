/**
 * Reaching the SDK inside the (same-origin) editor iframe. Everything that
 * talks to a mounted editor goes through here: the vendor exposes its API as
 * `Asc.editor` on the frame, aliased to the frame's own `editor` global.
 */

// Asc.c_oAscRestrictionType values (public SDK enum).
export const ASC_RESTRICTION_NONE = 0;
export const ASC_RESTRICTION_VIEW = 128;

export type SdkEditorApi = {
  asc_setRestriction?: (value: number) => void;
  asc_removeRestriction?: (value: number) => void;
  /** Presentation editor: show/hide the slide thumbnails panel. */
  ShowThumbnails?: (visible: boolean) => void;
  zoomFitToWidth?: () => void;
  /** word and slide: recompute the canvas geometry after the chrome changed. */
  WordControl?: { OnResize?: () => void };
  /** The spreadsheet editor's equivalent (it has no WordControl). */
  asc_Resize?: () => void;
  /** Presentation editor: the notes pane, with its getter. */
  asc_ShowNotes?: (visible: boolean) => void;
  getIsNotesShow?: () => boolean;
  /** Word and presentation editors: the rulers, with their getter. */
  asc_SetViewRulers?: (visible: boolean) => void;
  asc_GetViewRulers?: () => boolean;
};

/**
 * Width of an element inside the (same-origin) editor frame, 0 when it is
 * absent or hidden. Used to tell "the panel is open" from "the user already
 * closed it" before folding anything away.
 */
export function measureEditorElementWidth(selector: string): number {
  for (let i = 0; i < window.frames.length; i++) {
    try {
      const doc = window.frames[i].document;
      const element = doc?.querySelector(selector);
      if (element) return Math.round(element.getBoundingClientRect().width);
    } catch {
      // cross-origin frame -- not the editor
    }
  }
  return 0;
}

// Locate the SDK API instance inside the (same-origin) editor iframe. The
// vendor build exposes it as Asc.editor and aliases it to the frame's own
// `editor` global.
export function getSdkEditorApi(): SdkEditorApi | null {
  for (let i = 0; i < window.frames.length; i++) {
    try {
      const win = window.frames[i] as Window & {
        Asc?: { editor?: SdkEditorApi };
        editor?: SdkEditorApi;
      };
      const api = win.Asc?.editor || win.editor;
      if (api && typeof api.asc_setRestriction === 'function') {
        return api;
      }
    } catch {
      // cross-origin frame -- not the editor, skip
    }
  }
  return null;
}

// v9.3.0 renamed sendCommand -> serviceCommand; keep the fallback for safety.
export function editorSendCommand(params: { command: string; data: Record<string, any> }): void {
  const editor = window.editor as any;
  if (!editor) return;
  if (typeof editor.serviceCommand === 'function') {
    editor.serviceCommand(params);
  } else if (typeof editor.sendCommand === 'function') {
    editor.sendCommand(params);
  }
}
