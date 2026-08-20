import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  classifyOpenFailure,
  installOpenFailureGuard,
  isOpenRetryInFlight,
  registerOpenAttempt,
  releaseOpenAttemptBytes,
  setOpenRunner,
} from '../../lib/onlyoffice/open-failure';
import { resetOpenState } from '../../lib/onlyoffice/open-state';

/**
 * The open-failure state machine, driven through the guard the way the vendor
 * drives it: an unhandled rejection inside the editor frame.
 *
 * Its own file because the module keeps the current attempt and the retry
 * budget at module scope, and vitest gives each test file a fresh registry.
 */

const OOM =
  'Aborted(RangeError: WebAssembly.instantiate(): Out of memory: Cannot allocate Wasm memory for new instance.)';

/** A frame that records the guard's listeners so the test can fire them. */
const fakeFrame = () => {
  const handlers: Record<string, Array<(event: unknown) => void>> = {};
  const sent: Array<[string, ...unknown[]]> = [];
  // The toast runs synchronously inside sendEvent (Common.Gateway -> onError),
  // so this is where the flag it reads has to already be correct.
  const retryInFlightAtError: boolean[] = [];
  const win = {
    addEventListener: (type: string, cb: (event: unknown) => void) => {
      (handlers[type] ??= []).push(cb);
    },
    Asc: {
      editor: {
        sendEvent: (name: string, ...args: unknown[]) => {
          sent.push([name, ...args]);
          if (name === 'asc_onError') retryInFlightAtError.push(isOpenRetryInFlight());
        },
      },
    },
  };
  return {
    win: win as unknown as Window,
    sent,
    retryInFlightAtError,
    reject: (message: string) => (handlers.unhandledrejection ?? []).forEach((cb) => cb({ reason: { message } })),
  };
};

describe('classifyOpenFailure', () => {
  it("takes x2t's own exit code as its verdict on the bytes, memory words and all", () => {
    // A document big enough to exhaust the heap mid-conversion fails with a
    // code AND the word "memory". x2t was instantiated and did read the bytes,
    // so the honest answer is `document`: rebuilding the editor changes
    // nothing, and "use a 64-bit browser" is advice about the wrong thing.
    expect(classifyOpenFailure('Document conversion failed: Error: Conversion failed with code: 88')).toBe('document');
    expect(classifyOpenFailure('Conversion failed with code: 90 (Out of memory)')).toBe('document');
  });

  it('still routes a refused wasm allocation to the retry (GitHub #144)', () => {
    // No exit code: x2t never started, so it never saw the document.
    expect(classifyOpenFailure(OOM)).toBe('environment');
  });
});

