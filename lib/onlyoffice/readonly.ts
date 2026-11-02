import { ASC_RESTRICTION_NONE, ASC_RESTRICTION_VIEW, getSdkEditorApi } from './sdk-api';

/**
 * Readonly is a runtime restriction, never a mount-time permission: the editor
 * always mounts with edit rights and is locked afterwards, so the switch works
 * in both directions without rebuilding (a view-mode mount is a one-way door).
 */
let isReadonlyMode = false;

/**
 * The vendor's own stacked "disable editing" request, entered under its own
 * type so it unwinds without touching the ones the vendor pushes itself
 * (disconnect, signature, forms): popping a type re-applies whatever is left on
 * the stack. Every app reads only the keys it knows, so one object serves all
 * four. Left alone on purpose: the left menu's search and navigation, the
 * header search, the status bar (zoom and sheet tabs live there) and keyboard
 * shortcuts (copy, find). The mask covers the whole toolbar, so the pdf
 * editor's toolbar zoom and paging go with it; the status bar keeps both.
 */
const READONLY_CHROME = {
  toolbar: true,
  rightMenu: { clear: false, disable: true },
  documentHolder: { clear: false, disable: true },
  review: true,
  leftMenu: { disable: false, previewMode: true },
  comments: { disable: false, previewMode: true },
  celleditor: { previewMode: true },
  header: { search: false, docmode: true },
};
const READONLY_CHROME_TYPE = 'readonly';

type ChromeFrame = Window & {
  Common?: { NotificationCenter?: { trigger: (...args: unknown[]) => void } };
  __readonlyChrome?: boolean;
};

/**
 * asc_setRestriction blocks edits in the SDK only; no vendor app listens for
 * asc_onChangeRestrictions, so the toolbar keeps looking live (#298). Tell the
 * UI too, through the same event the vendor uses to lock it.
 */
function syncReadonlyChrome(readonly: boolean): void {
  for (let i = 0; i < window.frames.length; i++) {
    try {
      const win = window.frames[i] as ChromeFrame;
      const center = win.Common?.NotificationCenter;
      // An unlock that was never locked would still run the vendor's
      // re-enable path over whatever this frame's state is.
      if (!center || Boolean(win.__readonlyChrome) === readonly) continue;
      // viewMode must follow the flag: the toolbar stores it as its own
      // edit mode, and an unlock that keeps it true leaves the mask on.
      center.trigger('editing:disable', readonly, { ...READONLY_CHROME, viewMode: readonly }, READONLY_CHROME_TYPE);
      win.__readonlyChrome = readonly;
    } catch {
      // cross-origin frame -- not the editor, skip
    }
  }
}

export function setReadonlyMode(readonly: boolean): void {
  isReadonlyMode = readonly;

  // The SDK restriction API switches the live editor between view and edit in
  // place, no rebuild. The editor must be mounted with full edit permissions
  // for this to be reversible (see createPersonalEditorInstance: restriction
  // is applied after load, never via permissions.edit=false at mount).
  const api = getSdkEditorApi();
  if (api) {
    if (readonly) {
      api.asc_setRestriction?.(ASC_RESTRICTION_VIEW);
    } else {
      api.asc_removeRestriction?.(ASC_RESTRICTION_VIEW);
      api.asc_setRestriction?.(ASC_RESTRICTION_NONE);
    }
  }
  syncReadonlyChrome(readonly);
}

export function getReadonlyMode(): boolean {
  return isReadonlyMode;
}

/** Record the mode a newly created editor is being mounted in. */
export function setReadonlyState(readonly: boolean): void {
  isReadonlyMode = readonly;
}
