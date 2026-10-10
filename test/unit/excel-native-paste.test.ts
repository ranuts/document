import { expect, it, vi } from 'vitest';
import { pasteExcelText } from '../../lib/agent-plugin/excel-native-paste';
function fixture() {
  let release!: () => void;
  const insert = vi.fn();
  const fonts = vi.fn((_fonts: unknown, callback: () => void) => {
    release = callback;
  });
  const view = { _loadFonts: fonts };
  const endPaste = vi.fn();
  const api = {
    asc_PasteData: vi.fn(
      (
        _format: number,
        _text: string,
        _a: undefined,
        _b: undefined,
        _c: undefined,
        complete: (ok?: boolean) => void,
      ) => {
        view._loadFonts([], () => {
          insert();
          complete(true);
        });
      },
    ),
  };
  return { api, view, insert, fonts, endPaste, release: () => release(), options: { isCurrent: () => true, endPaste } };
}
it('settles after native completion and restores guarded methods', async () => {
  const f = fixture();
  const pending = pasteExcelText(f.api, f.view, 4, '00123', f.options);
  f.release();
  await pending;
  expect(f.insert).toHaveBeenCalledOnce();
  expect(f.view._loadFonts).toBe(f.fonts);
});
it('suppresses late insertion after Stop and ends owned paste state', async () => {
  const f = fixture(),
    abort = new AbortController();
  const pending = pasteExcelText(f.api, f.view, 4, '00123', { ...f.options, signal: abort.signal });
  abort.abort();
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  f.release();
  expect(f.insert).not.toHaveBeenCalled();
  expect(f.endPaste).toHaveBeenCalledOnce();
  expect(f.view._loadFonts).toBe(f.fonts);
});
it('suppresses late insertion after timeout', async () => {
  vi.useFakeTimers();
  try {
    const f = fixture();
    const outcome = pasteExcelText(f.api, f.view, 4, '00123', { ...f.options, timeoutMs: 20 }).catch((error) => error);
    await vi.advanceTimersByTimeAsync(20);
    expect(await outcome).toMatchObject({ message: 'Native paste timed out' });
    f.release();
    expect(f.insert).not.toHaveBeenCalled();
    expect(f.endPaste).toHaveBeenCalledOnce();
  } finally {
    vi.useRealTimers();
  }
});
it('rejects a failed native completion and restores methods', async () => {
  const f = fixture();
  f.api.asc_PasteData.mockImplementation((_format, _text, _a, _b, _c, complete) => complete(false));
  await expect(pasteExcelText(f.api, f.view, 4, '00123', f.options)).rejects.toThrow('Native paste was rejected');
  expect(f.view._loadFonts).toBe(f.fonts);
});
it('does not start a pre-cancelled paste', async () => {
  const f = fixture(),
    abort = new AbortController();
  abort.abort();
  await expect(pasteExcelText(f.api, f.view, 4, '00123', { ...f.options, signal: abort.signal })).rejects.toMatchObject(
    { name: 'AbortError' },
  );
  expect(f.api.asc_PasteData).not.toHaveBeenCalled();
});

it('does not start if cancellation happens during preflight', async () => {
  const f = fixture(),
    abort = new AbortController();
  await expect(
    pasteExcelText(f.api, f.view, 4, '00123', {
      ...f.options,
      signal: abort.signal,
      isCurrent: () => {
        abort.abort();
        return true;
      },
    }),
  ).rejects.toMatchObject({ name: 'AbortError' });
  expect(f.api.asc_PasteData).not.toHaveBeenCalled();
  expect(f.endPaste).not.toHaveBeenCalled();
});

it('settles immediately on pending ownership loss before cleanup can undo foreign edits', async () => {
  const f = fixture();
  let revision = 0;
  let owned = true;
  const events: string[] = [];
  f.endPaste.mockImplementation(() => {
    events.push(`cleanup:${owned}`);
  });
  const pending = pasteExcelText(f.api, f.view, 4, '00123', {
    ...f.options,
    captureOwnership: () => {
      const captured = revision;
      return () => revision === captured;
    },
    onOwnershipLost: () => {
      owned = false;
      events.push('lost');
    },
  });
  revision++;
  f.release();
  await expect(pending).rejects.toThrow('Paste ownership has expired');
  f.release();
  expect(f.insert).not.toHaveBeenCalled();
  expect(events).toEqual(['lost', 'cleanup:false']);
  expect(f.view._loadFonts).toBe(f.fonts);
});