describe('the guard only claims failures that are its own', () => {
  beforeEach(() => {
    resetOpenState();
    setOpenRunner(() => Promise.resolve());
    vi.useFakeTimers();
  });

  it('takes the bare emscripten abort the vendor leaves unhandled (GitHub #144)', () => {
    registerOpenAttempt({ fileName: 'a.xlsx', fileType: 'xlsx' });
    const frame = fakeFrame();
    installOpenFailureGuard(frame.win);
    frame.reject(OOM);

    expect(isOpenRetryInFlight()).toBe(true);
  });

  it('takes an x2t that never finished instantiating, whatever stopped it', () => {
    // The streaming loader cannot report a failure by rejecting loadScript()
    // -- it has already resolved -- so it rejects out of the instantiateWasm
    // hook with an `X2T module` prefix (see the catch in
    // public/sdkjs/common/wasm/x2t/x2t_helper.js). Without that prefix only the
    // allocation refusals matched here, and a 404 or a dropped connection left
    // emscripten's success callback uncalled: the user watched the spinner
    // until doInitialize's 60 s INIT_TIMEOUT, with no toast and no retry.
    registerOpenAttempt({ fileName: 'a.xlsx', fileType: 'xlsx' });
    const frame = fakeFrame();
    installOpenFailureGuard(frame.win);
    frame.reject("X2T module failed to instantiate: Failed to fetch x2t WASM at '/sdkjs/.../x2t.wasm.gz' (404)");

    expect(isOpenRetryInFlight()).toBe(true);
  });

  it('still reads the cause through the prefix, so an OOM stays an OOM', () => {
    // The prefix decides whether the guard claims the failure; the wording
    // after it is what classifyOpenFailure and the toast read. Concatenating
    // rather than replacing is what keeps both true at once.
    const wrapped = `X2T module failed to instantiate: ${OOM}`;
    expect(classifyOpenFailure(wrapped)).toBe('environment');
  });

  it('ignores an unrelated rejection that merely says "out of memory"', () => {
    // The entry condition used to be isWasmAllocationFailure outright, whose
    // `Out of memory` arm matches any prose. Taking this branch costs a -82
    // toast and a full editor rebuild, charged to a document that was loading
    // fine -- so require the wasm/emscripten context the real refusal carries.
    registerOpenAttempt({ fileName: 'a.xlsx', fileType: 'xlsx' });
    const frame = fakeFrame();
    installOpenFailureGuard(frame.win);
    frame.reject('Upload rejected by the server: out of memory on the encoder pool');

    expect(isOpenRetryInFlight()).toBe(false);
    expect(frame.sent).toEqual([]);
  });
});

describe('a rebuild in flight suppresses the toast diagnostic', () => {
  beforeEach(() => {
    resetOpenState();
    setOpenRunner(() => Promise.resolve());
    vi.useFakeTimers();
  });

  const failOnce = (frame: ReturnType<typeof fakeFrame>, message = OOM) => {
    installOpenFailureGuard(frame.win);
    frame.reject(message);
  };

  it('is false until a retry is actually scheduled', () => {
    registerOpenAttempt({ fileName: 'a.xlsx', fileType: 'xlsx' });
    expect(isOpenRetryInFlight()).toBe(false);
  });

  it('is true while the rebuilt editor is asking for its own 283 MB', () => {
    // The vendor raises its own -82 for the same failure, so the toast can
    // fire here -- and probeX2tMemory's commit half would then be competing
    // with the very rebuild it is reporting on.
    registerOpenAttempt({ fileName: 'a.xlsx', fileType: 'xlsx' });
    failOnce(fakeFrame());
    expect(isOpenRetryInFlight()).toBe(true);
  });

  it('is false again once the retried open succeeds', () => {
    registerOpenAttempt({ fileName: 'a.xlsx', fileType: 'xlsx' });
    failOnce(fakeFrame());
    releaseOpenAttemptBytes(); // called from onDocumentReady
    expect(isOpenRetryInFlight()).toBe(false);
  });

  it('is false by the time the final failure reaches the user', () => {
    // The retry budget is spent, so this failure is going to the toast and the
    // full probe is safe: nothing else is allocating.
    registerOpenAttempt({ fileName: 'a.xlsx', fileType: 'xlsx' });
    failOnce(fakeFrame());
    vi.runAllTimers();
    resetOpenState();
    registerOpenAttempt({ fileName: 'a.xlsx', fileType: 'xlsx', isRetry: true });

    const second = fakeFrame();
    failOnce(second, OOM);
    expect(isOpenRetryInFlight()).toBe(false);
    // And it really is the terminal path: the vendor's error dialog is raised,
    // with the flag already cleared when the toast reads it.
    expect(second.sent.map(([name]) => name)).toContain('asc_onError');
    expect(second.retryInFlightAtError).toEqual([false]);
  });

  it('is cleared by a new user-initiated open', () => {
    registerOpenAttempt({ fileName: 'a.xlsx', fileType: 'xlsx' });
    failOnce(fakeFrame());
    registerOpenAttempt({ fileName: 'b.docx', fileType: 'docx' });
    expect(isOpenRetryInFlight()).toBe(false);
  });
});
