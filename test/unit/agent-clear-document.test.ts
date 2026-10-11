import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ context: null as unknown, readonly: false }));
vi.mock('../../lib/agent-plugin/editor-bridge', () => ({
  requireEditorContext: () => state.context,
  getEditorContext: () => state.context,
}));
vi.mock('../../lib/onlyoffice/readonly', () => ({ getReadonlyMode: () => state.readonly }));
import { clearDocumentTool } from '../../lib/agent-plugin/clear-document';
function fixture() {
  let text = 'Original body';
  const history = { Index: -1, Points: [] as Array<{ Items: unknown[] }> };
  const logic = {
    GetDocPosType: () => 0,
    GetText: () => text,
    GetSelectionState: () => ['cursor'],
    SetSelectionState: vi.fn(),
    SelectAll: vi.fn(),
    Document_Is_SelectionLocked: () => false,
    StartAction: vi.fn(() => {
      history.Points.push({ Items: [] });
      history.Index++;
    }),
    Remove: vi.fn(() => {
      text = '';
      history.Points[history.Index].Items.push({});
    }),
    FinalizeAction: vi.fn(),
  };
  const api = {
    WordControl: { m_oLogicDocument: logic },
    isViewMode: false,
    canEdit: () => true,
    asc_IsTrackRevisions: () => false,
    Undo: vi.fn(() => {
      text = 'Original body';
      history.Index--;
    }),
  };
  state.context = {
    api,
    Asc: {},
    AscCommon: { History: history, changestype_Delete: 4 },
    AscDFH: { historydescription_Document_DeleteButton: 5 },
  };
  return { api, logic, history, text: () => text };
}
beforeEach(() => {
  state.readonly = false;
});
it('clears the body using one native delete history point and verifies the actual content', async () => {
  const f = fixture();
  expect(await clearDocumentTool.execute({ scope: 'document-body' })).toEqual({ cleared: true, verified: true });
  expect(f.text()).toBe('');
  expect(f.logic.StartAction).toHaveBeenCalledOnce();
  expect(f.logic.FinalizeAction).toHaveBeenCalledOnce();
  f.api.Undo();
  expect(f.text()).toBe('Original body');
});
it('refuses read-only documents without selecting or changing anything', async () => {
  const f = fixture();
  state.readonly = true;
  await expect(clearDocumentTool.execute({ scope: 'document-body' })).rejects.toThrow();
  expect(f.logic.SelectAll).not.toHaveBeenCalled();
  expect(f.text()).toBe('Original body');
});
it('restores cursor state if a native protected selection prevents deletion', async () => {
  const f = fixture();
  f.logic.Document_Is_SelectionLocked = () => true;
  await expect(clearDocumentTool.execute({ scope: 'document-body' })).rejects.toThrow();
  expect(f.logic.SetSelectionState).toHaveBeenCalledWith(['cursor']);
  expect(f.logic.Remove).not.toHaveBeenCalled();
});

it('rolls back an owned deletion when native Remove mutates then throws', async () => {
  const f = fixture();
  const remove = f.logic.Remove.getMockImplementation()!;
  f.logic.Remove.mockImplementation(() => {
    remove();
    throw new Error('native failure');
  });
  await expect(clearDocumentTool.execute({ scope: 'document-body' })).rejects.toThrow('native failure');
  expect(f.text()).toBe('Original body');
  expect(f.api.Undo).toHaveBeenCalledOnce();
});
