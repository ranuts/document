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

const okResponse = () => ({
  body: null as ReadableStream<Uint8Array> | null,
  arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
});

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

describe('landing warm-up during a worker upgrade', () => {
  function setup(effectiveType?: string) {
    const src = readFileSync(resolve(__dirname, '../../public/landing-prefetch.js'), 'utf8');
    const win = Object.assign(new EventTarget(), {
      requestIdleCallback: (callback: () => void) => callback(),
      __landingPrefetch: undefined as Prefetch | undefined,
    });
    const cta = new EventTarget();
    const doc = Object.assign(new EventTarget(), { getElementById: () => cta, querySelectorAll: () => [] });
    const registration = Object.assign(new EventTarget(), {
      waiting: null as (EventTarget & { state: string; scriptURL?: string }) | null,
      installing: null as (EventTarget & { state: string }) | null,
    });
    const workers = Object.assign(new EventTarget(), { ready: Promise.resolve(registration) });
    const fetchMock = vi.fn((_url: string, _init?: RequestInit) => Promise.resolve(okResponse()));
    new Function('window', 'document', 'navigator', 'fetch', 'AbortController', src)(
      win,
      doc,
      { serviceWorker: workers, connection: { effectiveType } },
      fetchMock,
      AbortController,
    );
    return { win, doc, cta, registration, workers, fetchMock, hook: win.__landingPrefetch! };
  }

  it('holds a waiting upgrade without poisoning URLs, then warms after controllerchange', async () => {
    const { registration, workers, win, hook, fetchMock } = setup();
    registration.waiting = Object.assign(new EventTarget(), { state: 'installed' });
    await hook.warm('/waiting-upgrade.js');
    win.dispatchEvent(new Event('pointerdown'));
    await hook.warm('/waiting-upgrade.js');
    expect(fetchMock).not.toHaveBeenCalled();
    registration.waiting = null;
    workers.dispatchEvent(new Event('controllerchange'));
    await hook.warm('/waiting-upgrade.js');
    expect(fetchMock.mock.calls.some(([url]) => url === '/waiting-upgrade.js')).toBe(true);
  });

  it('cancels current warming on updatefound and holds queued requests', async () => {
    const { registration, hook, fetchMock } = setup();
    await hook.warm('/before-install.js');
    const signal = initOf(fetchMock).signal!;
    registration.installing = Object.assign(new EventTarget(), { state: 'installing' });
    registration.dispatchEvent(new Event('updatefound'));
    expect(signal.aborted).toBe(true);
    await hook.warmSerially(['/during-install-a.js', '/during-install-b.js']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(hook.isLeaving()).toBe(false);
  });

  it('recovers from a failed install but does not resume a page that is leaving', async () => {
    const { registration, win, hook, fetchMock } = setup();
    const installing = Object.assign(new EventTarget(), { state: 'installing' });
    registration.installing = installing;
    await hook.warm('/failed-install.js');
    expect(fetchMock).not.toHaveBeenCalled();
    installing.state = 'redundant';
    installing.dispatchEvent(new Event('statechange'));
    await hook.warm('/failed-install.js');
    expect(fetchMock.mock.calls.some(([url]) => url === '/failed-install.js')).toBe(true);
    win.dispatchEvent(new Event('beforeunload'));
    fetchMock.mockClear();
    await hook.warm('/leaving-upgrade.js');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not hold warming for the native editor stub worker that the updater will not promote', async () => {
    const { registration, hook, fetchMock } = setup();
    registration.waiting = Object.assign(new EventTarget(), {
      state: 'installed',
      scriptURL: 'https://example.test/document_editor_service_worker.js',
    });
    await hook.warm('/foreign-waiting-worker.js');
    expect(fetchMock.mock.calls.some(([url]) => url === '/foreign-waiting-worker.js')).toBe(true);
  });

  it('restores a paused hover intent on 3G, where background warming is disabled', async () => {
    const { doc, cta, registration, workers, fetchMock } = setup('3g');
    registration.waiting = Object.assign(new EventTarget(), { state: 'installed' });
    doc.dispatchEvent(new Event('DOMContentLoaded'));
    cta.dispatchEvent(new Event('pointerenter'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchMock).not.toHaveBeenCalled();
    registration.waiting = null;
    workers.dispatchEvent(new Event('controllerchange'));
    await vi.waitFor(() =>
      expect(fetchMock.mock.calls.some(([url]) => url === '/web-apps/apps/api/documents/api.js')).toBe(true),
    );
    expect(fetchMock.mock.calls.some(([url]) => url.includes('x2t.wasm'))).toBe(false);
  });

  it('automatically recovers when the initially waiting worker becomes redundant', async () => {
    const { registration, hook, fetchMock } = setup();
    const waiting = Object.assign(new EventTarget(), { state: 'installed' });
    registration.waiting = waiting;
    await hook.warm('/initially-waiting.js');
    expect(fetchMock).not.toHaveBeenCalled();
    waiting.state = 'redundant';
    waiting.dispatchEvent(new Event('statechange'));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
  });

  it('retries an intent whose response stream is cancelled by an upgrade', async () => {
    const { doc, cta, registration, workers, fetchMock } = setup('3g');
    fetchMock.mockImplementationOnce((_url, init) =>
      Promise.resolve({
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            init?.signal?.addEventListener('abort', () => controller.error(new Error('upgrade aborted warming')));
          },
        }),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      }),
    );
    doc.dispatchEvent(new Event('DOMContentLoaded'));
    cta.dispatchEvent(new Event('pointerenter'));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const installing = Object.assign(new EventTarget(), { state: 'installing' });
    registration.installing = installing;
    registration.dispatchEvent(new Event('updatefound'));
    expect(initOf(fetchMock).signal!.aborted).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    registration.installing = null;
    workers.dispatchEvent(new Event('controllerchange'));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(initOf(fetchMock, 1).signal!.aborted).toBe(false);
  });

  it('does not restart a retained intent when controllerchange follows beforeunload', async () => {
    const { doc, cta, registration, workers, win, fetchMock } = setup('3g');
    registration.waiting = Object.assign(new EventTarget(), { state: 'installed' });
    doc.dispatchEvent(new Event('DOMContentLoaded'));
    cta.dispatchEvent(new Event('pointerenter'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    win.dispatchEvent(new Event('beforeunload'));
    registration.waiting = null;
    workers.dispatchEvent(new Event('controllerchange'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchMock).not.toHaveBeenCalled();
    const restored = new Event('pageshow');
    Object.defineProperty(restored, 'persisted', { value: true });
    win.dispatchEvent(restored);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });
});
