import { expect, it, vi } from 'vitest';
import { withBlockingEditorAction } from '../../lib/agent-plugin/editor-action';

const codes = { BlockInteraction: 1, ApplyChanges: 9 };
function editor() {
  let busy = false;
  return {
    isLongAction: () => busy,
    sync_StartAction: vi.fn(() => {
      busy = true;
    }),
    sync_EndAction: vi.fn(() => {
      busy = false;
    }),
  };
}
it('keeps the native action open until asynchronous work completes', async () => {
  const api = editor();
  let complete!: (value: number) => void;
  const work = new Promise<number>((resolve) => {
    complete = resolve;
  });
  const result = withBlockingEditorAction(api, codes, () => work);
  expect(api.isLongAction()).toBe(true);
  expect(api.sync_EndAction).not.toHaveBeenCalled();
  complete(42);
  expect(await result).toBe(42);
  expect(api.sync_StartAction).toHaveBeenCalledWith(1, 9);
  expect(api.sync_EndAction).toHaveBeenCalledExactlyOnceWith(1, 9);
  expect(api.isLongAction()).toBe(false);
});
it('releases its own native action when work fails', async () => {
  const api = editor(),
    failure = new Error('No free text area');
  await expect(
    withBlockingEditorAction(api, codes, async () => {
      throw failure;
    }),
  ).rejects.toBe(failure);
  expect(api.sync_EndAction).toHaveBeenCalledExactlyOnceWith(1, 9);
  expect(api.isLongAction()).toBe(false);
});
it('rejects a concurrent action without ending the first action', async () => {
  const api = editor();
  let complete!: () => void;
  const work = new Promise<void>((resolve) => {
    complete = resolve;
  });
  const first = withBlockingEditorAction(api, codes, () => work);
  const second = vi.fn();
  await expect(withBlockingEditorAction(api, codes, second)).rejects.toThrow('Editor is busy');
  expect(second).not.toHaveBeenCalled();
  expect(api.sync_EndAction).not.toHaveBeenCalled();
  complete();
  await first;
  expect(api.sync_EndAction).toHaveBeenCalledTimes(1);
});
it('rejects missing native capabilities or invalid runtime action codes before work', async () => {
  const work = vi.fn(),
    api = editor();
  await expect(withBlockingEditorAction({}, codes, work)).rejects.toThrow();
  await expect(withBlockingEditorAction(api, { ...codes, ApplyChanges: NaN }, work)).rejects.toThrow();
  expect(work).not.toHaveBeenCalled();
  expect(api.sync_StartAction).not.toHaveBeenCalled();
});
it('releases the captured action even if runtime code objects change during work', async () => {
  const api = editor(),
    runtimeCodes = { ...codes };
  await withBlockingEditorAction(api, runtimeCodes, async () => {
    runtimeCodes.ApplyChanges = 11;
  });
  expect(api.sync_EndAction).toHaveBeenCalledExactlyOnceWith(1, 9);
});

it.each([false, true])('balances an explicitly released action when later work fails=%s', async (fails) => {
  const api = editor();
  const result = withBlockingEditorAction(api, codes, async (release) => {
    release();
    release();
    expect(api.isLongAction()).toBe(false);
    if (fails) throw new Error('After cleanup');
    return 42;
  });
  if (fails) await expect(result).rejects.toThrow('After cleanup');
  else await expect(result).resolves.toBe(42);
  expect(api.sync_EndAction).toHaveBeenCalledExactlyOnceWith(1, 9);
});
