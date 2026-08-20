import { afterEach, describe, expect, it } from 'vitest';

import {
  describeMemoryVerdict,
  isWasmAllocationFailure,
  probeX2tMemory,
  WasmMemoryVerdict,
  X2T_INITIAL_MB,
  X2T_INITIAL_PAGES,
  X2T_MAXIMUM_PAGES,
} from '../../lib/onlyoffice/wasm-memory';
import { releaseWasmBinary } from '../../lib/onlyoffice/guards/wasm-binary-release';

/**
 * The out-of-memory open failure of GitHub #144. What the editor reports is
 * `Aborted(RangeError: WebAssembly.instantiate(): Out of memory: Cannot
 * allocate Wasm memory for new instance.)`, which says the conversion engine
 * never started -- not that anything is wrong with the document.
 */
const OOM_MESSAGE =
  'Aborted(RangeError: WebAssembly.instantiate(): Out of memory: Cannot allocate Wasm memory for new instance. Build with -sASSERTIONS for more info.)';

describe('x2t memory declaration', () => {
  // Parsed out of public/sdkjs/common/wasm/x2t/x2t.wasm.gz. If a new vendor
  // build changes them, the user-facing "about 283 MB" and the probe both go
  // stale, so pin them here next to the message that quotes the number.
  it('pins the initial and maximum the wasm binary declares', () => {
    // Neither is a tunable. `initial` cannot go below the module's ~267 MB
    // static/BSS footprint (measured: immutable i32 globals point at
    // 280292472), and `maximum` is a hard ceiling that large documents need.
    expect(X2T_INITIAL_PAGES).toBe(4533);
    expect(X2T_MAXIMUM_PAGES).toBe(32768);
    expect(X2T_INITIAL_MB).toBe(283);
  });
});

describe('isWasmAllocationFailure', () => {
  it('recognises the allocation refusals of each engine', () => {
    expect(isWasmAllocationFailure(OOM_MESSAGE)).toBe(true);
    expect(isWasmAllocationFailure('Aborted(RangeError: WebAssembly.Memory(): could not allocate memory)')).toBe(true);
    expect(isWasmAllocationFailure('out of memory')).toBe(true);
  });

  it('recognises it without the Aborted() wrapper (streaming instantiation)', () => {
    // Since x2t_helper compiles the module off the network through
    // Module.instantiateWasm, the failure no longer passes through
    // emscripten's abort() -- it surfaces as the engine's own rejection, and
    // emscripten's `abort` is module-local so the helper cannot re-wrap it.
    expect(
      isWasmAllocationFailure(
        'RangeError: WebAssembly.instantiateStreaming(): Out of memory: Cannot allocate Wasm memory for new instance.',
      ),
    ).toBe(true);
  });

  it('leaves a heap overrun classified as the document failure it is', () => {
    // x2t walking off its own heap IS a verdict on the bytes; it must not be
    // retried as an environment failure just because it says "memory".
    expect(isWasmAllocationFailure('RuntimeError: memory access out of bounds')).toBe(false);
    expect(isWasmAllocationFailure('Aborted(missing function: _ZN10CHtmlFile2C1Ev)')).toBe(false);
    expect(isWasmAllocationFailure('Conversion failed with code: 88')).toBe(false);
  });
});

