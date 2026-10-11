import { expect, it, vi } from 'vitest';
import { captureDocumentContext, resolveContextCommand } from '../../lib/agent-plugin/document-context';

const api = vi.hoisted(() => ({
  isDocumentLoadComplete: true,
  isLoadFullApi: true,
  isPdfEditor: vi.fn(() => true),
  AddFreeTextAnnot: vi.fn(),
  pluginMethod_GetSelectedText: vi.fn(() => ''),
}));
vi.mock('../../lib/agent-plugin/editor-bridge', () => ({ getEditorApi: () => api }));

it('does not advertise Word document operations for the PDF annotation editor', () => {
  expect(captureDocumentContext()).toBeNull();
  expect(api.pluginMethod_GetSelectedText).not.toHaveBeenCalled();
});

it('uses the editor discriminator rather than the presence of an annotation method', () => {
  api.isPdfEditor.mockReturnValue(false);
  expect(captureDocumentContext()).toEqual({ kind: 'word', selectionCharacters: 0 });
});

it('binds selected-range commands only to an explicit current spreadsheet range', () => {
  expect(resolveContextCommand('计算选区的总和', { kind: 'cell', range: 'B2:B10' })).toBe('计算 B2:B10 的总和');
  expect(resolveContextCommand('将选区的总和写入 B11', { kind: 'cell', range: 'B2:B10' })).toBe(
    '将 B2:B10 的总和写入 B11',
  );
  expect(resolveContextCommand('计算选区的总和', { kind: 'word' })).toBe('计算选区的总和');
  expect(resolveContextCommand('把这列求和', { kind: 'cell', range: 'B2' })).toBe('把这列求和');
});
