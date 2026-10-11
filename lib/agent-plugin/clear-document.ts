import type { AgentTool } from '@ranuts/agent-core/types';
import { requireEditorContext, getEditorContext } from './editor-bridge';
import { getReadonlyMode } from '../onlyoffice/readonly';
import { readWordBodyText } from './word-text-read';
import { beginWordPasteHistory } from './word-paste-history';
interface BodyDocument {
  Slides?: unknown[];
  GetDocPosType(): number;
  GetSelectionState(): unknown;
  SetSelectionState(state: unknown): void;
  SelectAll(): void;
  Document_Is_SelectionLocked(type: number): boolean;
  StartAction(description: number): void;
  Remove(
    count: number,
    onlyText: boolean,
    removeOnlySelection: boolean,
    onTextAdd: boolean,
    word: boolean,
    keyboard: boolean,
  ): void;
  FinalizeAction(): void;
}
/** Destructive scope is explicit; the host must require review before calling this tool. */
export const clearDocumentTool: AgentTool<{ scope: 'document-body' }, { cleared: true; verified: true }> = {
  name: 'clear_document',
  description:
    'Word only. Delete all main document body content, including tables and drawings, using one native Undo point. Requires confirmation of the whole document scope. Does not delete the file or headers/footers. Unavailable in read-only or tracked-changes mode.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['scope'],
    properties: { scope: { type: 'string', enum: ['document-body'] } },
  },
  readOnlyHint: false,
  execute: async ({ scope }, signal) => {
    signal?.throwIfAborted();
    const context = requireEditorContext(),
      api = context.api;
    const logic = (api.WordControl as { m_oLogicDocument?: BodyDocument } | undefined)?.m_oLogicDocument;
    if (scope !== 'document-body' || !logic || logic.Slides || logic.GetDocPosType?.() !== 0)
      throw new Error('Clearing requires the main Word document body');
    if (getReadonlyMode() || api.isViewMode || typeof api.canEdit !== 'function' || !(api.canEdit as () => boolean)())
      throw new Error('Document is read-only');
    if (api.asc_IsTrackRevisions()) throw new Error('Turn off tracked changes before clearing the document');
    const type = (context.AscCommon as { changestype_Delete?: number } | undefined)?.changestype_Delete;
    const description = (context.AscDFH as unknown as { historydescription_Document_DeleteButton?: number } | undefined)
      ?.historydescription_Document_DeleteButton;
    const history = context.AscCommon?.History;
    if (
      type === undefined ||
      description === undefined ||
      !history ||
      typeof api.Undo !== 'function' ||
      [
        'SelectAll',
        'GetSelectionState',
        'SetSelectionState',
        'Document_Is_SelectionLocked',
        'StartAction',
        'Remove',
        'FinalizeAction',
      ].some((key) => typeof (logic as unknown as Record<string, unknown>)[key] !== 'function') ||
      readWordBodyText(logic) === undefined
    )
      throw new Error('Document deletion API is unavailable');
    const current = () =>
      getEditorContext()?.api === api &&
      (api.WordControl as { m_oLogicDocument?: BodyDocument } | undefined)?.m_oLogicDocument === logic &&
      getEditorContext()?.AscCommon?.History === history;
    const selection = logic.GetSelectionState();
    logic.SelectAll();
    if (!current() || logic.Document_Is_SelectionLocked(type)) {
      if (current()) logic.SetSelectionState(selection);
      throw new Error('Document content is protected');
    }
    const transaction = beginWordPasteHistory(history, current, () => (api.Undo as () => void)());
    let finalized = false;
    try {
      logic.StartAction(description);
      try {
        logic.Remove(1, false, false, false, false, true);
      } finally {
        logic.FinalizeAction();
        finalized = true;
        transaction.seal();
      }
      if (!current() || readWordBodyText(logic)?.trim() !== '')
        throw new Error('Document deletion could not be verified');
      signal?.throwIfAborted();
      transaction.commit();
      return { cleared: true, verified: true };
    } catch (error) {
      if (finalized && transaction.ownsPoint()) transaction.rollback();
      throw error;
    }
  },
};
