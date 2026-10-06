import { expect, it, vi } from 'vitest';
import { preserveNativeRedo, type RedoHistory } from '../../lib/agent-plugin/native-redo';
function fixture() {
  const current = { Items: ['current'], Additional: { original: true } };
  const redo = { Items: ['redo'] };
  const history: RedoHistory = {
    Index: 0,
    Points: [current, redo],
    StoredData: [],
    SavedIndex: 1,
    UserSavedIndex: 1,
    ForceSave: false,
    LastState: { selected: 'original' },
    SaveRedoPoints: vi.fn(() => history.StoredData!.push(history.Points.slice(history.Index + 1))),
    PopRedoPoints: vi.fn(() => {
      const points = history.StoredData!.pop()!;
      history.Points.length = history.Index + 1;
      history.Points.push(...points);
    }),
  };
  return { history, current, redo };
}
it('restores the exact native redo points and saved/selection metadata after cancellation', () => {
  const f = fixture(),
    lastState = f.history.LastState;
  const branch = preserveNativeRedo(f.history, () => true);
  f.history.Points.splice(1);
  f.history.SavedIndex = 0;
  f.history.UserSavedIndex = 0;
  f.history.ForceSave = true;
  f.history.LastState = {};
  f.current.Additional = { original: false };
  branch.restore();
  branch.restore();
  branch.discard();
  expect(f.history.Points).toEqual([f.current, f.redo]);
  expect(f.history.Points[1]).toBe(f.redo);
  expect(f.history.SavedIndex).toBe(1);
  expect(f.history.UserSavedIndex).toBe(1);
  expect(f.history.ForceSave).toBe(false);
  expect(f.history.LastState).toBe(lastState);
  expect(f.current.Additional).toEqual({ original: true });
  expect(f.history.PopRedoPoints).toHaveBeenCalledOnce();
  expect(f.history.StoredData).toEqual([]);
});
it('discards only its backup after a successful new edit, retaining normal redo invalidation', () => {
  const f = fixture(),
    branch = preserveNativeRedo(f.history, () => true),
    added = { Items: ['new'] };
  f.history.Points[1] = added;
  f.history.Index = 1;
  f.history.SavedIndex = 0;
  f.history.ForceSave = true;
  branch.discard();
  branch.discard();
  expect(f.history.Points).toEqual([f.current, added]);
  expect(f.history.SavedIndex).toBe(0);
  expect(f.history.ForceSave).toBe(true);
  expect(f.history.PopRedoPoints).not.toHaveBeenCalled();
  expect(f.history.StoredData).toEqual([]);
});
it('does not require backup capabilities at the history tip', () => {
  const history = { Index: 0, Points: [{ Items: [] }] };
  const branch = preserveNativeRedo(history, () => true);
  branch.restore();
  branch.discard();
  expect(history.Points).toHaveLength(1);
});
it('rejects unavailable native backup support before truncating redo', () => {
  const f = fixture();
  delete f.history.SaveRedoPoints;
  expect(() => preserveNativeRedo(f.history, () => true)).toThrow('history API is unavailable');
  expect(f.history.Points[1]).toBe(f.redo);
});
it('does not restore or remove backups belonging to an expired editor', () => {
  const f = fixture();
  let current = true;
  const branch = preserveNativeRedo(f.history, () => current);
  f.history.Points.splice(1);
  current = false;
  expect(() => branch.restore()).toThrow('expired');
  branch.discard();
  expect(f.history.PopRedoPoints).not.toHaveBeenCalled();
  expect(f.history.StoredData).toHaveLength(1);
});
it('does not consume a foreign nested backup', () => {
  const f = fixture(),
    branch = preserveNativeRedo(f.history, () => true),
    foreign = [{ Items: ['foreign'] }];
  f.history.Points.splice(1);
  f.history.StoredData!.push(foreign);
  expect(() => branch.restore()).toThrow('could not be verified');
  branch.discard();
  expect(f.history.StoredData!.at(-1)).toBe(foreign);
  expect(f.history.PopRedoPoints).not.toHaveBeenCalled();
});
it('requires native cancellation to restore the original history cursor before restoring redo', () => {
  const f = fixture(),
    branch = preserveNativeRedo(f.history, () => true);
  f.history.Index = 1;
  expect(() => branch.restore()).toThrow('could not be verified');
  expect(f.history.PopRedoPoints).not.toHaveBeenCalled();
});
it('detects a native save that did not create the expected backup', () => {
  const f = fixture();
  f.history.SaveRedoPoints = vi.fn();
  expect(() => preserveNativeRedo(f.history, () => true)).toThrow('could not be verified');
  expect(f.history.Points[1]).toBe(f.redo);
});
it('does not restore redo over a changed history prefix', () => {
  const f = fixture(),
    branch = preserveNativeRedo(f.history, () => true);
  f.history.Points.splice(1);
  f.history.Points[0] = { Items: ['foreign'] };
  expect(() => branch.restore()).toThrow('could not be verified');
  expect(f.history.PopRedoPoints).not.toHaveBeenCalled();
});

it('releases an intact redo backup and restores metadata when group opening fails before truncation', () => {
  const f = fixture(),
    branch = preserveNativeRedo(f.history, () => true);
  f.history.SavedIndex = 0;
  f.history.ForceSave = true;
  f.current.Additional = { original: false };
  branch.restore();
  expect(f.history.Points[1]).toBe(f.redo);
  expect(f.history.StoredData).toEqual([]);
  expect(f.history.PopRedoPoints).not.toHaveBeenCalled();
  expect(f.history.SavedIndex).toBe(1);
  expect(f.history.ForceSave).toBe(false);
  expect(f.current.Additional).toEqual({ original: true });
});

it('does not restore a backup whose saved redo point references were replaced', () => {
  const f = fixture(),
    branch = preserveNativeRedo(f.history, () => true);
  f.history.Points.splice(1);
  f.history.StoredData![0][0] = { Items: ['foreign'] };
  expect(() => branch.restore()).toThrow('could not be verified');
  expect(f.history.PopRedoPoints).not.toHaveBeenCalled();
  expect(f.history.Points).toEqual([f.current]);
});
