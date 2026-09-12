import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The blank editor after a Service Worker changed hands.
 *
 * Activating a worker terminates the outgoing one and fails every request it
 * still had in flight -- on this route the vendored editor's own iframe
 * document, which nothing retries. The frame stays empty, onAppReady never
 * fires, and the reader sees a white page. Caught on CI in
 * sw-silent-update.spec.ts: every request 200 except the frame's document,
 * which ends at status -1, no console error, and a white screenshot.
 *
 * lib/sw-update.ts covers the swap this page can see as a `controllerchange`;
 * this covers the one where the page already started under the new controller
 * and the casualty is a request made afterwards.
 */
const frameHtml = (childCount: number, readyState = 'complete') => ({
  name: 'frameEditor',
  src: 'http://localhost/web-apps/apps/documenteditor/main/index.html?x=1',
  contentDocument: {
    readyState,
    body: childCount < 0 ? null : { childElementCount: childCount },
  },
});

const install = (frame: unknown) => {
  const assigned: string[] = [];
  const element = frame as Record<string, unknown>;
  if (element) {
    Object.defineProperty(element, 'src', {
      configurable: true,
      get: () => (assigned.length ? assigned[assigned.length - 1] : 'http://localhost/editor-frame'),
      set: (value: string) => assigned.push(value),
    });
  }
  vi.stubGlobal('document', { querySelector: () => frame ?? null });
  return assigned;
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.resetModules();
});

const load = async () => await import('../../lib/onlyoffice/frame-watchdog');

describe('the editor frame watchdog', () => {
  it('asks for the document again when the frame stayed empty and silent', async () => {
    vi.useFakeTimers();
    const frame = frameHtml(0);
    const assigned = install(frame);
    const { watchEditorFrame } = await load();

    watchEditorFrame();
    vi.advanceTimersByTime(30_000);

    // about:blank first, so the same URL counts as a navigation.
    expect(assigned[0]).toBe('about:blank');
    expect(assigned).toHaveLength(2);
  });

  it('stands down once the frame reports ready', async () => {
    vi.useFakeTimers();
    const frame = frameHtml(0);
    const assigned = install(frame);
    const { watchEditorFrame, markEditorFrameReady } = await load();

    watchEditorFrame();
    markEditorFrameReady();
    vi.advanceTimersByTime(30_000);

    expect(assigned).toHaveLength(0);
  });

  it('leaves a frame that actually rendered something alone', async () => {
    vi.useFakeTimers();
    const assigned = install(frameHtml(3));
    const { watchEditorFrame } = await load();

    watchEditorFrame();
    vi.advanceTimersByTime(30_000);

    expect(assigned).toHaveLength(0);
  });

  it('leaves a frame still loading alone', async () => {
    vi.useFakeTimers();
    const assigned = install(frameHtml(0, 'loading'));
    const { watchEditorFrame } = await load();

    watchEditorFrame();
    vi.advanceTimersByTime(30_000);

    expect(assigned).toHaveLength(0);
  });

  it('retries once, not forever', async () => {
    vi.useFakeTimers();
    const frame = frameHtml(0);
    const assigned = install(frame);
    const { watchEditorFrame } = await load();

    watchEditorFrame();
    vi.advanceTimersByTime(30_000);
    watchEditorFrame();
    vi.advanceTimersByTime(30_000);

    expect(assigned).toHaveLength(2);
  });
});
