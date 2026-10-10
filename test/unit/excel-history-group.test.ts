import { expect, it, vi } from 'vitest';
import { withExcelHistoryGroup } from '../../lib/agent-plugin/excel-history-group';
const redo = vi.hoisted(() => ({ restore: vi.fn(), discard: vi.fn() }));
vi.mock('../../lib/agent-plugin/native-redo', () => ({ preserveNativeRedo: () => redo }));
function fixture() {
  const events: string[] = [];
  const points = [{ Items: [1], Description: 1 }];
  const history = {
    Index: 0,
    Points: points,
    _getLongPointIndex: () => points.findIndex((p) => p.Description === 700),
    startGroupPoints: vi.fn(() => {
      points.push({ Items: [], Description: 700 });
      history.Index++;
      events.push('start');
    }),
    cancelGroupPoints: vi.fn(() => {
      history.Index = 0;
      events.push('cancel');
    }),
    endGroupPoints: vi.fn(() => {
      points.length = history.Index + 1;
      if (points[1]) points[1].Description = 701;
      events.push('end');
    }),
  };
  redo.restore.mockReset().mockImplementation(() => {
    events.push('restore');
  });
  redo.discard.mockReset().mockImplementation(() => {
    events.push('discard');
  });
  return { history, events };
}
it('ends a successful group and discards the old redo backup', async () => {
  const f = fixture();
  await expect(
    withExcelHistoryGroup(
      f.history,
      () => true,
      701,
      async (owns) => {
        expect(owns()).toBe(true);
        return 'done';
      },
    ),
  ).resolves.toBe('done');
  expect(f.events).toEqual(['start', 'end', 'discard']);
});
it('cancels and ends the Excel group before restoring old redo', async () => {
  const f = fixture();
  await expect(
    withExcelHistoryGroup(
      f.history,
      () => true,
      701,
      async () => {
        throw Error('Stopped');
      },
    ),
  ).rejects.toThrow('Stopped');
  expect(f.events).toEqual(['start', 'cancel', 'end', 'restore']);
});
it('preserves foreign edits after ownership loss and neutralizes only its own group marker', async () => {
  const f = fixture();
  let current = true;
  await expect(
    withExcelHistoryGroup(
      f.history,
      () => current,
      701,
      async () => {
        current = false;
        throw Error('changed');
      },
    ),
  ).rejects.toThrow('changed');
  expect(f.history.cancelGroupPoints).not.toHaveBeenCalled();
  expect(f.history.endGroupPoints).not.toHaveBeenCalled();
  expect(f.history.Points[1].Description).toBe(701);
});
it('restores redo when group opening throws before mutation', async () => {
  const f = fixture();
  f.history.startGroupPoints.mockImplementation(() => {
    throw Error('opening failed');
  });
  await expect(
    withExcelHistoryGroup(
      f.history,
      () => true,
      701,
      async () => {},
    ),
  ).rejects.toThrow('opening failed');
  expect(f.history.cancelGroupPoints).not.toHaveBeenCalled();
  expect(redo.restore).toHaveBeenCalledOnce();
});

it('rolls back an empty group if opening throws just after creating its marker', async () => {
  const f = fixture();
  const open = f.history.startGroupPoints.getMockImplementation()!;
  f.history.startGroupPoints.mockImplementation(() => {
    open();
    throw Error('opening failed');
  });
  await expect(
    withExcelHistoryGroup(
      f.history,
      () => true,
      701,
      async () => {},
    ),
  ).rejects.toThrow('opening failed');
  expect(f.events).toEqual(['start', 'cancel', 'end', 'restore']);
});
it('does not roll back or merge a history whose original prefix was replaced', async () => {
  const f = fixture();
  const foreign = { Items: [9], Description: 9 };
  await expect(
    withExcelHistoryGroup(
      f.history,
      () => true,
      701,
      async () => {
        f.history.Points[0] = foreign;
      },
    ),
  ).rejects.toThrow(/expired/);
  expect(f.history.cancelGroupPoints).not.toHaveBeenCalled();
  expect(f.history.endGroupPoints).not.toHaveBeenCalled();
  expect(f.history.Points[0]).toBe(foreign);
  expect(f.history.Points[1].Description).toBe(701);
});
