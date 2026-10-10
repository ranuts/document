import { beforeEach, describe, expect, it, vi } from 'vitest';
import { captureComposerContext } from '../../lib/agent-plugin/ui/composer-context';
const state = vi.hoisted(() => ({ api: {} as Record<string, unknown> }));
vi.mock('../../lib/agent-plugin/editor-bridge', () => ({ getEditorApi: () => state.api }));
vi.mock('../../lib/agent-plugin/slide-text-read', () => ({
  readSlideTextSelection: ({ getDocContent }: { getDocContent(): unknown }) =>
    getDocContent() ? { selectedText: 'Selected slide words' } : undefined,
}));
beforeEach(() => {
  state.api = { isDocumentLoadComplete: true, isLoadFullApi: true };
});
describe('editor-specific composer context', () => {
  it('reads Word selected text with normalized line endings', () => {
    state.api.pluginMethod_GetSelectedText = () => 'one\r\ntwo';
    expect(captureComposerContext()).toMatchObject({ context: { kind: 'word' }, text: 'one\ntwo', truncated: false });
  });
  it('reads only the selected Excel cells and never uses the Word text API', () => {
    const word = vi.fn(() => 'wrong source');
    const read = vi.fn((r: number, c: number) => ({ getValue: () => `${r}:${c}` }));
    Object.assign(state.api, {
      asc_getActiveRangeStr: () => 'B2:C3',
      asc_getActiveWorksheetName: () => 'Budget',
      pluginMethod_GetSelectedText: word,
      wb: { getWorksheet: () => ({ model: { getRange3: read } }) },
    });
    expect(captureComposerContext()).toMatchObject({
      context: { kind: 'cell', range: 'B2:C3' },
      text: '1:1\t1:2\n2:1\t2:2',
    });
    expect(read).toHaveBeenCalledTimes(4);
    expect(word).not.toHaveBeenCalled();
  });
  it('rejects oversized ranges before reading data', () => {
    const read = vi.fn();
    Object.assign(state.api, {
      asc_getActiveRangeStr: () => 'A1:Z1000',
      wb: { getWorksheet: () => ({ model: { getRange3: read } }) },
    });
    expect(captureComposerContext()).toMatchObject({ text: '', truncated: true });
    expect(read).not.toHaveBeenCalled();
  });
  it('reads PPT controller text selection rather than generic document text', () => {
    const word = vi.fn();
    Object.assign(state.api, {
      getCurrentPage: () => 2,
      pluginMethod_GetSelectedText: word,
      WordControl: {
        m_oLogicDocument: { Slides: [], GetCurrentController: () => ({ getTargetDocContent: () => ({}) }) },
      },
    });
    expect(captureComposerContext()).toMatchObject({
      context: { kind: 'slide', page: 3 },
      text: 'Selected slide words',
    });
    expect(word).not.toHaveBeenCalled();
  });
  it('caps selection payloads and marks truncation explicitly', () => {
    state.api.pluginMethod_GetSelectedText = () => 'x'.repeat(9000);
    expect(captureComposerContext().text).toHaveLength(8000);
    expect(captureComposerContext().truncated).toBe(true);
  });
});
