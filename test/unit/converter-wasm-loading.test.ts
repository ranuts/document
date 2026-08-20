import { afterEach, describe, expect, it, vi } from 'vitest';
import { X2TConverter, canStreamWasm, sniffAndRebuild, x2tInstantiateError } from '@ranuts/converter';

// jsdom never runs an injected <script>, so the real scriptOnLoad would hang
// waiting for a load event. What is under test here is the preparation that
// runs before it, not the tag.
vi.mock('ranuts/utils', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  scriptOnLoad: vi.fn().mockResolvedValue(undefined),
}));

/**
 * How @ranuts/converter gets the x2t module into the engine.
 *
 * The package used to have only the buffered path: fetch the ~10 MB gzip,
 * inflate it to a 40 MB ArrayBuffer, hand emscripten the bytes. That buffer is
 * alive at the exact moment WebAssembly asks the browser for x2t's own 283 MB
 * heap, which is the moment that fails on a machine short of memory
 * (GitHub #144). The site's own loader
 * (public/sdkjs/common/wasm/x2t/x2t_helper.js, pinned by
 * test/unit/vendor-contract.test.ts) grew a streaming path for that reason;
 * this file is the same two paths in the published package, which is what a
 * consumer loading x2t on the page itself runs.
 */

const collect = async (stream: ReadableStream<Uint8Array>): Promise<Uint8Array> => {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const result = await reader.read();
    if (result.done) break;
    chunks.push(result.value);
    total += result.value.length;
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
};

const streamOf = (...chunks: Uint8Array[]): ReadableStream<Uint8Array> =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });

const gzip = async (bytes: Uint8Array): Promise<Uint8Array> =>
  collect(
    streamOf(bytes).pipeThrough(
      // Variance only: CompressionStream accepts BufferSource, wider than the
      // Uint8Array chunks streamOf emits.
      new CompressionStream('gzip') as unknown as ReadableWritablePair<Uint8Array, Uint8Array>,
    ),
  );

/** The first four bytes of any wasm module: \0asm. */
const WASM_MAGIC = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);

describe('sniffAndRebuild', () => {
  it('passes an already-decoded module through untouched', async () => {
    // Some hosts send `Content-Encoding: gzip` for a .gz file, so the browser
    // has already inflated it by the time we read the body. Decompressing
    // again would corrupt it.
    expect(await collect(await sniffAndRebuild(streamOf(WASM_MAGIC)))).toEqual(WASM_MAGIC);
  });

  it('inflates a body that is still gzip, which is what a static host serves', async () => {
    const compressed = await gzip(WASM_MAGIC);
    expect(await collect(await sniffAndRebuild(streamOf(compressed)))).toEqual(WASM_MAGIC);
  });

  it('sniffs across chunk boundaries, including an empty first chunk', async () => {
    // A reader is free to split the two magic bytes, or to hand back nothing
    // at all first. Indexing into chunk[0] rather than the concatenated head
    // reads the gzip marker as absent and ships the compressed bytes straight
    // to the engine.
    const compressed = await gzip(WASM_MAGIC);
    const split = streamOf(new Uint8Array(0), compressed.subarray(0, 1), compressed.subarray(1));
    expect(await collect(await sniffAndRebuild(split))).toEqual(WASM_MAGIC);
  });

  it('reports an empty body as empty rather than mis-sniffing it', async () => {
    expect(await collect(await sniffAndRebuild(streamOf()))).toEqual(new Uint8Array(0));
  });
});

