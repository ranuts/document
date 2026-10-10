import { expect, it, vi } from 'vitest';
import { beginWordPasteHistory } from '../../lib/agent-plugin/word-paste-history';
import type { RedoHistory } from '../../lib/agent-plugin/native-redo';
function fixture(withRedo = true) {
  const first = { Items: [{ before: true }] };
  const redo = { Items: [{ redo: true }] };
  const selection = { selected: 'Alpha' };
  const history: RedoHistory = {
    Index: 0,
    Points: withRedo ? [first, redo] : [first],
    StoredData: [],
    SavedIndex: 0,
    LastState: selection,
    SaveRedoPoints: () => history.StoredData!.push(history.Points.slice(history.Index + 1)),
    PopRedoPoints: () => history.Points.push(...history.StoredData!.pop()!),
  };
  let current = true;
  const undo = vi.fn(() => {
    history.Index--;
  });
  const transaction = beginWordPasteHistory(history, () => current, undo);
  const paste = () => {
    history.Points.splice(1, history.Points.length, { Items: [{ deletion: true }] });
    history.Index = 1;
    history.SavedIndex = null;
    history.LastState = {};
    transaction.seal();
  };
  return {
    history,
    first,
    redo,
    selection,
    transaction,
    undo,
    paste,
    expire: () => {
      current = false;
    },
  };
}
it.each([true, false])('removes the owned partial paste and restores history metadata (redo=%s)', (redo) => {
  const f = fixture(redo);
  f.paste();
  f.transaction.rollback();
  f.transaction.rollback();
  expect(f.undo).toHaveBeenCalledOnce();
  expect(f.history.Index).toBe(0);
  expect(f.history.Points).toEqual(redo ? [f.first, f.redo] : [f.first]);
  expect(f.history.Points[0]).toBe(f.first);
  if (redo) expect(f.history.Points[1]).toBe(f.redo);
  expect(f.history.LastState).toBe(f.selection);
  expect(f.history.SavedIndex).toBe(0);
  expect(f.history.StoredData).toEqual([]);
});
it('retains a successful write and discards only the original redo backup', () => {
  const f = fixture();
  f.paste();
  const point = f.history.Points[1];
  f.transaction.commit();
  expect(f.history.Points[1]).toBe(point);
  expect(f.history.Index).toBe(1);
  expect(f.history.StoredData).toEqual([]);
  expect(f.undo).not.toHaveBeenCalled();
});
it.each(['added-point', 'added-item', 'replaced-item', 'changed-prefix', 'expired'])(
  'never undoes a foreign mutation: %s',
  (kind) => {
    const f = fixture();
    f.paste();
    if (kind === 'added-point') {
      f.history.Points.push({ Items: [] });
      f.history.Index++;
    }
    if (kind === 'added-item') f.history.Points[1].Items.push({ foreign: true });
    if (kind === 'replaced-item') f.history.Points[1].Items[0] = { foreign: true };
    if (kind === 'changed-prefix') f.history.Points[0].Items[0] = { foreign: true };
    if (kind === 'expired') f.expire();
    expect(() => f.transaction.rollback()).toThrow();
    expect(f.undo).not.toHaveBeenCalled();
  },
);
it('refuses to remove history if native Undo does not return to the original cursor', () => {
  const f = fixture();
  f.paste();
  f.undo.mockImplementation(() => {});
  expect(() => f.transaction.rollback()).toThrow();
  expect(f.history.Points).toHaveLength(2);
  expect(f.history.StoredData).toHaveLength(1);
});
it('releases an unused backup when paste is rejected before any history mutation', () => {
  const f = fixture();
  f.transaction.rollback();
  expect(f.undo).not.toHaveBeenCalled();
  expect(f.history.Points[1]).toBe(f.redo);
  expect(f.history.StoredData).toEqual([]);
});

it('restores native Additional metadata without an existing redo branch', () => {
  const f = fixture(false);
  const previous = { selected: 'original' };
  // Set up a fresh transaction after assigning native point metadata.
  Object.assign(f.first, { Additional: previous });
  const transaction = beginWordPasteHistory(f.history, () => true, f.undo);
  f.paste();
  Object.assign(f.first, { Additional: {} });
  transaction.seal();
  transaction.rollback();
  expect((f.first as { Additional?: unknown }).Additional).toBe(previous);
});
it('removes an owned empty point without calling Undo on an earlier real edit', () => {
  const f = fixture(false);
  Object.assign(f.history, {
    Remove_LastPoint: vi.fn(() => {
      f.history.Points.pop();
      f.history.Index--;
    }),
  });
  const transaction = beginWordPasteHistory(f.history, () => true, f.undo);
  f.history.Points.push({ Items: [] });
  f.history.Index++;
  transaction.seal();
  transaction.rollback();
  expect(f.undo).not.toHaveBeenCalled();
  expect(f.history.Points).toEqual([f.first]);
  expect(f.history.Index).toBe(0);
});
