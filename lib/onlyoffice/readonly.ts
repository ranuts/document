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
 * shortcuts (copy, find). The toolbar is not masked here: the mask covers every
 * tab, View included, so the tabs are hidden instead (READONLY_TABS).
 */
const READONLY_CHROME = {
  rightMenu: { clear: false, disable: true },
  documentHolder: { clear: false, disable: true },
  review: true,
  leftMenu: { disable: false, previewMode: true },
  comments: { disable: false, previewMode: true },
  celleditor: { previewMode: true },
  header: { search: false, docmode: true },
};
const READONLY_CHROME_TYPE = 'readonly';

/**
 * The toolbar tabs a readonly document keeps, the same in all four editors:
 * File (download, print, info) and View (zoom, navigation, theme). A rule
 * rather than vendor calls, because the vendor shows contextual tabs (table
 * design, header and footer) on its own when the selection moves.
 */
const READONLY_TABS = ['file', 'view'];
/**
 * Editing controls that live outside the hidden tabs: the clipboard group
 * every tab shares (copy stays), View's macros, sheet views, freeze panes and
 * slide master, the pdf editor's Edit PDF switch and the header's edit-mode
 * switch.
 */
const READONLY_HIDDEN_SLOTS = [
  'btn-paste',
  'btn-cut',
  'btn-copystyle',
  'btn-macros',
  'btn-macro-start',
  'btn-macro-pause',
  'createview',
  'closeview',
  'btn-freeze',
  'btn-slide-master',
  'btn-tb-edit-mode',
  'btn-edit-mode',
];
const READONLY_CLASS = 'readonly-chrome';
const keptTab = READONLY_TABS.map((tab) => `:not(:has(> a[data-tab="${tab}"]))`).join('');
const hiddenSlots = READONLY_HIDDEN_SLOTS.map((slot) => `#slot-${slot}`).join(', ');
const READONLY_CSS = [
  `html.${READONLY_CLASS} #toolbar .tabs .ribtab${keptTab} { display: none !important; }`,
  `html.${READONLY_CLASS} :is(${hiddenSlots}) { display: none !important; }`,
].join('\n');

type ChromeFrame = Window & {
  Common?: { NotificationCenter?: { trigger: (...args: unknown[]) => void } };
  __readonlyChrome?: boolean;
  /** The tab that was active when the document was locked, restored on unlock. */
  __readonlyPreviousTab?: string;
};

function activeTab(doc: Document): string | undefined {
  return doc.querySelector<HTMLElement>('#toolbar .tabs .ribtab.active > a[data-tab]')?.dataset.tab;
}

function openTab(doc: Document, tab: string): void {
  doc.querySelector<HTMLElement>(`#toolbar .tabs .ribtab > a[data-tab="${tab}"]`)?.click();
}

function syncReadonlyTabs(win: ChromeFrame, readonly: boolean): void {
  const doc = win.document;
  if (!doc.getElementById('oo-readonly-css')) {
    const style = doc.createElement('style');
    style.id = 'oo-readonly-css';
    style.textContent = READONLY_CSS;
    (doc.head || doc.documentElement).appendChild(style);
  }
  doc.documentElement.classList.toggle(READONLY_CLASS, readonly);
  if (readonly) {
    const current = activeTab(doc);
    if (current && !READONLY_TABS.includes(current)) {
      win.__readonlyPreviousTab = current;
      openTab(doc, 'view');
    }
  } else if (win.__readonlyPreviousTab) {
    openTab(doc, win.__readonlyPreviousTab);
    win.__readonlyPreviousTab = undefined;
  }
}

/**
 * asc_setRestriction blocks edits in the SDK only; no vendor app listens for
 * asc_onChangeRestrictions, so the toolbar keeps looking live (#298). Tell the
 * UI too, through the same event the vendor uses to lock it, and hide the tabs
 * that only edit.
 */
function syncReadonlyChrome(readonly: boolean): void {
  for (let i = 0; i < window.frames.length; i++) {
    try {
      const win = window.frames[i] as ChromeFrame;
      const center = win.Common?.NotificationCenter;
      // An unlock that was never locked would still run the vendor's
      // re-enable path over whatever this frame's state is.
      if (!center || Boolean(win.__readonlyChrome) === readonly) continue;
      // viewMode must follow the flag: the header keeps undo/redo locked
      // for as long as it is true.
      center.trigger('editing:disable', readonly, { ...READONLY_CHROME, viewMode: readonly }, READONLY_CHROME_TYPE);
      syncReadonlyTabs(win, readonly);
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
