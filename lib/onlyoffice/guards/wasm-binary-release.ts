/**
 * 10. x2t wasm binary release.
 *
 * `x2t_helper.prepareWasmBinary` -- the fallback path for engines that cannot
 * stream (`canStreamWasm()` false) -- fetches the 9.4 MB `x2t.wasm.gz`,
 * inflates it to a 40.2 MB ArrayBuffer and parks it on
 * `window.Module.wasmBinary` so emscripten skips its own fetch of the raw
 * 40 MB file (which cannot be deployed: it is over Cloudflare Pages' 25 MiB
 * per-file limit). Emscripten reads that buffer exactly once, in `createWasm`,
 * and then never again -- but nothing drops it, so every editor frame keeps
 * 40 MB of dead bytes for its whole life, on top of x2t's own 283 MB heap.
 *
 * That is 40 MB per frame we can hand straight back, and it matters most in
 * exactly the situation where it is hardest to get: a browser that is already
 * refusing to allocate the next wasm heap (GitHub #144), and a rebuild that
 * has to fit a second engine alongside the outgoing one.
 *
 * Emscripten sets `calledRun` after `run()` completes, which is strictly after
 * `createWasm`, so that flag is the safe point to release.
 *
 * This guard cannot be driven by `prepareEditorIframe`'s polling the way the
 * others are, because x2t does not necessarily load while that timer is alive:
 * a blank document (`?new=docx`) loads no converter at all until the FIRST
 * SAVE, minutes later, and by then the timer has been cleared and
 * `onDocumentReady` has been and gone. So the guard subscribes instead: it
 * watches for the frame's `Module` and for `calledRun` being set on it, and
 * releases from there. Polling stays as the fallback for a frame where the
 * accessors cannot be installed.
 */

// Just the two properties this guard touches. Deliberately not the global
// `Window['Module']` (packages/shared's EmscriptenModule): that one describes
// the converter surface lib/converter uses, and intersecting the two only
// makes the accessors below untypable.
type X2tModule = { wasmBinary?: ArrayBuffer; calledRun?: boolean };

type GuardWindow = {
  Module?: X2tModule;
  /**
   * x2t.js's own top-level `var wasmBinary`. It is an unwrapped classic script,
   * so that declaration is a property of this frame's window -- and its second
   * line is `if (Module['wasmBinary']) wasmBinary = Module['wasmBinary']`,
   * which nothing ever clears. Releasing only the Module property therefore
   * frees nothing at all: the same 40.2 MB ArrayBuffer stays reachable as
   * `window.wasmBinary` for the life of the frame.
   */
  wasmBinary?: ArrayBuffer;
  __ooWasmBinaryReleased?: boolean;
  __ooWasmBinaryWatched?: boolean;
};

/**
 * Drop the buffer -- both references to it. Safe to call more than once.
 *
 * Emscripten reads it in `createWasm` only (`getBinary` / `instantiateAsync`,
 * both on the startup path), and `calledRun` is strictly after that, so
 * neither reference is read again.
 */
function release(w: GuardWindow, module: X2tModule): void {
  if (!module.wasmBinary && !w.wasmBinary) return;
  module.wasmBinary = undefined;
  // `var`-declared globals are writable (just not configurable), so this
  // assignment is what actually returns the memory.
  w.wasmBinary = undefined;
  w.__ooWasmBinaryReleased = true;
}

/**
 * Release as soon as `calledRun` is set on this module object. x2t.js assigns
 * `Module['calledRun'] = true` in `doRun()`, after `createWasm` has read the
 * buffer, so an accessor there fires at exactly the right moment.
 */
function watchCalledRun(w: GuardWindow, module: X2tModule): boolean {
  if (module.calledRun) {
    release(w, module);
    return true;
  }
  try {
    let value: boolean | undefined = module.calledRun;
    Object.defineProperty(module, 'calledRun', {
      configurable: true,
      enumerable: true,
      get: () => value,
      set: (next: boolean) => {
        value = next;
        if (next) release(w, module);
      },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * `x2t_helper` publishes the module as `window.Module = Object.assign({}, ...)`
 * -- a fresh object, more than once -- so watching one object is not enough;
 * watch the property that carries them.
 */
function watchModule(w: GuardWindow): boolean {
  try {
    let current = w.Module;
    Object.defineProperty(w, 'Module', {
      configurable: true,
      enumerable: true,
      get: () => current,
      set: (next: X2tModule | undefined) => {
        current = next;
        if (next) watchCalledRun(w, next);
      },
    });
    if (current) watchCalledRun(w, current);
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns whether this frame needs nothing further from the caller's polling:
 * the buffer is gone, or a watcher is in place that will drop it whenever x2t
 * finishes running -- including the first-save-of-a-blank-document case the
 * timer can never reach.
 */
export function releaseWasmBinary(win: Window): boolean {
  const w = win as unknown as GuardWindow;
  if (w.__ooWasmBinaryReleased) return true;
  const module = w.Module;
  if (module && (module.wasmBinary || w.wasmBinary) && module.calledRun) {
    release(w, module);
    return true;
  }
  if (w.__ooWasmBinaryWatched) return true;
  if (!watchModule(w)) return false;
  w.__ooWasmBinaryWatched = true;
  return true;
}
