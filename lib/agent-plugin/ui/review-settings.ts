import { getEditorApi, type EditorApi } from '../editor-bridge';
import { captureDocumentContext } from '../document-context';
import { getReadonlyMode } from '../../onlyoffice/readonly';
import { agentTools } from '../tools';
import { displayError } from './presentation';
import type { ChatTurn } from './controller';
type CheckedDetail = CustomEvent<{ checked: boolean }>;

/** Own Word review settings and their native tracking-change subscription. */
export function mountReviewSettings(options: {
  reviewCheck: HTMLElement;
  reviewLabel: HTMLElement;
  appendTurn: (turn: ChatTurn) => void;
}): { sync: () => void; dispose: () => void } {
  const { reviewCheck, reviewLabel, appendTurn } = options;
  // Review-mode toggle reads/sets track-changes directly on the editor. r-checkbox
  // reports the new state via the change event's detail (a real boolean), and its
  // initial state is set through the `checked` attribute.
  // Persistent track-changes is Word-only; detect the runtime settings APIs.
  let syncingReview = false;
  let suspended = false;
  let disposed = false;
  let reviewApi: EditorApi | undefined;
  const detachReview = (): void => {
    reviewApi?.asc_unregisterCallback?.('asc_onOnTrackRevisionsChange', syncReviewControl);
    reviewApi = undefined;
  };
  const syncReviewControl = (): void => {
    if (disposed || suspended) return;
    const api = getEditorApi();
    if (api !== reviewApi) {
      detachReview();
      if (
        api?.isDocumentLoadComplete &&
        api.isLoadFullApi &&
        typeof api.asc_registerCallback === 'function' &&
        typeof api.asc_unregisterCallback === 'function'
      ) {
        reviewApi = api;
        api.asc_registerCallback('asc_onOnTrackRevisionsChange', syncReviewControl);
      }
    }
    const canReview =
      !!api &&
      captureDocumentContext()?.kind === 'word' &&
      api.isDocumentLoadComplete &&
      api.isLoadFullApi &&
      !api.isViewMode &&
      !getReadonlyMode() &&
      typeof api.asc_IsTrackRevisions === 'function' &&
      typeof api.asc_SetGlobalTrackRevisions === 'function' &&
      typeof api.asc_GetGlobalTrackRevisions === 'function' &&
      typeof api.asc_SetLocalTrackRevisions === 'function';
    reviewCheck.toggleAttribute('disabled', !canReview);
    reviewLabel.hidden = !canReview;
    const checked = String(typeof api?.asc_IsTrackRevisions === 'function' && !!api.asc_IsTrackRevisions());
    syncingReview = true;
    try {
      if (reviewCheck.getAttribute('checked') !== checked) reviewCheck.setAttribute('checked', checked);
    } finally {
      syncingReview = false;
    }
  };
  syncReviewControl();
  window.addEventListener('document:content-ready', syncReviewControl);
  const onHide = (event: PageTransitionEvent) => {
    suspended = true;
    detachReview();
    if (!event.persisted) dispose();
  };
  const onShow = (event: PageTransitionEvent) => {
    if (!event.persisted) return;
    suspended = false;
    syncReviewControl();
  };
  const dispose = () => {
    disposed = true;
    detachReview();
    window.removeEventListener('document:content-ready', syncReviewControl);
    window.removeEventListener('pagehide', onHide);
    window.removeEventListener('pageshow', onShow);
  };
  window.addEventListener('pagehide', onHide);
  window.addEventListener('pageshow', onShow);
  reviewCheck.addEventListener('change', async (e: Event) => {
    if (syncingReview) return;
    try {
      await agentTools.set_review_mode.execute({ enabled: (e as CheckedDetail).detail.checked });
    } catch (error) {
      appendTurn({ role: 'error', text: displayError(error) });
    } finally {
      syncReviewControl();
    }
  });

  return { sync: syncReviewControl, dispose };
}
