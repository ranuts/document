import { expect, it, vi } from 'vitest';
import { captureCompletedPaste } from '../../lib/agent-plugin/completed-paste';
function fixture() {
  const history = { Index: 1, Points: [{ Items: [{}] }, { Items: [{}], Description: 73 }] };
  let current = true;
  let listener = () => {};
  const remove = vi.fn();
  const undo = vi.fn(() => {
    listener();
    history.Index--;
  });
  const receipt = captureCompletedPaste(history, {
    current: () => current,
    allowedDescription: 73,
    undo,
    observe: (callback) => {
      listener = callback;
      return remove;
    },
  });
  return {
    history,
    receipt: receipt!,
    undo,
    remove,
    event: () => listener(),
    expire: () => {
      current = false;
    },
  };
}
it('consumes exactly one owned completed paste and leaves its redo point', () => {
  const f = fixture();
  const point = f.history.Points[1];
  expect(f.receipt.available()).toBe(true);
  expect(f.receipt.undo()).toBe(true);
  expect(f.history.Index).toBe(0);
  expect(f.history.Points[1]).toBe(point);
  expect(f.receipt.undo()).toBe(false);
  expect(f.undo).toHaveBeenCalledOnce();
  expect(f.remove).toHaveBeenCalledOnce();
});
it.each(['append', 'replace', 'prefix', 'item', 'description', 'event', 'expire', 'dispose'])(
  'refuses foreign state: %s',
  (kind) => {
    const f = fixture();
    if (kind === 'append') {
      f.history.Points.push({ Items: [{}] });
      f.history.Index++;
    }
    if (kind === 'replace') f.history.Points[1] = { ...f.history.Points[1] };
    if (kind === 'prefix') f.history.Points[0].Items[0] = {};
    if (kind === 'item') f.history.Points[1].Items.push({});
    if (kind === 'description') f.history.Points[1].Description = 4;
    if (kind === 'event') f.event();
    if (kind === 'expire') f.expire();
    if (kind === 'dispose') f.receipt.dispose();
    expect(f.receipt.undo()).toBe(false);
    expect(f.undo).not.toHaveBeenCalled();
  },
);
it('permanently invalidates an Undo/Redo round trip even when the tail matches again', () => {
  const f = fixture();
  f.event();
  expect(f.receipt.available()).toBe(false);
  expect(f.receipt.undo()).toBe(false);
});
it('denies unknown and empty point descriptions', () => {
  const f = fixture();
  expect(
    captureCompletedPaste(f.history, {
      current: () => true,
      allowedDescription: 99,
      undo: f.undo,
      observe: () => () => {},
    }),
  ).toBeUndefined();
});
it('checks the post-Undo state and never retries a native failure', () => {
  const f = fixture();
  const receipt = captureCompletedPaste(f.history, {
    current: () => true,
    allowedDescription: 73,
    undo: () => {},
    observe: () => () => {},
  })!;
  expect(() => receipt.undo()).toThrow('agentUndoUnverified');
  expect(receipt.undo()).toBe(false);
});
it('drops the native guard on disposal and never consults a replaced document again', () => {
  const history = { Index: 0, Points: [{ Items: [{}], Description: 73 }] };
  const current = vi.fn(() => true),
    remove = vi.fn();
  const receipt = captureCompletedPaste(history, {
    current,
    allowedDescription: 73,
    undo: vi.fn(),
    observe: () => remove,
  })!;
  receipt.dispose();
  current.mockClear();
  expect(receipt.available()).toBe(false);
  expect(receipt.undo()).toBe(false);
  expect(current).not.toHaveBeenCalled();
  expect(remove).toHaveBeenCalledOnce();
});