describe('probeX2tMemory', () => {
  const original = globalThis.WebAssembly;

  afterEach(() => {
    globalThis.WebAssembly = original;
  });

  const stubMemory = (impl: (descriptor: { initial: number; maximum?: number }) => void) => {
    globalThis.WebAssembly = {
      Memory: class {
        constructor(descriptor: { initial: number; maximum?: number }) {
          impl(descriptor);
        }
      },
    } as unknown as typeof WebAssembly;
  };

  it('blames the reservation when the declared maximum cannot be reserved', () => {
    // The candidate explanation for "Chrome refuses, Edge accepts on the same
    // machine": the 2 GB reservation, not the 283 MB of real memory.
    stubMemory((descriptor) => {
      if (descriptor.maximum !== undefined) throw new RangeError('cannot reserve');
    });
    expect(probeX2tMemory()).toBe(WasmMemoryVerdict.Reservation);
  });

  it('costs one page to answer the reservation question, not another 283 MB', () => {
    const asked: Array<{ initial: number; maximum?: number }> = [];
    stubMemory((descriptor) => {
      asked.push(descriptor);
      if (descriptor.maximum !== undefined) throw new RangeError('cannot reserve');
    });
    probeX2tMemory();
    expect(asked).toEqual([{ initial: 1, maximum: X2T_MAXIMUM_PAGES }]);
  });

  it('blames the commit when the reservation is fine but the pages are not there', () => {
    stubMemory((descriptor) => {
      if (descriptor.initial > 1) throw new RangeError('cannot commit');
    });
    expect(probeX2tMemory()).toBe(WasmMemoryVerdict.Commit);
  });

  it('asks the commit half with the descriptor x2t actually declares', () => {
    // `initial` without `maximum` is a question the engine is never asked:
    // both halves can succeed alone and still fail together, which is exactly
    // the constrained-address-space machine the probe exists to identify.
    const asked: Array<{ initial: number; maximum?: number }> = [];
    stubMemory((descriptor) => {
      asked.push(descriptor);
    });
    expect(probeX2tMemory()).toBe(WasmMemoryVerdict.Ok);
    expect(asked).toEqual([
      { initial: 1, maximum: X2T_MAXIMUM_PAGES },
      { initial: X2T_INITIAL_PAGES, maximum: X2T_MAXIMUM_PAGES },
    ]);
  });

  it('reports ok when both halves succeed (the failure was transient)', () => {
    stubMemory(() => {});
    expect(probeX2tMemory()).toBe(WasmMemoryVerdict.Ok);
  });

  it('reports unavailable without WebAssembly.Memory', () => {
    globalThis.WebAssembly = {} as unknown as typeof WebAssembly;
    expect(probeX2tMemory()).toBe(WasmMemoryVerdict.Unavailable);
  });

  it('does not commit 283 MB behind a rebuild that is asking for its own', () => {
    // The only path here is a browser that just refused x2t's heap, and the
    // retry answering that failure is requesting the same 283 MB right now.
    // A diagnostic that competes with the fix can make the fix fail.
    const asked: Array<{ initial: number; maximum?: number }> = [];
    stubMemory((descriptor) => {
      asked.push(descriptor);
    });
    expect(probeX2tMemory({ skipCommit: true })).toBe(WasmMemoryVerdict.Deferred);
    expect(asked).toEqual([{ initial: 1, maximum: X2T_MAXIMUM_PAGES }]);
  });

  it('still answers the reservation question while skipping the commit', () => {
    // The half GitHub #144 points at costs one page, so it is never skipped.
    stubMemory((descriptor) => {
      if (descriptor.maximum !== undefined) throw new RangeError('cannot reserve');
    });
    expect(probeX2tMemory({ skipCommit: true })).toBe(WasmMemoryVerdict.Reservation);
  });
});

describe('describeMemoryVerdict', () => {
  it('keeps the wire values stable (they come back in the next screenshot)', () => {
    expect(Object.values(WasmMemoryVerdict)).toEqual(['ok', 'deferred', 'reservation', 'commit', 'unavailable']);
  });

  it('renders a bracketed marker the next screenshot can carry back', () => {
    expect(describeMemoryVerdict(WasmMemoryVerdict.Reservation)).toBe(' [memory: reservation]');
  });
});

