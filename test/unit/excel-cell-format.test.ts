import { expect, it, vi } from 'vitest';
import { captureExcelCellFormat } from '../../lib/agent-plugin/excel-cell-format';
it('restores the captured cell even after the active destination changes', () => {
  const formats = { original: '0.00', other: 'General' };
  let active: 'original' | 'other' = 'original';
  const originalCell = {
    getNumFormat: () => ({ sFormat: formats.original }),
    setNumFormat: (value: string) => {
      formats.original = value;
    },
  };
  const scope = captureExcelCellFormat(originalCell);
  scope.setFormat('@');
  active = 'other';
  scope.setFormat(scope.originalFormat);
  expect(formats[active]).toBe('General');
  expect(formats.original).toBe('0.00');
});
it('binds the original native setter and its receiver', () => {
  const cell = {
    name: 'captured',
    getNumFormat: () => ({ sFormat: 'General' }),
    setNumFormat: vi.fn(function (this: { name: string }, _format: string) {
      expect(this.name).toBe('captured');
    }),
  };
  const setter = cell.setNumFormat;
  const scope = captureExcelCellFormat(cell);
  cell.setNumFormat = vi.fn();
  scope.setFormat('@');
  expect(setter).toHaveBeenCalledWith('@');
  expect(cell.setNumFormat).not.toHaveBeenCalled();
});
it('rejects unavailable native format information before mutation', () => {
  const setter = vi.fn();
  expect(() => captureExcelCellFormat({ getNumFormat: () => ({ sFormat: '' }), setNumFormat: setter })).toThrow();
  expect(setter).not.toHaveBeenCalled();
});
