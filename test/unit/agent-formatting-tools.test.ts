import { beforeEach, expect, it, vi } from 'vitest';
import { setBoldTool, setParagraphAlignmentTool } from '../../lib/agent-plugin/formatting-tools';
const state = vi.hoisted(() => ({ api: {} as Record<string, unknown>, readonly: false }));
vi.mock('../../lib/agent-plugin/editor-bridge', () => ({ requireEditorApi: () => state.api }));
vi.mock('../../lib/onlyoffice/readonly', () => ({ getReadonlyMode: () => state.readonly }));
beforeEach(() => {
  state.readonly = false;
  state.api = {
    isDocumentLoadComplete: true,
    isLoadFullApi: true,
    WordControl: { m_oLogicDocument: { GetDocPosType: () => 0 } },
    pluginMethod_GetSelectedText: () => 'Selected text',
  };
});
it('sets a specific bold state and verifies the selection properties', async () => {
  let bold = false;
  const put = vi.fn((value: boolean) => {
    bold = value;
  });
  Object.assign(state.api, {
    put_TextPrBold: put,
    get_TextProps: () => ({ get_TextPr: () => ({ get_Bold: () => bold }) }),
  });
  expect(await setBoldTool.execute({ enabled: true })).toEqual({ enabled: true, verified: true });
  expect(put).toHaveBeenCalledExactlyOnceWith(true);
});
it('refuses a cursor-only bold operation and rejects invalid arguments before mutating', async () => {
  const put = vi.fn();
  Object.assign(state.api, { put_TextPrBold: put, get_TextProps: vi.fn(), pluginMethod_GetSelectedText: () => '' });
  await expect(setBoldTool.execute({ enabled: true })).rejects.toThrow();
  await expect(setBoldTool.execute({ enabled: 'yes' as unknown as boolean })).rejects.toThrow();
  expect(put).not.toHaveBeenCalled();
});
it('rejects locked/unsupported contexts and an unverified format change', async () => {
  const put = vi.fn();
  Object.assign(state.api, {
    put_TextPrBold: put,
    get_TextProps: () => ({ get_TextPr: () => ({ get_Bold: () => false }) }),
  });
  state.readonly = true;
  await expect(setBoldTool.execute({ enabled: true })).rejects.toThrow();
  expect(put).not.toHaveBeenCalled();
  state.readonly = false;
  await expect(setBoldTool.execute({ enabled: true })).rejects.toThrow(/verified/);
});
it.each([
  ['left', 1],
  ['center', 2],
  ['right', 0],
  ['justify', 3],
] as const)('sets and verifies %s paragraph alignment', async (alignment, code) => {
  let jc = -1;
  const put = vi.fn((value: number) => {
    jc = value;
  });
  Object.assign(state.api, { put_PrAlign: put, get_TextProps: () => ({ get_ParaPr: () => ({ get_Jc: () => jc }) }) });
  expect(await setParagraphAlignmentTool.execute({ alignment })).toEqual({ alignment, verified: true });
  expect(put).toHaveBeenCalledWith(code);
});
