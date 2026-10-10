import { expect, it, vi } from 'vitest';
import { assertExcelTextWritable } from '../../lib/agent-plugin/excel-text-preflight';
function fixture() {
  return {
    api: { isDocumentLoadComplete: true, isLoadFullApi: true, isViewMode: false, canEdit: () => true },
    model: { getSheetProtection: () => false as unknown, isUserProtectedRangesIntersection: vi.fn(() => false) },
    cell: { hasMerged: () => null as unknown },
    range: { c1: 1, c2: 1, r1: 1, r2: 1 },
  };
}
it('checks the captured native range before allowing a normal cell', () => {
  const f = fixture();
  expect(() => assertExcelTextWritable(f.api, f.model, f.cell, f.range, false)).not.toThrow();
  expect(f.model.isUserProtectedRangesIntersection).toHaveBeenCalledWith(f.range);
});
it.each(['shell', 'view', 'permission'] as const)('rejects %s readonly state', (mode) => {
  const f = fixture();
  if (mode === 'view') f.api.isViewMode = true;
  if (mode === 'permission') f.api.canEdit = () => false;
  expect(() => assertExcelTextWritable(f.api, f.model, f.cell, f.range, mode === 'shell')).toThrow(
    'Document is read-only',
  );
});
it.each(['sheet', 'range'] as const)('rejects native %s protection', (mode) => {
  const f = fixture();
  if (mode === 'sheet') f.model.getSheetProtection = () => ({ sheet: true });
  else f.model.isUserProtectedRangesIntersection.mockReturnValue(true);
  expect(() => assertExcelTextWritable(f.api, f.model, f.cell, f.range, false)).toThrow('officeProtectedRange');
});
it('rejects a merged target independently of the selected cell', () => {
  const f = fixture();
  f.cell.hasMerged = () => ({ c1: 1, c2: 2, r1: 1, r2: 1 });
  expect(() => assertExcelTextWritable(f.api, f.model, f.cell, f.range, false)).toThrow('officeMergedTarget');
});
it('rejects loading editors', () => {
  const f = fixture();
  f.api.isLoadFullApi = false;
  expect(() => assertExcelTextWritable(f.api, f.model, f.cell, f.range, false)).toThrow('Editor is still loading');
});
