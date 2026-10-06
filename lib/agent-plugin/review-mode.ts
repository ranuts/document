import { requireEditorContext } from './editor-bridge';
import { getReadonlyMode } from '../onlyoffice/readonly';

/** Use native document tracking, so Save and Undo retain the document setting. */
export function setDocumentReviewMode(enabled: boolean): boolean {
  if (typeof enabled !== 'boolean') throw new TypeError('set_review_mode requires a boolean enabled parameter');
  const { api, AscCommon } = requireEditorContext();
  if (!api.isDocumentLoadComplete || !api.isLoadFullApi) throw new Error('Editor is still loading');
  if (getReadonlyMode() || api.isViewMode) throw new Error('Document is read-only');
  if (
    typeof api.asc_SetGlobalTrackRevisions !== 'function' ||
    typeof api.asc_GetGlobalTrackRevisions !== 'function' ||
    typeof api.asc_SetLocalTrackRevisions !== 'function' ||
    typeof api.asc_IsTrackRevisions !== 'function'
  )
    throw new Error('set_review_mode is only available in the Word editor');
  const logic = (api.WordControl as { m_oLogicDocument?: { IsSelectionLocked(type: number): boolean } } | undefined)
    ?.m_oLogicDocument;
  const settingsType = AscCommon?.changestype_Document_Settings;
  if (!Number.isInteger(settingsType) || typeof logic?.IsSelectionLocked !== 'function')
    throw new Error('set_review_mode is only available in the Word editor');
  if (logic.IsSelectionLocked(settingsType!)) throw new Error('officeReviewSettingsLocked');
  // Verify the persistent setting before clearing a session override: a locked
  // native setter may return without changing the document.
  api.asc_SetGlobalTrackRevisions(enabled);
  if (api.asc_GetGlobalTrackRevisions() !== enabled)
    throw new Error('The change could not be verified. Check the document and use Undo if needed.');
  api.asc_SetLocalTrackRevisions(null);
  if (api.asc_GetGlobalTrackRevisions() !== enabled || api.asc_IsTrackRevisions() !== enabled)
    throw new Error('The change could not be verified. Check the document and use Undo if needed.');
  return enabled;
}
