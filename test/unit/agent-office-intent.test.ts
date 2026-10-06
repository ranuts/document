import { expect, it } from 'vitest';
import { parseDirectDocumentIntent } from '../../lib/agent-plugin/direct-intent';
it('requires explicit range, key column, order and header policy for sorting', () => {
  expect(parseDirectDocumentIntent('将 A1:C10 按 B 列升序排序，首行为表头')).toEqual({
    kind: 'sort_range',
    range: 'A1:C10',
    column: 'B',
    descending: false,
    header: true,
  });
  expect(parseDirectDocumentIntent('sort A1:C10 by B descending without header')).toEqual({
    kind: 'sort_range',
    range: 'A1:C10',
    column: 'B',
    descending: true,
    header: false,
  });
  expect(parseDirectDocumentIntent('把表格排序')).toEqual({ kind: 'clarify' });
});
it('routes sum read and explicit formula destinations without guessing a cell', () => {
  expect(parseDirectDocumentIntent('计算 B2:B10 的总和')).toEqual({ kind: 'sum_range', range: 'B2:B10' });
  expect(parseDirectDocumentIntent('将 B2:B10 的总和写入 B11')).toEqual({
    kind: 'sum_range',
    range: 'B2:B10',
    target: 'B11',
  });
});
it('routes bounded slide actions but never deletion or a quoted instruction', () => {
  expect(parseDirectDocumentIntent('新增一页幻灯片')).toEqual({ kind: 'slide', action: 'add' });
  expect(parseDirectDocumentIntent('复制当前幻灯片')).toEqual({ kind: 'slide', action: 'duplicate' });
  expect(parseDirectDocumentIntent('切换到第 3 页幻灯片')).toEqual({ kind: 'slide', action: 'navigate', page: 3 });
  expect(parseDirectDocumentIntent('解释如何复制当前幻灯片')).toBeNull();
});
