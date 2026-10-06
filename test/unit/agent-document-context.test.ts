import { expect, it } from 'vitest';
import { resolveContextCommand } from '../../lib/agent-plugin/document-context';
it('binds selected-range commands only to an explicit current spreadsheet range', () => {
  expect(resolveContextCommand('计算选区的总和', { kind: 'cell', range: 'B2:B10' })).toBe('计算 B2:B10 的总和');
  expect(resolveContextCommand('将选区的总和写入 B11', { kind: 'cell', range: 'B2:B10' })).toBe(
    '将 B2:B10 的总和写入 B11',
  );
  expect(resolveContextCommand('计算选区的总和', { kind: 'word' })).toBe('计算选区的总和');
  expect(resolveContextCommand('把这列求和', { kind: 'cell', range: 'B2' })).toBe('把这列求和');
});
