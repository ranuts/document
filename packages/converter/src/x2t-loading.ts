/**
 * Getting the x2t module into the engine, and saying so when that fails.
 *
 * Kept in step with `fetchWasmResponse` in the vendor-side loader
 * (public/sdkjs/common/wasm/x2t/x2t_helper.js): the site's editor frame runs
 * that copy, this one serves consumers of the package that load x2t on the
 * page itself. test/unit/x2t-helper-loading.test.ts and
 * test/unit/converter-wasm-loading.test.ts drive the two against the real
 * files, separately, for that reason.
 */
/**
 * Whether the module can be compiled straight off the network, without the
 * decompressed 42 MB ever existing as one buffer. Checked up front so a
 * failure of the streaming path itself is never retried through the buffered
 * one (see installStreamingInstantiate).
 */
export const canStreamWasm = (): boolean =>
  typeof WebAssembly !== 'undefined' && typeof WebAssembly.instantiateStreaming === 'function';

/** Total tries for the x2t WASM fetch, and the step of the linear backoff. */
const WASM_FETCH_ATTEMPTS = 3;
const WASM_FETCH_BACKOFF_MS = 500;

/**
 * Whether a status means "the server failed", as opposed to "the file is not
 * there". Only the first is worth asking again.
 */
const isTransientStatus = (status: number): boolean => status >= 500 || status === 408 || status === 429;

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetch the x2t WASM, asking again when the answer was transient.
 *
 * This is a 9.4 MB asset off a CDN and one bad answer to it costs the whole
 * open: Cloudflare Pages served a 500 for exactly this file mid-run on
 * 2026-08-20 (PR #159) and the editor reported the document as unopenable. The
 * recovery a host has above this -- rebuilding the whole editor and re-fetching
 * everything -- is far more expensive than asking twice more, and in that run
 * it landed in the same bad window.
 *
 * Retried only when the server says it failed (5xx / 408 / 429) or the fetch
 * itself rejected (a dropped connection, an offline moment); a 404 or a 403 is
 * a deployment fact, and retrying only delays the error the user has to see.
 * Nothing is retained between attempts, so this adds nothing to the peak the
 * streaming path exists to keep down.
 *
 * Kept in step with `fetchWasmResponse` in the vendor-side loader
 * (public/sdkjs/common/wasm/x2t/x2t_helper.js).
 */
export async function fetchWasmResponse(wasmPath: string): Promise<Response> {
  for (let attempt = 1; ; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(wasmPath);
    } catch (error) {
      if (attempt >= WASM_FETCH_ATTEMPTS) throw error;
      console.warn('[x2t] retrying the WASM fetch after', error);
      await wait(WASM_FETCH_BACKOFF_MS * attempt);
      continue;
    }
    if (response.ok) return response;
    const failure = new Error(`Failed to fetch x2t WASM at '${wasmPath}' (${response.status})`);
    if (attempt >= WASM_FETCH_ATTEMPTS || !isTransientStatus(response.status)) throw failure;
    console.warn('[x2t] retrying the WASM fetch after', failure.message);
    await wait(WASM_FETCH_BACKOFF_MS * attempt);
  }
}

/**
 * The error a failed streaming instantiation reports.
 *
 * The `X2T module` prefix is the entry condition a host's open-failure
 * handling matches on (the site's own guard is
 * lib/onlyoffice/open-failure.ts); the original wording is kept after it
 * because that is what the same host reads to tell a refused wasm heap from a
 * dropped download. Without the prefix nothing claims the failure at all:
 * `loadScript()` has already resolved by the time the hook runs, emscripten's
 * success callback is simply never called, and the user watches a spinner
 * until the init timeout fires.
 */
export const x2tInstantiateError = (error: unknown): Error =>
  new Error(`X2T module failed to instantiate: ${error instanceof Error ? error.message : String(error)}`);