describe('releaseWasmBinary', () => {
  type Emscripten = { wasmBinary?: ArrayBuffer; calledRun?: boolean };
  // Not `Window & {...}`: the global Window['Module'] is the converter surface
  // (packages/shared's EmscriptenModule), and the guard reads two fields of it.
  type ModuleWindow = { Module?: Emscripten; wasmBinary?: ArrayBuffer };

  const frame = (module?: Emscripten): ModuleWindow => ({ Module: module });

  /**
   * The frame as x2t.js actually leaves it: an unwrapped classic script, so its
   * top-level `var wasmBinary` is a window property, seeded from
   * Module['wasmBinary'] and never cleared by anything in the module.
   */
  const loadedFrame = (calledRun: boolean): ModuleWindow => {
    const wasmBinary = new ArrayBuffer(8);
    return { Module: { wasmBinary, calledRun }, wasmBinary };
  };

  it('keeps the buffer while it is still the input to instantiation', () => {
    const win = frame({ wasmBinary: new ArrayBuffer(8), calledRun: false });
    releaseWasmBinary(win as unknown as Window);
    expect(win.Module?.wasmBinary).toBeInstanceOf(ArrayBuffer);
  });

  it('drops the 40 MB buffer once the module has run', () => {
    const win = frame({ wasmBinary: new ArrayBuffer(8), calledRun: true });
    expect(releaseWasmBinary(win as unknown as Window)).toBe(true);
    expect(win.Module?.wasmBinary).toBeUndefined();
  });

  it("drops x2t.js's own global reference too, or the release frees nothing", () => {
    // `var wasmBinary; if (Module['wasmBinary']) wasmBinary = Module['wasmBinary']`
    // -- x2t.js keeps a second reference to the same 40.2 MB ArrayBuffer on the
    // frame's window and never clears it. Releasing only the Module property
    // leaves the memory exactly where it was.
    const win = loadedFrame(true);
    expect(releaseWasmBinary(win as unknown as Window)).toBe(true);
    expect(win.Module?.wasmBinary).toBeUndefined();
    expect(win.wasmBinary).toBeUndefined();
  });

  it('drops both references when the release comes from the calledRun watcher', () => {
    const win = loadedFrame(false);
    expect(releaseWasmBinary(win as unknown as Window)).toBe(true);
    expect(win.wasmBinary).toBeInstanceOf(ArrayBuffer);

    win.Module!.calledRun = true;
    expect(win.Module?.wasmBinary).toBeUndefined();
    expect(win.wasmBinary).toBeUndefined();
  });

  it('is idempotent and tolerates a frame with no module at all', () => {
    const win = frame({ wasmBinary: new ArrayBuffer(8), calledRun: true });
    releaseWasmBinary(win as unknown as Window);
    expect(releaseWasmBinary(win as unknown as Window)).toBe(true);
    expect(releaseWasmBinary(frame(undefined) as unknown as Window)).toBe(true);
  });

  // prepareEditorIframe's timer stops as soon as the open-and-save guards are
  // in place, and onDocumentReady has been and gone long before a blank
  // document (`?new=docx`) loads x2t on its FIRST SAVE. Driven by polling
  // alone, this guard simply never ran for those sessions and the frame kept
  // 40 MB for its whole life.
  it('releases when x2t loads long after the guard timer stopped', () => {
    const win = frame(undefined);
    // One pass, at the only moment the caller offers: no Module yet.
    expect(releaseWasmBinary(win as unknown as Window)).toBe(true);

    // Minutes later, the first save loads x2t through the buffered path.
    win.Module = { wasmBinary: new ArrayBuffer(8) };
    expect(win.Module.wasmBinary).toBeInstanceOf(ArrayBuffer);
    win.Module!.calledRun = true;
    expect(win.Module?.wasmBinary).toBeUndefined();
  });

  it('follows the fresh object x2t_helper publishes for each Module rewrite', () => {
    // x2t_helper does `window.Module = Object.assign({}, window.Module, ...)`
    // more than once, so watching one object would miss the one that runs.
    const win = frame({ calledRun: false });
    releaseWasmBinary(win as unknown as Window);
    win.Module = { wasmBinary: new ArrayBuffer(8), calledRun: false };
    win.Module!.calledRun = true;
    expect(win.Module?.wasmBinary).toBeUndefined();
  });

  it('keeps reading back what emscripten wrote (the flag stays a real flag)', () => {
    // x2t.js sets Module['calledRun'] and reads `calledRun` itself; an
    // accessor that swallowed the value would break the module, not just us.
    const win = frame({ wasmBinary: new ArrayBuffer(8), calledRun: false });
    releaseWasmBinary(win as unknown as Window);
    expect(win.Module?.calledRun).toBe(false);
    win.Module!.calledRun = true;
    expect(win.Module?.calledRun).toBe(true);
  });
});
