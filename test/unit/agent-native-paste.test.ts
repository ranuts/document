import { afterEach, expect, it, vi } from 'vitest';
import { pasteSlideText } from '../../lib/agent-plugin/native-paste';
afterEach(() => vi.useRealTimers());
function fixture(delay = 0) {
  const insert = vi.fn();
  const api = {
    pre_Paste: (_fonts: unknown, _images: unknown, callback: () => void) => {
      if (delay) setTimeout(callback, delay);
      else callback();
    },
    asc_PasteData: (
      _format: number,
      _text: string,
      _a: undefined,
      _b: undefined,
      _c: undefined,
      done: (ok?: boolean) => void,
    ) => {
      api.pre_Paste([], {}, () => {
        insert();
        done(true);
      });
    },
  };
  const end = vi.fn();
  return { api, insert, end };
}
it('awaits native completion and restores the preparation method immediately', async () => {
  vi.useFakeTimers();
  const f = fixture(100),
    original = f.api.pre_Paste;
  const result = pasteSlideText(f.api, 1, '文字', { isCurrent: () => true, endPaste: f.end, timeoutMs: 1000 });
  expect(f.api.pre_Paste).toBe(original);
  expect(f.insert).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(100);
  await result;
  expect(f.insert).toHaveBeenCalledOnce();
  expect(f.end).not.toHaveBeenCalled();
});
it('times out and suppresses the pending insertion without a late write', async () => {
  vi.useFakeTimers();
  const f = fixture(200),
    original = f.api.pre_Paste;
  const result = expect(
    pasteSlideText(f.api, 1, '文字', { isCurrent: () => true, endPaste: f.end, timeoutMs: 50 }),
  ).rejects.toThrow('timed out');
  await vi.advanceTimersByTimeAsync(50);
  await result;
  await vi.advanceTimersByTimeAsync(200);
  expect(f.insert).not.toHaveBeenCalled();
  expect(f.end).toHaveBeenCalledOnce();
  expect(f.api.pre_Paste).toBe(original);
});
it('does not insert or clean foreign paste state when target ownership changes', async () => {
  vi.useFakeTimers();
  const f = fixture(100);
  let current = true;
  const result = expect(
    pasteSlideText(f.api, 1, '文字', { isCurrent: () => current, endPaste: f.end, timeoutMs: 1000 }),
  ).rejects.toThrow('expired');
  current = false;
  await vi.advanceTimersByTimeAsync(100);
  await result;
  expect(f.insert).not.toHaveBeenCalled();
  expect(f.end).not.toHaveBeenCalled();
});
it('rejects native refusal without waiting for a callback that will not run', async () => {
  const f = fixture();
  f.api.asc_PasteData = () => {};
  await expect(pasteSlideText(f.api, 1, '文字', { isCurrent: () => true, endPaste: f.end })).rejects.toThrow(
    'rejected',
  );
  expect(f.end).not.toHaveBeenCalled();
});

it('rejects an inaccessible initial target as an expired target without throwing synchronously', async () => {
  const f = fixture();
  let result: Promise<void> | undefined;
  expect(() => {
    result = pasteSlideText(f.api, 1, '文字', {
      isCurrent: () => {
        throw new Error('Frame removed');
      },
      endPaste: f.end,
    });
  }).not.toThrow();
  await expect(result).rejects.toThrow('expired');
  expect(f.insert).not.toHaveBeenCalled();
});
it('handles a throwing target lookup inside the deferred preparation callback', async () => {
  vi.useFakeTimers();
  const f = fixture();
  let resume!: () => void,
    accessible = true;
  f.api.pre_Paste = (_fonts, _images, callback) => {
    resume = callback;
  };
  const result = pasteSlideText(f.api, 1, '文字', {
    isCurrent: () => {
      if (!accessible) throw new Error('Frame removed');
      return true;
    },
    endPaste: f.end,
    timeoutMs: 1000,
  });
  result.catch(() => {});
  accessible = false;
  expect(() => resume()).not.toThrow();
  await expect(result).rejects.toThrow('expired');
  expect(f.insert).not.toHaveBeenCalled();
  expect(f.end).not.toHaveBeenCalled();
});

it('aborts deferred native paste immediately and suppresses late insertion', async () => {
  vi.useFakeTimers();
  const f = fixture(200),
    abort = new AbortController();
  const promise = pasteSlideText(f.api, 1, '文字', { isCurrent: () => true, endPaste: f.end, signal: abort.signal });
  const outcome = promise.catch((error) => error);
  abort.abort();
  await vi.advanceTimersByTimeAsync(200);
  expect(await outcome).toMatchObject({ name: 'AbortError' });
  expect(f.insert).not.toHaveBeenCalled();
  expect(f.end).toHaveBeenCalledOnce();
});
it('does not begin native paste when already aborted', async () => {
  const f = fixture(),
    abort = new AbortController();
  abort.abort();
  await expect(
    pasteSlideText(f.api, 1, '文字', { isCurrent: () => true, endPaste: f.end, signal: abort.signal }),
  ).rejects.toMatchObject({ name: 'AbortError' });
  expect(f.insert).not.toHaveBeenCalled();
  expect(f.end).not.toHaveBeenCalled();
});
