import { expect, it, vi } from 'vitest';
import { guardExcelPasteCallbacks } from '../../lib/agent-plugin/excel-paste-guard';
it('suppresses a captured font callback after cleanup and restores the native method', () => {
  let release!: () => void;
  const original = vi.fn((_fonts: unknown, callback: () => void) => {
    release = callback;
  });
  const view = { _loadFonts: original };
  const insert = vi.fn();
  const guard = guardExcelPasteCallbacks(view, () => true);
  view._loadFonts([], insert);
  guard.close();
  expect(view._loadFonts).toBe(original);
  release();
  expect(insert).not.toHaveBeenCalled();
});
it('allows owned callbacks and blocks them when the target expires', () => {
  let release!: () => void;
  let current = true;
  const view = {
    _loadFonts: (_fonts: unknown, callback: () => void) => {
      release = callback;
    },
  };
  const insert = vi.fn();
  const guard = guardExcelPasteCallbacks(view, () => current);
  view._loadFonts([], insert);
  release();
  expect(insert).toHaveBeenCalledOnce();
  current = false;
  release();
  expect(insert).toHaveBeenCalledOnce();
  guard.close();
});
it.each([
  ['checkProtectRangeOnEdit', 1],
  ['_isLockedCells', 2],
  ['_isLockedAll', 0],
] as const)('guards the %s continuation', (method, index) => {
  let release!: (...args: unknown[]) => void;
  const original = vi.fn((...args: unknown[]) => {
    release = args[index] as typeof release;
  });
  const view = { [method]: original };
  const callback = vi.fn();
  const args = Array.from({ length: index }, () => null);
  const guard = guardExcelPasteCallbacks(view, () => true);
  view[method](...args, callback);
  guard.close();
  release(true);
  expect(callback).not.toHaveBeenCalled();
  expect(view[method]).toBe(original);
});
it('preserves receiver, arguments and return values without overwriting a later replacement', () => {
  const view = {
    marker: 7,
    _loadFonts: function (fonts: unknown, callback: (ok: boolean) => void) {
      expect(this.marker).toBe(7);
      expect(fonts).toEqual(['font']);
      callback(true);
      return 42;
    },
  };
  const callback = vi.fn();
  const guard = guardExcelPasteCallbacks(view, () => true);
  expect(view._loadFonts(['font'], callback)).toBe(42);
  expect(callback).toHaveBeenCalledWith(true);
  const replacement = vi.fn().mockReturnValue(0);
  view._loadFonts = replacement;
  guard.close();
  expect(view._loadFonts).toBe(replacement);
});

it('restores earlier hooks if installing a later hook fails', () => {
  const original = vi.fn();
  const view = { _isLockedAll: original };
  Object.defineProperty(view, '_loadFonts', { value: vi.fn(), writable: false });
  expect(() => guardExcelPasteCallbacks(view, () => true)).toThrow();
  expect(view._isLockedAll).toBe(original);
});
it('rejects overlapping owners and releases ownership on close', () => {
  const view = { _loadFonts: vi.fn() };
  const guard = guardExcelPasteCallbacks(view, () => true);
  expect(() => guardExcelPasteCallbacks(view, () => true)).toThrow(/active/);
  guard.close();
  const next = guardExcelPasteCallbacks(view, () => true);
  guard.close();
  expect(() => guardExcelPasteCallbacks(view, () => true)).toThrow(/active/);
  next.close();
});

it('rejects a continuation when its captured ownership expires and notifies once', () => {
  let release!: () => void;
  let revision = 0;
  const view = {
    _loadFonts: (_fonts: unknown, callback: () => void) => {
      release = callback;
    },
  };
  const insert = vi.fn();
  const onOwnershipLost = vi.fn();
  const guard = guardExcelPasteCallbacks(view, () => true, {
    captureOwnership: () => {
      const captured = revision;
      return () => revision === captured;
    },
    onOwnershipLost,
  });
  view._loadFonts([], insert);
  revision++;
  release();
  release();
  expect(insert).not.toHaveBeenCalled();
  expect(onOwnershipLost).toHaveBeenCalledOnce();
  guard.close();
});

it('captures ownership separately for each stage, allowing changes inside an owned callback', () => {
  let release!: () => void;
  let revision = 0;
  const view = {
    _loadFonts: (_fonts: unknown, callback: () => void) => {
      release = callback;
    },
  };
  const onOwnershipLost = vi.fn();
  const guard = guardExcelPasteCallbacks(view, () => true, {
    captureOwnership: () => {
      const captured = revision;
      return () => revision === captured;
    },
    onOwnershipLost,
  });
  view._loadFonts([], () => {
    revision++;
  });
  release();
  view._loadFonts([], () => {
    revision++;
  });
  release();
  expect(revision).toBe(2);
  expect(onOwnershipLost).not.toHaveBeenCalled();
  guard.close();
});
