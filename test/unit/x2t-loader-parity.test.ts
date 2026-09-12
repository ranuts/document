import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CANVAS_PDF_INPUT_FORMAT,
  PDF_OUTPUT_FORMAT,
  canStreamWasm,
  fetchWasmResponse,
  x2tInstantiateError,
} from '@ranuts/converter';
import { DOCUMENT_TYPE_MAP } from '@ranuts/shared/document-utils';

/**
 * The two x2t loaders, asked the same questions.
 *
 * There are two implementations of "get x2t into the engine and say what went
 * wrong", and there have to be: the site's editor frame runs
 * `public/sdkjs/common/wasm/x2t/x2t_helper.js` -- an unwrapped classic script
 * inside the vendor tree, also `importScripts`ed by the x2t worker -- while a
 * consumer of @ranuts/converter runs the bundled module. Neither can import
 * the other without putting a build step inside `public/`, which is where
 * VENDOR_VERSION hashes bytes exactly as they are shipped.
 *
 * x2t-helper-loading.test.ts and converter-wasm-loading.test.ts already drive
 * each file against its own expectations, which proves each is self-consistent
 * and cannot notice the two disagreeing. That gap is not academic: on this
 * site only the vendor copy is live (the app's `X2TConverter` instances call
 * nothing but the SheetJS paths), so a change made to one and forgotten in the
 * other leaves every E2E and the production smoke green, and breaks somebody
 * who installed the package.
 *
 * So the cases below run both and compare the answers. What is pinned is the
 * behaviour a host depends on: which answers are worth asking again, how long
 * it waits, whether the module can be streamed, and the shape of the failure a
 * host's open-failure handling classifies on.
 */

const HELPER = resolve(__dirname, '../../public/sdkjs/common/wasm/x2t/x2t_helper.js');
const HELPER_SOURCE = readFileSync(HELPER, 'utf8');

type Helper = {
  WASM_PATH: string;
  WASM_FETCH_ATTEMPTS: number;
  WASM_FETCH_BACKOFF_MS: number;
  fetchWasmResponse: () => Promise<Response>;
  canStreamWasm: () => boolean;
  installStreamingInstantiate: () => void;
  wasmInstantiateError: Error | null;
  hasScriptLoaded: boolean;
};

type HelperWindow = { AscCommon?: { x2t?: Helper }; Module?: { instantiateWasm?: unknown } };

/** A fresh `AscCommon.x2t` from the shipped file; a classic script cannot be imported. */
const loadHelper = (): Helper => {
  const w = window as unknown as HelperWindow;
  delete w.AscCommon;
  delete w.Module;
  new Function(HELPER_SOURCE)();
  const helper = (window as unknown as HelperWindow).AscCommon?.x2t;
  expect(helper, 'x2t_helper.js must publish AscCommon.x2t').toBeDefined();
  return helper as Helper;
};

type Answer = { ok: boolean; status: number } | Error;
type Outcome = { calls: number; settled: 'resolved' | 'rejected' };

/**
 * Serve one scripted sequence of answers to a fetch and report what the loader
 * did with it. Both sides run on the same fake clock, so the wait between
 * attempts is part of what is being compared rather than something each side
 * gets to do at its own pace.
 */
const ask = async (run: () => Promise<unknown>, answers: Answer[]): Promise<Outcome> => {
  const queue = [...answers];
  const fetchSpy = vi.fn(() => {
    const answer = queue.shift();
    if (answer === undefined) throw new Error('asked more times than the case served answers');
    return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer as unknown as Response);
  });
  vi.stubGlobal('fetch', fetchSpy);

  let settled: Outcome['settled'] = 'resolved';
  const done = run().then(
    () => undefined,
    () => {
      settled = 'rejected';
    },
  );
  // Past the whole backoff schedule, whatever either side thinks it is.
  await vi.advanceTimersByTimeAsync(60_000);
  await done;
  return { calls: fetchSpy.mock.calls.length, settled };
};

