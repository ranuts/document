import { getEditorApi, type EditorApi } from '../editor-bridge';
import { captureComposerContext } from './composer-context';
import { t } from '@ranuts/shared/i18n';

// SDK events verified in the bundled Word, spreadsheet and slide runtimes.
const CONTEXT_EVENTS = [
  'asc_onSelectionChanged',
  'asc_onSelectionEnd',
  'asc_onFocusObject',
  'asc_onCurrentPage',
  'asc_onEditorSelectionChanged',
  'asc_onActiveSheetChanged',
  'asc_onDocumentChanged',
  'asc_onDocumentModifiedChanged',
  'asc_onUserActionEnd',
  'asc_onSheetsChanged',
  'asc_onModifiedDocument',
  'asc_onUndoRedo',
  'asc_onChangeRestrictions',
  'asc_onChangeViewMode',
  'asc_onChangeDocumentProtection',
  'asc_onChangeProtectWorkbook',
  'asc_onChangeProtectWorksheet',
  'asc_onChangeDisplayModeInReview',
  'asc_onOnTrackRevisionsChange',
];
const INPUT_EVENTS = [
  'selectionchange',
  'input',
  'pointerdown',
  'pointerup',
  'keydown',
  'keyup',
  'paste',
  'cut',
  'drop',
];

/** Own event-driven context refreshes and SDK subscriptions for one panel lifecycle. */
export function mountPanelContext(options: {
  isActive: () => boolean;
  refresh: () => void;
  getApi?: () => EditorApi | null;
}): { update: () => void; dispose: () => void } {
  let pending: ReturnType<typeof setTimeout> | undefined;
  let api: EditorApi | null = null;
  let editorDocument: Document | null = null;
  let suspended = false;
  let disposed = false;
  const active = () => !disposed && !suspended && document.visibilityState !== 'hidden' && options.isActive();
  const scheduleRefresh = () => {
    if (active()) pending ??= setTimeout(refresh, 16);
  };
  const detach = () => {
    for (const name of CONTEXT_EVENTS) {
      try {
        api?.asc_unregisterCallback?.(name, scheduleRefresh);
      } catch {
        // A replaced SDK may already have destroyed its callback registry.
      }
    }
    api = null;
    for (const name of INPUT_EVENTS) editorDocument?.removeEventListener(name, scheduleRefresh, true);
    editorDocument = null;
  };
  const stop = () => {
    clearTimeout(pending);
    pending = undefined;
    detach();
  };
  const refresh = () => {
    clearTimeout(pending);
    pending = undefined;
    if (!active()) {
      stop();
      return;
    }
    let next: EditorApi | null = null;
    try {
      next = (options.getApi ?? getEditorApi)();
    } catch {
      // Context is optional while the editor frame is loading/replaced.
    }
    if (next !== api) {
      detach();
      api = next;
      if (typeof next?.asc_registerCallback === 'function' && typeof next.asc_unregisterCallback === 'function') {
        for (const name of CONTEXT_EVENTS) {
          try {
            next.asc_registerCallback(name, scheduleRefresh);
          } catch {
            // Some formats omit notifications; editor input events still refresh context.
          }
        }
      }
    }
    // Native input is also needed for interaction-based proposal invalidation,
    // and provides a fallback for SDKs without disposable callbacks.
    if (api && !editorDocument) {
      for (const frame of document.querySelectorAll<HTMLIFrameElement>('iframe')) {
        try {
          const win = frame.contentWindow as (Window & { editor?: EditorApi; Asc?: { editor?: EditorApi } }) | null;
          if ((win?.editor ?? win?.Asc?.editor) !== api || !frame.contentDocument) continue;
          editorDocument = frame.contentDocument;
          for (const name of INPUT_EVENTS) editorDocument.addEventListener(name, scheduleRefresh, true);
          break;
        } catch {
          // Ignore inaccessible frames.
        }
      }
    }
    try {
      options.refresh();
    } catch {
      // A transient SDK read must not interrupt open/disable or visibility updates.
    }
  };
  const update = () => {
    if (!active()) {
      stop();
      return;
    }
    refresh();
  };
  const onDocument = () => {
    detach();
    update();
  };
  const onHide = (event: PageTransitionEvent) => {
    suspended = true;
    stop();
    if (!event.persisted) dispose();
  };
  const onShow = (event: PageTransitionEvent) => {
    if (!event.persisted) return;
    suspended = false;
    update();
  };
  const dispose = () => {
    disposed = true;
    stop();
    document.removeEventListener('visibilitychange', update);
    window.removeEventListener('document:content-ready', onDocument);
    window.removeEventListener('pagehide', onHide);
    window.removeEventListener('pageshow', onShow);
  };
  document.addEventListener('visibilitychange', update);
  window.addEventListener('document:content-ready', onDocument);
  window.addEventListener('pagehide', onHide);
  window.addEventListener('pageshow', onShow);
  update();
  return { update, dispose };
}

/** Selection chips and the empty-composer hint share one bounded SDK snapshot. */
export function syncPanelContext(options: {
  quoteContext: HTMLElement;
  quoteSummary: HTMLElement;
  quoteText: HTMLElement;
  welcomeHint: HTMLElement;
  settings: HTMLElement;
  ready: () => boolean;
}): void {
  const snapshot = captureComposerContext();
  const context = snapshot.context;
  options.quoteContext.hidden = !context || !snapshot.text.trim();
  const label =
    context?.kind === 'cell'
      ? t('agentUsingSelection', { scope: `${context.sheet ?? 'Excel'} · ${context.range ?? ''}` })
      : context?.kind === 'slide'
        ? t('agentSlideContext').replace('{page}', String(context.page ?? ''))
        : snapshot.text
          ? t('agentSelectionContext').replace('{count}', String(snapshot.text.length))
          : t('agentCurrentDocument');
  if (options.quoteSummary.textContent !== label) options.quoteSummary.textContent = label;
  options.quoteSummary.setAttribute('aria-label', `${t('agentReadSelection')} · ${label}`);
  if (options.quoteText.textContent !== snapshot.text) options.quoteText.textContent = snapshot.text;
  const release = options.settings.querySelector<HTMLElement>('.agent-release-memory');
  if (release) release.hidden = !options.ready();
  const welcome =
    context?.kind === 'cell'
      ? 'agentWelcomeCell'
      : context?.kind === 'pdf'
        ? 'agentWelcomePdf'
        : context?.kind === 'slide'
          ? 'agentWelcomeSlide'
          : 'agentWelcomeWord';
  if (options.welcomeHint.textContent !== t(welcome)) options.welcomeHint.textContent = t(welcome);
}
