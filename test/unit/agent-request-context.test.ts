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
