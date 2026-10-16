import { beforeEach, expect, it, vi } from 'vitest';
import { captureRequestContext } from '../../lib/agent-plugin/ui/request-context';
const state = vi.hoisted(() => ({ api: {} as Record<string, unknown> }));
vi.mock('../../lib/agent-plugin/editor-bridge', () => ({ getEditorApi: () => state.api }));
beforeEach(() => {
  state.api = { isDocumentLoadComplete: true, isLoadFullApi: true, pluginMethod_GetSelectedText: () => '' };
});
it('reads Word body without selecting all or moving the insertion point', () => {
  const select = vi.fn();
  state.api.asc_EditSelectAll = select;
  state.api.WordControl = { m_oLogicDocument: { GetText: () => 'Actual document body' } };
  expect(captureRequestContext()).toMatchObject({
    content: { scope: 'document-body', text: 'Actual document body', truncated: false },
  });
  expect(select).not.toHaveBeenCalled();
});
it('reads the active sheet used range, including numeric values outside the selected empty cell', () => {
  const read = vi.fn((r: number) => ({ getValue: () => String(r + 1) }));
  Object.assign(state.api, {
    asc_getActiveRangeStr: () => 'B1',
    asc_getActiveWorksheetName: () => 'Data',
    wb: {
      getWorksheet: () => ({ model: { getMinimalRange: () => ({ r1: 0, r2: 99, c1: 0, c2: 0 }), getRange3: read } }),
    },
  });
  const context = captureRequestContext();
  expect(context).toMatchObject({ content: { scope: 'active-sheet-used-range', range: 'A1:A100', truncated: false } });
  expect(context.content?.text).toBe(Array.from({ length: 100 }, (_, i) => String(i + 1)).join('\n'));
  expect(read).toHaveBeenCalledTimes(101);
});
it('bounds large sheets before visiting cells and reports the exact partial range', () => {
  const read = vi.fn(() => ({ getValue: () => '1' }));
  Object.assign(state.api, {
    asc_getActiveRangeStr: () => 'A1',
    wb: {
      getWorksheet: () => ({
        model: { getMinimalRange: () => ({ r1: 0, r2: 99999, c1: 0, c2: 99 }), getRange3: read },
      }),
    },
  });
  expect(captureRequestContext()).toMatchObject({ content: { truncated: true } });
  expect(read.mock.calls.length).toBeLessThanOrEqual(2001);
});
it('reports an empty sheet as empty data, not an unreadable document', () => {
  Object.assign(state.api, {
    asc_getActiveRangeStr: () => 'A1',
    wb: { getWorksheet: () => ({ model: { getMinimalRange: () => null } }) },
  });
  expect(captureRequestContext()).toMatchObject({ content: { text: '', truncated: false } });
});
it('keeps unavailable context distinct from an empty document', () => {
  expect(captureRequestContext()).toMatchObject({ content: { unavailable: true } });
});
it('reads nested slide groups using the same shape reader as the presentation tool', () => {
  Object.assign(state.api, {
    asc_GetCurrentSlide: () => 0,
    WordControl: {
      m_oLogicDocument: { Slides: [{ cSld: { spTree: [{ spTree: [{ getText: () => 'Grouped title' }] }] } }] },
    },
  });
  expect(captureRequestContext()).toMatchObject({
    content: { scope: 'presentation-text', text: 'Slide 1:\nGrouped title', truncated: false },
  });
});
it('attaches only the exact current PDF page and never presents it as the whole document', () => {
  Object.assign(state.api, {
    isPdfEditor: () => true,
    getCurrentPage: () => 1,
    DocumentRenderer: {
      file: {
        pages: [{}, { text: [] }],
        copySelection(_page: number, out: { Text: string }) {
          out.Text = 'Budget 120';
        },
      },
    },
  });
  expect(captureRequestContext()).toMatchObject({
    editor: { kind: 'pdf', page: 2, pages: 2 },
    content: { scope: 'pdf-page', page: 2, pages: 2, text: 'Budget 120' },
  });
});
it('reports a PDF page without extracted text as unavailable, not empty', () => {
  Object.assign(state.api, {
    isPdfEditor: () => true,
    getCurrentPage: () => 0,
    DocumentRenderer: { file: { pages: [{}] } },
  });
  expect(captureRequestContext()).toMatchObject({ content: { scope: 'pdf-page', page: 1, unavailable: true } });
});

