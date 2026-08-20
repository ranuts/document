/**
 * The memory x2t asks the browser for, and how to tell which half a browser
 * refused.
 *
 * `public/sdkjs/common/wasm/x2t/x2t.wasm.gz` declares its own (non-shared)
 * memory in the wasm memory section: `initial` 4533 pages and `maximum` 32768
 * pages. A browser therefore has to satisfy two independent requests before
 * `WebAssembly.instantiate` can return:
 *
 * - commit `initial` -- 283 MB of real memory, up front, per editor frame;
 * - reserve address space for `maximum` -- 2 GB, which is only ever used if a
 *   conversion actually grows the heap that far.
 *
 * Either can fail, both surface as the same emscripten `Aborted(RangeError:
 * ... Out of memory ...)`, and the difference decides what the user should do
 * about it (close tabs vs. use a 64-bit browser). GitHub #144 is a reporter
 * whose two Chromes fail while Edge on the same machines succeeds, in a fresh
 * incognito window, on the first open -- which no amount of freeing our own
 * memory explains, but a refused 2 GB reservation does. So when the open
 * fails this way we ask the two halves separately and put the answer in the
 * toast, together with the browser's build bitness -- a 32-bit renderer has
 * only 2-4 GB of address space to find 283 MB of contiguous heap in, which is
 * the other candidate for "Chrome refuses, Edge accepts on the same machine"
 * and the one the user cannot check for us.
 */

export const WASM_PAGE_BYTES = 65536;
/**
 * x2t's declared initial memory: 4533 pages.
 *
 * Not a tunable. Lowering it was tried and reverted: the module's static/BSS
 * layout reaches ~267 MB (the binary holds immutable i32 constants pointing at
 * 280292472 and friends), so a smaller memory puts those compile-time pointers
 * outside it -- a 64 MB initial aborts with `RuntimeError: memory access out of
 * bounds` before the first document is read. 283 MB is 267 MB of static
 * footprint plus slack, and only a different x2t build can change that. See
 * docs/explorations/2026-08-20-x2t-wasm-oom-misclassified.md.
 */
export const X2T_INITIAL_PAGES = 4533;
/** x2t's declared maximum memory: 32768 pages. */
export const X2T_MAXIMUM_PAGES = 32768;
/** 283 -- the number the user sees, kept in one place. */
export const X2T_INITIAL_MB = Math.round((X2T_INITIAL_PAGES * WASM_PAGE_BYTES) / (1024 * 1024));

/**
 * Whether a failure message is a wasm memory allocation refusal rather than a
 * verdict on the document. V8 says "Out of memory: Cannot allocate Wasm memory
 * for new instance", other engines word it differently, and emscripten wraps
 * whichever one it got in `Aborted(...)`.
 *
 * Deliberately narrow: `RuntimeError: memory access out of bounds` is x2t
 * walking off its own heap, which *is* a verdict on the bytes, and must keep
 * classifying as a document failure.
 */
export function isWasmAllocationFailure(message: string): boolean {
  if (/memory access out of bounds/i.test(message)) return false;
  return /Cannot allocate Wasm memory|could not allocate memory|Out of memory|OutOfMemory|Memory allocation failed/i.test(
    message,
  );
}

/**
 * Which half of x2t's memory request this browser cannot serve. The values are
 * what the toast prints, so they reach us again in the reporter's next
 * screenshot -- keep them stable.
 *
 * The reservation probe asks for `initial: 1`, so it costs one page rather
 * than another 283 MB at the exact moment memory is scarce. The commit probe
 * cannot be made cheap that way -- committing 283 MB is the question -- which
 * is what `skipCommit` is for.
 */
export enum WasmMemoryVerdict {
  /** Both halves succeed now, so the failure was transient: fragmentation, or another tab that has since let go. */
  Ok = 'ok',
  /**
   * The reservation is fine and the commit half was not asked, because asking
   * costs the same 283 MB a rebuild of the editor is requesting right now (see
   * the `skipCommit` note on probeX2tMemory).
   */
  Deferred = 'deferred',
  /**
   * The 2 GB `maximum` cannot be reserved -- the 32-bit-renderer and
   * constrained-address-space case. Freeing memory will not help; a 64-bit
   * browser will.
   */
  Reservation = 'reservation',
  /**
   * The reservation is fine but 283 MB of real memory is not available.
   * Closing tabs can genuinely fix this one.
   */
  Commit = 'commit',
  /** No `WebAssembly.Memory` to ask. */
  Unavailable = 'unavailable',
}

