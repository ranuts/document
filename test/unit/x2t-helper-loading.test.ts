import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The vendor-side x2t loader, driven rather than grepped.
 *
 * `public/sdkjs/common/wasm/x2t/x2t_helper.js` is our patch inside the vendor
 * tree -- a plain IIFE that publishes `AscCommon.x2t` -- and the streaming
 * instantiation path (GitHub #144) put two failure modes into it that no
 * textual pin in vendor-contract.test.ts can catch:
 *
 * 1. The hook runs long AFTER `loadScript()` resolved (the `<script>` loaded
 *    fine; only the wasm behind it failed), so a 404 / dropped stream /
 *    CompileError leaves emscripten's success callback uncalled and
 *    `onRuntimeInitialized` never fires. Nothing settled the pending
 *    `doInitialize`, so the user watched a spinner for the full 60 s
 *    INIT_TIMEOUT -- a failure the buffered path reported at once.
 * 2. `hasScriptLoaded` is set in that same case, so the NEXT attempt hit
 *    `loadScript`'s early return. It returned a bare `undefined`, and
 *    `doInitialize`'s `loadScript().then(...)` threw
 *    `undefined.then is not a function` synchronously out of `initialize()`.
 *
 * Evaluating the shipped file is what makes this a test of the file rather
 * than of a copy of it (the same reason sw-register.test.ts drives
 * public/sw-register.js directly).
 */

const HELPER = resolve(__dirname, '../../public/sdkjs/common/wasm/x2t/x2t_helper.js');

type Helper = {
  hasScriptLoaded: boolean;
  WASM_FETCH_ATTEMPTS: number;
  WASM_FETCH_BACKOFF_MS: number;
  fetchWasmResponse: () => Promise<Response>;
  wasmInstantiateError: Error | null;
  INIT_TIMEOUT: number;
  loadScript: () => Promise<void> | undefined;
  doInitialize: () => Promise<unknown>;
  installStreamingInstantiate: () => void;
};

type HelperWindow = {
  AscCommon?: { x2t?: Helper };
  Module?: { instantiateWasm?: (imports: unknown, ok: unknown) => unknown; onRuntimeInitialized?: unknown };
};

/** A fresh `AscCommon.x2t` from the shipped source. */
const loadHelper = (): Helper => {
  const w = window as unknown as HelperWindow;
  delete w.AscCommon;
  delete w.Module;
  // A classic script cannot be imported; evaluating it is the point.
  new Function(readFileSync(HELPER, 'utf8'))();
  const helper = (window as unknown as HelperWindow).AscCommon?.x2t;
  expect(helper, 'x2t_helper.js must publish AscCommon.x2t').toBeDefined();
  return helper as Helper;
};

/** Let the hook's own await chain run, and nothing else. */
const settle = () => new Promise((r) => setTimeout(r, 0));

describe('x2t_helper streaming instantiation', () => {
  let unhandled: (() => void) | null = null;

  beforeEach(() => {
    // The hook rethrows on purpose: that unhandled rejection is what
    // installOpenFailureGuard reads in the real frame. Keep it from failing
    // this run without hiding the assertions below.
    unhandled = () => undefined;
    process.on('unhandledRejection', unhandled);
  });

  afterEach(() => {
    if (unhandled) process.off('unhandledRejection', unhandled);
    unhandled = null;
    const w = window as unknown as HelperWindow;
    delete w.AscCommon;
    delete w.Module;
    vi.unstubAllGlobals();
  });

  /** A frame where the script has loaded and the wasm behind it 404s. */
  const failingFrame = (status = 404): Helper => {
    const helper = loadHelper();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status, body: null }));
    helper.installStreamingInstantiate();
    // As the real frame is by the time the hook runs: <script> onload fired.
    helper.hasScriptLoaded = true;
    return helper;
  };

  const fireHook = (): void => {
    const hook = (window as unknown as HelperWindow).Module?.instantiateWasm;
    expect(typeof hook, 'installStreamingInstantiate must install the hook').toBe('function');
    hook?.({}, () => undefined);
  };

  it('answers emscripten with {} -- a synchronous throw becomes a fatal false in createWasm', () => {
    failingFrame();
    const hook = (window as unknown as HelperWindow).Module?.instantiateWasm;
    expect(hook?.({}, () => undefined)).toEqual({});
  });

  it('rejects a pending doInitialize the moment the hook fails, not at INIT_TIMEOUT', async () => {
    // 403, not a 5xx: a status the server is going to keep giving, so the
    // failure is final and immediate. The retried ones are below.
    const helper = failingFrame(403);
    expect(helper.INIT_TIMEOUT).toBeGreaterThanOrEqual(60000);

    const pending = helper.doInitialize();
    fireHook();
    await settle();

    // Real timers: if the failure only arrived via INIT_TIMEOUT this would sit
    // here until vitest's own 5 s limit killed it.
    await expect(pending).rejects.toThrow(/^X2T module failed to instantiate: .*403/);
  });

  it('rejects at once when the hook failed before anyone asked to initialize', async () => {
    const helper = failingFrame();
    fireHook();
    await settle();

    await expect(helper.doInitialize()).rejects.toThrow(/^X2T module failed to instantiate: .*404/);
  });

  /**
   * The wasm fetch survives a transient answer.
   *
   * Cloudflare Pages served a 500 for x2t.wasm.gz mid-run on 2026-08-20
   * (PR #159) and the editor told the user the document could not be opened.
   * The only recovery above this is rebuilding the whole editor frame, which
   * re-fetches everything -- and in that run it landed in the same bad window.
   * The backoff is zeroed here because what is under test is WHICH answers are
   * asked again, not how long we wait between asks.
   */
  const frameServing = (
    ...answers: Array<{ ok: boolean; status: number } | Error>
  ): [Helper, ReturnType<typeof vi.fn>] => {
    const helper = loadHelper();
    helper.WASM_FETCH_BACKOFF_MS = 0;
    const fetchSpy = vi.fn(() => {
      const answer = answers.shift();
      if (answer === undefined) throw new Error('fetch called more times than the test served answers');
      return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer as unknown as Response);
    });
    vi.stubGlobal('fetch', fetchSpy);
    return [helper, fetchSpy];
  };

  it('asks again after a 5xx and returns the good answer', async () => {
    const good = { ok: true, status: 200 };
    const [helper, fetchSpy] = frameServing({ ok: false, status: 500 }, good);

    await expect(helper.fetchWasmResponse()).resolves.toBe(good);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('asks again after a rejected fetch -- a dropped connection, an offline moment', async () => {
    const good = { ok: true, status: 200 };
    const [helper, fetchSpy] = frameServing(new TypeError('Failed to fetch'), good);

    await expect(helper.fetchWasmResponse()).resolves.toBe(good);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('gives up after WASM_FETCH_ATTEMPTS and reports the status', async () => {
    const [helper, fetchSpy] = frameServing(
      { ok: false, status: 500 },
      { ok: false, status: 502 },
      { ok: false, status: 503 },
    );

    await expect(helper.fetchWasmResponse()).rejects.toThrow(/Failed to fetch x2t WASM at .*503/);
    expect(fetchSpy).toHaveBeenCalledTimes(helper.WASM_FETCH_ATTEMPTS);
  });

  it('does not ask again for a 404 -- a deployment fact, and retrying only delays the error', async () => {
    const [helper, fetchSpy] = frameServing({ ok: false, status: 404 });

    await expect(helper.fetchWasmResponse()).rejects.toThrow(/Failed to fetch x2t WASM at .*404/);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('still returns a promise from loadScript once the script has loaded', async () => {
    // `doInitialize` does `loadScript().then(...)`, and this branch is reached
    // on every attempt after the first -- routinely, because the streaming
    // path sets hasScriptLoaded and then fails.
    const helper = loadHelper();
    helper.hasScriptLoaded = true;

    const result = helper.loadScript();
    expect(typeof result?.then).toBe('function');
    await expect(result).resolves.toBeUndefined();
  });
});
