import { afterEach, expect, it, vi } from 'vitest';
import {
  appWorkerScriptURL,
  resolveAppWorkerScriptURL,
  waitForAppWorkerControl,
} from '../../lib/offline-worker-control';
afterEach(() => vi.useRealTimers());
it('waits for the application worker, ignoring unrelated controllers', async () => {
  let listener!: () => void;
  const worker = {
    controller: { scriptURL: 'https://editor.example/foreign.js' },
    addEventListener: vi.fn((_name: string, cb: () => void) => {
      listener = cb;
    }),
    removeEventListener: vi.fn(),
  };
  const pending = waitForAppWorkerControl(worker, 'https://editor.example/sw.js');
  let done = false;
  pending.then(() => {
    done = true;
  });
  listener();
  await Promise.resolve();
  expect(done).toBe(false);
  worker.controller = { scriptURL: 'https://editor.example/sw.js' };
  listener();
  expect(await pending).toBe(true);
  expect(worker.removeEventListener).toHaveBeenCalledOnce();
});
it('does not hold document opening forever if worker installation is unavailable', async () => {
  vi.useFakeTimers();
  const worker = { controller: null, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  const pending = waitForAppWorkerControl(worker, 'https://editor.example/sw.js', 100);
  await vi.advanceTimersByTimeAsync(100);
  expect(await pending).toBe(false);
  expect(worker.removeEventListener).toHaveBeenCalledOnce();
});

it('uses the isolated worker URL only when the document is isolated', () => {
  expect(appWorkerScriptURL('https://editor.example/editor.html', true)).toBe(
    'https://editor.example/sw.js?isolation=1',
  );
  expect(appWorkerScriptURL('https://editor.example/zh-CN/', false)).toBe('https://editor.example/sw.js');
});

it('selects isolation policy for an embedded document without multithread capability', async () => {
  const request = vi.fn(
    async () =>
      new Response(null, {
        headers: { 'cross-origin-opener-policy': 'same-origin', 'cross-origin-embedder-policy': 'require-corp' },
      }),
  );
  expect(
    await resolveAppWorkerScriptURL('https://editor.example/editor?file=private', false, true, request, undefined),
  ).toBe('https://editor.example/sw.js?isolation=1');
  expect(request).toHaveBeenCalledWith(
    'https://editor.example/editor',
    expect.objectContaining({ method: 'HEAD', cache: 'no-store' }),
  );
});
it('does not probe ordinary top-level pages or already isolated documents', async () => {
  const request = vi.fn();
  expect(await resolveAppWorkerScriptURL('https://editor.example/editor', false, false, request, undefined)).toBe(
    'https://editor.example/sw.js',
  );
  expect(await resolveAppWorkerScriptURL('https://editor.example/editor', true, true, request, undefined)).toBe(
    'https://editor.example/sw.js?isolation=1',
  );
  expect(request).not.toHaveBeenCalled();
});
it('keeps ordinary embedded hosting on the plain Worker', async () => {
  const request = vi.fn(async () => new Response(null));
  expect(await resolveAppWorkerScriptURL('https://editor.example/editor', false, true, request, undefined)).toBe(
    'https://editor.example/sw.js',
  );
});
it('retains the existing app isolation mode when an offline policy check fails', async () => {
  const request = vi.fn(async () => {
    throw new Error('offline');
  });
  expect(
    await resolveAppWorkerScriptURL(
      'https://editor.example/editor',
      false,
      true,
      request,
      'https://editor.example/sw.js?isolation=1',
    ),
  ).toBe('https://editor.example/sw.js?isolation=1');
  expect(
    await resolveAppWorkerScriptURL(
      'https://editor.example/editor',
      false,
      true,
      request,
      'https://editor.example/foreign.js',
    ),
  ).toBe('https://editor.example/sw.js');
});
it('bounds a stalled policy request', async () => {
  vi.useFakeTimers();
  const request = vi.fn(
    (_url: RequestInfo | URL, options?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      }),
  );
  const pending = resolveAppWorkerScriptURL('https://editor.example/editor', false, true, request, undefined);
  await vi.advanceTimersByTimeAsync(1500);
  expect(await pending).toBe('https://editor.example/sw.js');
});