/**
 * Whether this browser has already refused to commit x2t's heap.
 *
 * A single failed open reaches the toast more than once -- the guard routes
 * the rejection into `asc_onError` and the vendor raises its own -82 for the
 * same failure -- and each pass would otherwise ask the browser for another
 * 283 MB it has just said it does not have. Once refused, the answer is
 * reused: it is the same answer, and asking again costs exactly the memory
 * that is missing.
 *
 * Reset by `registerOpenAttempt` for a user-initiated open (open-failure.ts),
 * which is a new situation and worth asking about again -- the reader may have
 * closed the tabs the last toast told them to close.
 */
let commitRefused = false;

/** See `commitRefused`: a user-initiated open asks the browser afresh. */
export function resetMemoryProbe(): void {
  commitRefused = false;
}

/**
 * `skipCommit` leaves the commit half unasked and answers `Deferred`.
 *
 * The commit probe really does commit x2t's full 283 MB, synchronously, and
 * the only situation that reaches this function is a browser that has just
 * refused exactly that. When an environment-class failure is being answered
 * with a rebuilt editor, that rebuild is asking for its own 283 MB at the same
 * time: the diagnostic would then be competing with the fix, and can make it
 * fail or push the renderer over. So the caller passes `skipCommit` whenever a
 * rebuild is in flight -- a probe that says less is strictly better than one
 * that breaks the retry it was reporting on.
 */
export function probeX2tMemory(options?: { skipCommit?: boolean }): WasmMemoryVerdict {
  const memory = (globalThis as { WebAssembly?: { Memory?: unknown } }).WebAssembly?.Memory;
  if (typeof memory !== 'function') return WasmMemoryVerdict.Unavailable;
  const Memory = memory as new (descriptor: { initial: number; maximum?: number }) => unknown;
  try {
    // Reservation only: one committed page, x2t's full declared maximum.
    void new Memory({ initial: 1, maximum: X2T_MAXIMUM_PAGES });
  } catch {
    return WasmMemoryVerdict.Reservation;
  }
  // Reaching here already answers the question the reservation half asked, and
  // it is the half GitHub #144 points at; the commit half is worth 283 MB only
  // when nothing else needs them.
  if (options?.skipCommit) return WasmMemoryVerdict.Deferred;
  if (commitRefused) return WasmMemoryVerdict.Commit;
  try {
    // x2t's descriptor verbatim, `maximum` included. Dropping it would make
    // this a question the engine is never actually asked: the two halves can
    // each succeed alone and still fail together, and a browser with just
    // enough address space for one of them is precisely the machine this
    // diagnostic exists for -- it would answer `ok` ("transient") for a
    // failure that repeats every time. Costs the same 283 MB either way.
    void new Memory({ initial: X2T_INITIAL_PAGES, maximum: X2T_MAXIMUM_PAGES });
  } catch {
    commitRefused = true;
    return WasmMemoryVerdict.Commit;
  }
  return WasmMemoryVerdict.Ok;
}

/**
 * Browser build bitness, resolved once and read synchronously afterwards.
 * `getHighEntropyValues` is async and Chromium-only, so the toast cannot await
 * it; we ask at startup and report whatever arrived.
 */
let buildBitness: string | null = null;
let bitnessRequested = false;

type UserAgentData = {
  getHighEntropyValues?: (hints: string[]) => Promise<{ bitness?: string; architecture?: string }>;
};

/** Fire-and-forget; safe to call more than once. */
export function resolveBuildBitness(): void {
  if (bitnessRequested) return;
  bitnessRequested = true;
  const uaData = (navigator as Navigator & { userAgentData?: UserAgentData }).userAgentData;
  if (typeof uaData?.getHighEntropyValues !== 'function') return;
  void uaData
    .getHighEntropyValues(['bitness', 'architecture'])
    .then((values) => {
      const bitness = values.bitness;
      if (bitness) buildBitness = values.architecture ? `${values.architecture}-${bitness}` : bitness;
    })
    .catch(() => {
      // Not available in this browser; the marker just omits it.
    });
}

/**
 * The verdict as a short diagnostic marker for the error toast, in the same
 * bracketed style as the vendor cause `describeOpenFailure` appends. Kept as
 * an untranslated marker rather than prose: its whole job is to come back in
 * the next screenshot and say which half of the request the browser refused,
 * on what kind of build.
 */
export function describeMemoryVerdict(verdict: WasmMemoryVerdict): string {
  return ` [memory: ${verdict}${buildBitness ? `, build: ${buildBitness}` : ''}]`;
}