describe('loadScript picks the path that keeps the inflated module out of the peak', () => {
  afterEach(() => {
    delete (window as any).Module;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('installs the streaming hook and never buffers when the engine can stream', async () => {
    expect(canStreamWasm(), 'this environment must be able to stream for the assertion to mean anything').toBe(true);
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const converter = new X2TConverter() as any;
    await converter.loadScript();

    expect(typeof (window as any).Module?.instantiateWasm).toBe('function');
    expect((window as any).Module?.wasmBinary).toBeUndefined();
    // Nothing is fetched until emscripten calls the hook, so the download and
    // the compile happen together instead of one after the other.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('falls back to the buffered path when the engine cannot stream', async () => {
    vi.stubGlobal('DecompressionStream', undefined);
    expect(canStreamWasm()).toBe(false);

    const converter = new X2TConverter() as any;
    const prepare = vi.spyOn(converter, 'prepareWasmBinary').mockResolvedValue(undefined);
    await converter.loadScript();

    expect(prepare).toHaveBeenCalled();
    expect((window as any).Module?.instantiateWasm).toBeUndefined();
  });

  it('answers emscripten synchronously and starts the download from the hook', async () => {
    // `{}` means "asynchronous, the callback is coming". Anything thrown from
    // here synchronously turns into `false` inside createWasm(), which is
    // fatal -- so a never-settling fetch must leave the hook looking fine.
    const pending = vi.fn().mockReturnValue(new Promise<Response>(() => {}));
    vi.stubGlobal('fetch', pending);
    const converter = new X2TConverter() as any;
    await converter.loadScript();

    const hook = (window as any).Module.instantiateWasm as (i: unknown, cb: unknown) => unknown;
    expect(hook({}, () => undefined)).toEqual({});
    expect(pending).toHaveBeenCalledWith(expect.stringContaining('x2t.wasm.gz'));
  });
});

describe('a failed streaming instantiation settles initialize() instead of hanging it', () => {
  afterEach(() => {
    delete (window as any).Module;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /**
   * The wedge this guards against: the hook runs long after `loadScript()`
   * resolved, so a 404 / dropped stream / CompileError leaves emscripten's
   * success callback uncalled, `onRuntimeInitialized` never fires, and
   * `initialize()` sat for the whole 300 s INIT_TIMEOUT -- for a failure that
   * was already known. The buffered path reported the same failure at once.
   */
  const failingHook = async (converter: any): Promise<void> => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, body: null } as unknown as Response));
    await converter.loadScript();
    const hook = (window as any).Module.instantiateWasm as (i: unknown, cb: unknown) => unknown;
    // The rethrow is deliberately unhandled (it is what a host's
    // open-failure guard reads as an unhandledrejection), so keep it from
    // failing the run here.
    const onRejection = () => undefined;
    process.on('unhandledRejection', onRejection);
    hook({}, () => undefined);
    await new Promise((r) => setTimeout(r, 0));
    process.off('unhandledRejection', onRejection);
  };

  it('rejects with the prefixed cause once the hook has already failed', async () => {
    const converter = new X2TConverter() as any;
    await failingHook(converter);

    // The failure landed before anyone asked to initialize.
    await expect(converter.doInitialize()).rejects.toThrow(/^X2T module failed to instantiate: .*404/);
  });

  it('rejects a pending initialize() the moment the hook fails', async () => {
    vi.useFakeTimers();
    try {
      const converter = new X2TConverter() as any;
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503, body: null } as unknown as Response));
      await converter.loadScript();
      (window as any).Module.onRuntimeInitialized = undefined;

      const pending = converter.doInitialize();
      const hook = (window as any).Module.instantiateWasm as (i: unknown, cb: unknown) => unknown;
      const onRejection = () => undefined;
      process.on('unhandledRejection', onRejection);
      hook({}, () => undefined);
      // Only the microtasks the hook's own await chain needs -- emphatically
      // NOT the 300 s timer, which is the point.
      await vi.advanceTimersByTimeAsync(0);
      process.off('unhandledRejection', onRejection);

      await expect(pending).rejects.toThrow(/^X2T module failed to instantiate: .*503/);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('x2tInstantiateError', () => {
  it('carries the prefix a host matches on and the cause it then reads', () => {
    // The hook has already resolved loadScript() by the time it runs, so
    // rejecting is its only channel -- and an unprefixed rejection is claimed
    // by nobody: emscripten's success callback is simply never called and the
    // user watches the spinner until doInitialize's 60 s init timeout.
    const oom = new Error(
      'Aborted(RangeError: WebAssembly.instantiate(): Out of memory: Cannot allocate Wasm memory for new instance.)',
    );
    expect(x2tInstantiateError(oom).message).toBe(`X2T module failed to instantiate: ${oom.message}`);
  });

  it('survives a thrown non-Error', () => {
    expect(x2tInstantiateError('offline').message).toBe('X2T module failed to instantiate: offline');
  });
});
