/**
 * 17. Preserve unload timer cleanup without blocking cached navigation.
 *
 * The shipped editors' unload cleanup only cancels continueSavingTimer.
 * Keep that cleanup on pagehide, including cached departures, without a native
 * unload listener that prevents BFCache. Late vendor assignments stay supported.
 */
export function installUnloadPagehide(win: Window): boolean {
  const target = win as Window & { __ooUnloadPagehidePatched?: boolean };
  if (target.__ooUnloadPagehidePatched) return true;
  const descriptor = Object.getOwnPropertyDescriptor(win, 'onunload');
  if (descriptor && !descriptor.configurable) return false;
  let handler = win.onunload;
  const original = handler;
  const invoke = (event: PageTransitionEvent) => handler?.call(win, event);
  try {
    win.onunload = null;
    Object.defineProperty(win, 'onunload', {
      configurable: true,
      get: () => handler,
      set: (value: unknown) => {
        handler = typeof value === 'function' ? (value as Window['onunload']) : null;
      },
    });
    win.addEventListener('pagehide', invoke);
    target.__ooUnloadPagehidePatched = true;
    return true;
  } catch {
    win.removeEventListener('pagehide', invoke);
    try {
      if (descriptor) Object.defineProperty(win, 'onunload', descriptor);
      else Reflect.deleteProperty(win, 'onunload');
      win.onunload = original;
    } catch {
      /* Leave unsupported native properties to their original lifecycle. */
    }
    return false;
  }
}
