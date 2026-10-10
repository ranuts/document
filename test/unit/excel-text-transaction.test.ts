import { expect, it, vi } from 'vitest';
import { withExcelTextFormat } from '../../lib/agent-plugin/excel-text-transaction';
function fixture() {
  const events: string[] = [];
  let format = '0.00';
  const scope = {
    originalFormat: format,
    isCurrent: () => true,
    createPoint: vi.fn(() => {
      events.push('point');
    }),
    startTransaction: vi.fn(() => {
      events.push('start');
    }),
    endTransaction: vi.fn(() => {
      events.push('end');
    }),
    setFormat: vi.fn((value: string) => {
      format = value;
      events.push(value);
    }),
  };
  return { scope, events, format: () => format };
}
it('keeps text format until native completion then restores format and closes history', async () => {
  const f = fixture();
  let finish!: () => void;
  const operation = withExcelTextFormat(
    f.scope,
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  expect(f.events).toEqual(['point', 'start', '@']);
  finish();
  await operation;
  expect(f.events).toEqual(['point', 'start', '@', '0.00', 'end']);
});
it.each(['reject', 'throw'] as const)('cleans up when native paste %s', async (mode) => {
  const f = fixture();
  const error = new Error('paste failed');
  await expect(
    withExcelTextFormat(f.scope, () => {
      if (mode === 'throw') throw error;
      return Promise.reject(error);
    }),
  ).rejects.toBe(error);
  expect(f.format()).toBe('0.00');
  expect(f.scope.endTransaction).toHaveBeenCalledOnce();
});
it('closes history even if restoring the format fails', async () => {
  const f = fixture();
  f.scope.setFormat.mockImplementation((value) => {
    if (value === '0.00') throw Error('restore failed');
  });
  await expect(withExcelTextFormat(f.scope, async () => {})).rejects.toThrow('restore failed');
  expect(f.scope.endTransaction).toHaveBeenCalledOnce();
});
it('restores and closes history when setting text format fails', async () => {
  const f = fixture();
  f.scope.setFormat.mockImplementationOnce(() => {
    throw Error('format failed');
  });
  const paste = vi.fn();
  await expect(withExcelTextFormat(f.scope, paste)).rejects.toThrow('format failed');
  expect(paste).not.toHaveBeenCalled();
  expect(f.scope.setFormat).toHaveBeenLastCalledWith('0.00');
  expect(f.scope.endTransaction).toHaveBeenCalledOnce();
});
it('rejects an expired target before changing history or formatting', async () => {
  const f = fixture();
  f.scope.isCurrent = () => false;
  const paste = vi.fn();
  await expect(withExcelTextFormat(f.scope, paste)).rejects.toThrow(/expired/);
  expect(f.events).toEqual([]);
  expect(paste).not.toHaveBeenCalled();
});
it('does not start history if a point cannot be created', async () => {
  const f = fixture();
  f.scope.createPoint.mockImplementation(() => {
    throw Error('history failed');
  });
  await expect(withExcelTextFormat(f.scope, async () => {})).rejects.toThrow('history failed');
  expect(f.scope.startTransaction).not.toHaveBeenCalled();
  expect(f.scope.setFormat).not.toHaveBeenCalled();
});

it('restores formatting when owned paste cancellation settles', async () => {
  const f = fixture();
  const aborted = new DOMException('Stopped', 'AbortError');
  await expect(withExcelTextFormat(f.scope, () => Promise.reject(aborted))).rejects.toBe(aborted);
  expect(f.format()).toBe('0.00');
  expect(f.scope.endTransaction).toHaveBeenCalledOnce();
});
it('rejects missing original formatting before history changes', async () => {
  const f = fixture();
  f.scope.originalFormat = '';
  await expect(withExcelTextFormat(f.scope, async () => {})).rejects.toThrow(/format/);
  expect(f.events).toEqual([]);
});
it('does not paste if the scope expires while entering text formatting', async () => {
  const f = fixture();
  let current = true;
  f.scope.isCurrent = () => current;
  f.scope.setFormat.mockImplementationOnce(() => {
    current = false;
  });
  const paste = vi.fn();
  await expect(withExcelTextFormat(f.scope, paste)).rejects.toThrow(/expired/);
  expect(paste).not.toHaveBeenCalled();
  expect(f.scope.setFormat).toHaveBeenLastCalledWith('0.00');
  expect(f.scope.endTransaction).toHaveBeenCalledOnce();
});
