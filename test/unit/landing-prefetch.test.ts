import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * public/landing-prefetch.js -- the landing page's editor warm-up.
 *
 * The shipped file is evaluated here rather than reimplemented; a hand-copied
 * version would only test the copy.
 *
 * What is worth pinning down here is what happens when the visitor finally
 * clicks: the warm-up runs for the whole time the page is read, so a multi-MB
 * fetch is nearly always open at that moment, and a request the browser
 * cancels at unload is reported as an error nobody can catch -- an uncaught
 * "Fetch API cannot load <url> due to access control checks" on Safari, a
 * service worker blamed for "an unexpected error" on Firefox. Cancelling
 * first, while the page is still alive, is what keeps that quiet.
 */
type Prefetch = {
  CORE: string[];
  ENGINES: string[];
  warm: (url: string) => Promise<unknown>;
  warmSerially: (urls: string[]) => Promise<unknown>;
  stopWarming: () => void;
  isLeaving: () => boolean;
};

let prefetch: Prefetch;

const okResponse = () => ({ body: null, arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) });

/** The RequestInit `warm()` passed on call `n`. */
const initOf = (mock: { mock: { calls: unknown[][] } }, n = 0): RequestInit => mock.mock.calls[n][1] as RequestInit;

/** Come back from the back/forward cache, so later tests warm again. */
const restore = () => {
  const event = new Event('pageshow') as Event & { persisted: boolean };
  Object.defineProperty(event, 'persisted', { value: true });
  window.dispatchEvent(event);
};

beforeAll(() => {
  const src = readFileSync(resolve(__dirname, '../../public/landing-prefetch.js'), 'utf8');
  // The file is an IIFE over `window`; in jsdom that is this realm's global.
  new Function(src).call(globalThis);
  prefetch = (globalThis as unknown as { __landingPrefetch: Prefetch }).__landingPrefetch;
  expect(typeof prefetch?.warm).toBe('function');
});

describe('landing page warm-up', () => {
  it('survives a fetch that fails: the real load is just cold', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline'))),
    );
    await expect(prefetch.warm('/rejects.js')).resolves.toBeUndefined();
    vi.unstubAllGlobals();
  });

  it('hands every request an abort signal', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(okResponse()));
    vi.stubGlobal('fetch', fetchMock);
    await prefetch.warm('/signalled.js');
    const init = initOf(fetchMock);
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.signal!.aborted).toBe(false);
    vi.unstubAllGlobals();
  });

  /**
   * Reverse-verified: with the unload listeners removed, the queued file below
   * is still requested and the in-flight signal never aborts -- which is
   * precisely the state that produces the uncaught errors.
   */
  it('cancels in flight requests and stops queueing new ones once the page is leaving', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(okResponse()));
    vi.stubGlobal('fetch', fetchMock);
    await prefetch.warm('/in-flight.js');
    const init = initOf(fetchMock);

    window.dispatchEvent(new Event('beforeunload'));
    expect(prefetch.isLeaving()).toBe(true);
    expect(init.signal!.aborted, 'the open request is cancelled while the page can still handle it').toBe(true);

    fetchMock.mockClear();
    await prefetch.warmSerially(['/queued-a.js', '/queued-b.js']);
    expect(fetchMock, 'nothing new is started for a page that is going away').not.toHaveBeenCalled();

    restore();
    expect(prefetch.isLeaving()).toBe(false);
    await prefetch.warm('/after-restore.js');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('picks the warm-up back up after a navigation that never happened', () => {
    // beforeunload also fires for an external scheme, a download link, an
    // unload the visitor cancels. They are still reading the page, so any sign
    // of life has to undo the stop -- otherwise it is a one-way door and the
    // editor they open next is cold for no reason.
    window.dispatchEvent(new Event('beforeunload'));
    expect(prefetch.isLeaving()).toBe(true);
    window.dispatchEvent(new Event('pointerdown'));
    expect(prefetch.isLeaving()).toBe(false);
  });

  it('exposes a core list the service worker serves cache-first', () => {
    // Everything warmed has to be under a tree sw.js treats as vendor content,
    // or the bytes land in the HTTP cache only and the second visit is not free.
    for (const url of prefetch.CORE) expect(url).toMatch(/^\/(?:sdkjs|web-apps|fonts)\//);
    expect(prefetch.ENGINES).toEqual(['docx', 'xlsx', 'pptx']);
  });
});