describe('the two x2t loaders answer alike', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Both log the retry they are about to make; that is not what is under test.
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    const w = window as unknown as HelperWindow;
    delete w.AscCommon;
    delete w.Module;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /**
   * Which answers are worth asking again.
   *
   * A 9.4 MB asset off a CDN, and one bad answer costs the whole open:
   * Cloudflare Pages served a 500 for exactly this file mid-run on 2026-08-20
   * (PR #159). A 404 or a 403 is a deployment fact instead, and asking again
   * only delays the error the user has to see.
   */
  const CASES: Array<{ what: string; answers: Answer[]; calls: number; settled: Outcome['settled'] }> = [
    { what: 'a good answer is taken at once', answers: [{ ok: true, status: 200 }], calls: 1, settled: 'resolved' },
    {
      what: 'a 500 is asked again, and the good answer is used',
      answers: [
        { ok: false, status: 500 },
        { ok: true, status: 200 },
      ],
      calls: 2,
      settled: 'resolved',
    },
    {
      what: 'a 503 is asked again',
      answers: [
        { ok: false, status: 503 },
        { ok: true, status: 200 },
      ],
      calls: 2,
      settled: 'resolved',
    },
    {
      what: 'a 408 is asked again',
      answers: [
        { ok: false, status: 408 },
        { ok: true, status: 200 },
      ],
      calls: 2,
      settled: 'resolved',
    },
    {
      what: 'a 429 is asked again',
      answers: [
        { ok: false, status: 429 },
        { ok: true, status: 200 },
      ],
      calls: 2,
      settled: 'resolved',
    },
    {
      what: 'a rejected fetch is asked again -- a dropped connection, an offline moment',
      answers: [new TypeError('Failed to fetch'), { ok: true, status: 200 }],
      calls: 2,
      settled: 'resolved',
    },
    { what: 'a 404 is final', answers: [{ ok: false, status: 404 }], calls: 1, settled: 'rejected' },
    { what: 'a 403 is final', answers: [{ ok: false, status: 403 }], calls: 1, settled: 'rejected' },
    { what: 'a 400 is final', answers: [{ ok: false, status: 400 }], calls: 1, settled: 'rejected' },
    {
      what: 'asking stops after three tries',
      answers: [
        { ok: false, status: 500 },
        { ok: false, status: 502 },
        { ok: false, status: 503 },
      ],
      calls: 3,
      settled: 'rejected',
    },
    {
      what: 'three rejected fetches stop too',
      answers: [new TypeError('a'), new TypeError('b'), new TypeError('c')],
      calls: 3,
      settled: 'rejected',
    },
  ];

  for (const c of CASES) {
    it(`${c.what} -- both sides`, async () => {
      const helper = loadHelper();
      const vendor = await ask(() => helper.fetchWasmResponse(), c.answers);
      const pkg = await ask(() => fetchWasmResponse('/x2t.wasm.br'), c.answers);

      const expected = { calls: c.calls, settled: c.settled };
      expect(vendor, 'x2t_helper.js').toEqual(expected);
      expect(pkg, '@ranuts/converter').toEqual(expected);
    });
  }

  /**
   * The wait between asks, which is the other half of the retry policy: too
   * short and the second ask lands in the same bad window that produced the
   * first answer.
   */
  it('waits the same amount before asking again', async () => {
    const schedule = async (run: () => Promise<unknown>): Promise<number[]> => {
      const at: number[] = [];
      let now = 0;
      const fetchSpy = vi.fn(() => {
        at.push(now);
        return Promise.resolve({ ok: false, status: 500 } as unknown as Response);
      });
      vi.stubGlobal('fetch', fetchSpy);
      // The first ask happens before any time passes; `now` is the elapsed
      // total at the end of each step, so a wait of 500 is recorded as 500.
      const done = run().catch(() => undefined);
      while (now < 4000) {
        now += 1;
        await vi.advanceTimersByTimeAsync(1);
      }
      await done;
      return at;
    };

    const helper = loadHelper();
    const vendor = await schedule(() => helper.fetchWasmResponse());
    const pkg = await schedule(() => fetchWasmResponse('/x2t.wasm.br'));

    // Linear: half a second, then a whole one. Long enough for a bad edge to
    // be replaced, short enough that a user watching a spinner does not give up.
    expect(vendor).toEqual([0, 500, 1500]);
    expect(pkg).toEqual(vendor);
  });

  /**
   * Whether the module can be compiled off the network.
   *
   * The answer decides whether the decompressed 42 MB ever exists as one
   * buffer at the moment x2t asks the browser for its 283 MB heap (GitHub
   * #144), so the two sides disagreeing here means one of them is buffering
   * where the other is not.
   */
  it.each([
    ['a browser with streaming instantiation', () => undefined, true],
    ['no WebAssembly at all', () => vi.stubGlobal('WebAssembly', undefined), false],
    ['WebAssembly without instantiateStreaming', () => vi.stubGlobal('WebAssembly', {}), false],
    [
      'instantiateStreaming that is not callable',
      () => vi.stubGlobal('WebAssembly', { instantiateStreaming: 'yes' }),
      false,
    ],
  ])('%s: both say the same', (_what, arrange, expected) => {
    const helper = loadHelper();
    arrange();
    expect(helper.canStreamWasm(), 'x2t_helper.js').toBe(expected);
    expect(canStreamWasm(), '@ranuts/converter').toBe(expected);
  });

  /**
   * The shape of the failure.
   *
   * A host classifies an open failure by reading this text: the `X2T module`
   * prefix is the entry condition, and the cause after it is what tells a
   * refused wasm heap (retry the whole editor) from a dropped download. The
   * package once wrapped everything as `Failed to load X2T WASM script`, and
   * both landed in the default branch -- reported to the user as "the file may
   * be corrupted", and never retried.
   */
  it('reports an instantiation failure in the same words', async () => {
    // The hook rethrows on purpose -- that unhandled rejection is what the
    // site's open-failure guard reads (x2t-helper-loading.test.ts covers the
    // rethrow itself). Here it must not fail this run.
    const swallow = (): void => undefined;
    process.on('unhandledRejection', swallow);
    try {
      const helper = loadHelper();
      vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.reject(new Error('boom'))),
      );
      helper.installStreamingInstantiate();
      const hook = (window as unknown as HelperWindow).Module?.instantiateWasm as (
        imports: unknown,
        ok: unknown,
      ) => unknown;
      hook({}, () => undefined);
      // Past the retries: a rejected fetch is asked again twice before the
      // hook gives up, so the failure only exists after the backoff.
      await vi.advanceTimersByTimeAsync(60_000);

      // Read where the hook parks it before rethrowing: that is the same
      // object, and it is what settles a waiting initialize().
      const fromVendor = helper.wasmInstantiateError;
      const fromPackage = x2tInstantiateError(new Error('boom'));

      expect(fromVendor, 'the hook must report the failure, not swallow it').toBeInstanceOf(Error);
      expect(fromVendor?.message).toBe('X2T module failed to instantiate: boom');
      expect(fromPackage.message).toBe(fromVendor?.message);
    } finally {
      process.off('unhandledRejection', swallow);
    }
  });

  /**
   * What each side calls a document.
   *
   * The package reads the table from @ranuts/shared; the vendor copy cannot
   * import it and carries a literal. An extension in one and not the other is
   * a format the site opens and the package refuses, or the reverse.
   */
  it('maps the same extensions to the same editors', () => {
    const literal = /this\.DOCUMENT_TYPE_MAP\s*=\s*\{([\s\S]*?)\}/.exec(HELPER_SOURCE);
    expect(literal, 'x2t_helper.js must still declare DOCUMENT_TYPE_MAP as a literal').not.toBeNull();

    const vendor: Record<string, string> = {};
    for (const [, ext, type] of (literal as RegExpExecArray)[1].matchAll(/(\w+)\s*:\s*'(\w+)'/g)) {
      vendor[ext] = type;
    }

    expect(Object.keys(vendor).length).toBeGreaterThan(10);
    expect(vendor).toEqual(DOCUMENT_TYPE_MAP);
  });

  /**
   * The two format numbers x2t is told.
   *
   * `m_nFormatTo` 513 is PDF; `m_nFormatFrom` 8196 is the canvas-rendered PDF
   * the editor hands back on export. Getting either wrong is exit code 80 with
   * no other symptom.
   */
  it('tells x2t the same format numbers', () => {
    const numberIn = (name: string): number => {
      const found = new RegExp(`const ${name} = (\\d+);`).exec(HELPER_SOURCE);
      expect(found, `x2t_helper.js must still declare ${name}`).not.toBeNull();
      return Number((found as RegExpExecArray)[1]);
    };

    expect(numberIn('PDF_OUTPUT_FORMAT')).toBe(PDF_OUTPUT_FORMAT);
    expect(numberIn('CANVAS_PDF_INPUT_FORMAT')).toBe(CANVAS_PDF_INPUT_FORMAT);
  });
});