it('captures only bounded selection metadata for ordinary chat and native requests', () => {
  const body = vi.fn(() => 'private document');
  state.api.WordControl = { m_oLogicDocument: { GetText: body } };
  state.api.pluginMethod_GetSelectedText = () => 'selected';
  expect(captureRequestContext('metadata')).toEqual({
    editor: { kind: 'word', selectionCharacters: 8 },
    selection: { text: 'selected', truncated: false },
  });
  expect(body).not.toHaveBeenCalled();
});
it('grounds a selected read in the exact selection without reading the Word body', () => {
  const body = vi.fn(() => 'private document');
  state.api.WordControl = { m_oLogicDocument: { GetText: body } };
  state.api.pluginMethod_GetSelectedText = () => 'selected';
  expect(captureRequestContext('selection')).toMatchObject({
    content: { scope: 'selection', text: 'selected', truncated: false },
  });
  expect(body).not.toHaveBeenCalled();
});

it.each(['English selection '.repeat(600), '中文选区。'.repeat(2000), '"\\\n'.repeat(3000)])(
  'serializes a long metadata selection without changing captured windows or rereading SDK content',
  async (source) => {
    const { serializeRequestContext } = await import('../../lib/agent-plugin/ui/request-context');
    const selected = vi.fn(() => source);
    state.api.pluginMethod_GetSelectedText = selected;
    const captured = captureRequestContext('metadata');
    expect(captured.selection.text).toHaveLength(8000);
    const original = JSON.stringify(captured);
    const calls = selected.mock.calls.length;
    const bounded = serializeRequestContext(captured, 'Tell me a short story');
    const context = JSON.parse(bounded.serialized);
    expect(context.editor).toEqual(captured.editor);
    expect(context.selection.truncated).toBe(true);
    expect(context.selection.text.length).toBeGreaterThan(100);
    expect(context.selection.text.length).toBeLessThan(captured.selection.text.length);
    expect(JSON.stringify(captured)).toBe(original);
    expect(selected).toHaveBeenCalledTimes(calls);
  },
);
it('keeps a single source copy and exact PDF metadata when bounding a page envelope', async () => {
  const { serializeRequestContext } = await import('../../lib/agent-plugin/ui/request-context');
  const captured = {
    editor: { kind: 'pdf' as const, page: 2, pages: 7, selectionCharacters: 4 },
    selection: { text: 'same', truncated: false },
    content: { scope: 'pdf-page' as const, page: 2, pages: 7, text: '中'.repeat(8000), truncated: false },
  };
  const bounded = serializeRequestContext(captured, 'Summarize the current page');
  expect(bounded.context).toMatchObject({
    editor: captured.editor,
    content: { scope: 'pdf-page', page: 2, pages: 7, truncated: true },
  });
  expect(bounded.context).not.toHaveProperty('selection');
  expect(captured.content.text).toHaveLength(8000);
  expect(captured.content.truncated).toBe(false);
});

it('budgets external reference excerpts with provenance without mutating captured sources', async () => {
  const { serializeRequestContext } = await import('../../lib/agent-plugin/ui/request-context');
  const reference = {
    editor: null,
    selection: { text: '', truncated: false },
    references: [{ title: 'Notes', connector: 'local', text: '中'.repeat(10000) }],
  };
  const result = serializeRequestContext(reference, 'Summarize my notes');
  expect(result.context.references?.[0]).toMatchObject({ title: 'Notes', connector: 'local', truncated: true });
  expect(new TextEncoder().encode(JSON.stringify(result.serialized)).length).toBeLessThan(4096);
  expect(reference.references[0].text).toHaveLength(10000);
});
