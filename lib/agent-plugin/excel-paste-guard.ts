const owners = new WeakSet<object>();

type NativeMethod = (...args: unknown[]) => unknown;

export interface ExcelPasteOwnership {
  /** Capture the pending stage, before any insertion performed by its callback. */
  captureOwnership?(): () => boolean;
  /** Called once after disabling all pending continuations. */
  onOwnershipLost?(): void;
}

/** Run only inside an owned blocking paste action. Protect every async stage of
 * the bundled Excel text-paste pipeline, including callbacks captured before
 * close(). Closing restores methods but leaves captured continuations disabled.
 * The caller owns native paste cleanup, settlement and history restoration.
 */
export function guardExcelPasteCallbacks(
  view: object,
  isCurrent: () => boolean,
  ownership: ExcelPasteOwnership = {},
): { close(): void } {
  if (owners.has(view)) throw new Error('An Excel paste guard is already active');
  owners.add(view);
  const target = view as Record<string, unknown>;
  const patches: Array<{ name: string; original: NativeMethod; guarded: NativeMethod }> = [];
  let active = true;
  const current = () => {
    if (!active) return false;
    try {
      return isCurrent();
    } catch {
      return false;
    }
  };
  const close = () => {
    if (!active) return;
    active = false;
    try {
      for (const { name, original, guarded } of patches) if (target[name] === guarded) target[name] = original;
    } finally {
      owners.delete(view);
    }
  };
  try {
    for (const [name, index] of [
      ['checkProtectRangeOnEdit', 1],
      ['_isLockedAll', 0],
      ['_isLockedCells', 2],
      ['_loadFonts', 1],
    ] as const) {
      const original = target[name];
      if (typeof original !== 'function') continue;
      const native = original as NativeMethod;
      const guarded: NativeMethod = function (this: unknown, ...args) {
        if (!current()) return;
        const callback = args[index];
        if (typeof callback === 'function') {
          const ownsStage = ownership.captureOwnership?.();
          args[index] = function (this: unknown, ...values: unknown[]) {
            if (!current()) return;
            let owned = true;
            try {
              owned = ownsStage?.() ?? true;
            } catch {
              owned = false;
            }
            if (!owned) {
              close();
              ownership.onOwnershipLost?.();
              return;
            }
            return Reflect.apply(callback, this, values);
          };
        }
        return Reflect.apply(native, this, args);
      };
      target[name] = guarded;
      patches.push({ name, original: native, guarded });
    }
  } catch (error) {
    close();
    throw error;
  }
  return { close };
}
