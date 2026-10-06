import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ readonly: false, locked: false, global: false, local: true as boolean | null }));
const api = vi.hoisted(() => ({
  WordControl: { m_oLogicDocument: { IsSelectionLocked: () => state.locked } },
  isDocumentLoadComplete: true,
  isLoadFullApi: true,
  isViewMode: false,
  asc_SetGlobalTrackRevisions: vi.fn((value: boolean) => {
    if (!state.locked) state.global = value;
  }),
  asc_GetGlobalTrackRevisions: () => state.global,
  asc_SetLocalTrackRevisions: vi.fn((value: boolean | null) => {
    state.local = value;
  }),
  asc_SetTrackRevisions: vi.fn((value: boolean) => {
    state.local = value;
  }),
  asc_IsTrackRevisions: () => state.local ?? state.global,
}));
vi.mock('../../lib/agent-plugin/editor-bridge', () => ({
  requireEditorContext: () => ({ api, AscCommon: { changestype_Document_Settings: 42 } }),
}));
vi.mock('../../lib/onlyoffice/readonly', () => ({ getReadonlyMode: () => state.readonly }));
import { setDocumentReviewMode } from '../../lib/agent-plugin/review-mode';
beforeEach(() => {
  state.readonly = false;
  state.locked = false;
  state.global = false;
  state.local = true;
  api.isViewMode = false;
  vi.clearAllMocks();
});
it('updates the persistent setting and follows it without a local override', () => {
  expect(setDocumentReviewMode(true)).toBe(true);
  expect(state.global).toBe(true);
  expect(state.local).toBeNull();
  expect(api.asc_SetTrackRevisions).not.toHaveBeenCalled();
  expect(setDocumentReviewMode(false)).toBe(false);
  expect(state.global).toBe(false);
});
it('keeps the local override if native document settings are locked', () => {
  state.locked = true;
  expect(() => setDocumentReviewMode(true)).toThrow();
  expect(state.local).toBe(true);
  expect(api.asc_SetLocalTrackRevisions).not.toHaveBeenCalled();
});
it.each(['readonly', 'view'] as const)('blocks %s before any native setting mutation', (mode) => {
  if (mode === 'readonly') state.readonly = true;
  else api.isViewMode = true;
  expect(() => setDocumentReviewMode(false)).toThrow();
  expect(api.asc_SetGlobalTrackRevisions).not.toHaveBeenCalled();
  expect(api.asc_SetLocalTrackRevisions).not.toHaveBeenCalled();
});
it('does not clear a conflicting local override when matching global settings are locked', () => {
  state.global = true;
  state.local = false;
  state.locked = true;
  expect(() => setDocumentReviewMode(true)).toThrow();
  expect(state.local).toBe(false);
  expect(api.asc_SetLocalTrackRevisions).not.toHaveBeenCalled();
});
