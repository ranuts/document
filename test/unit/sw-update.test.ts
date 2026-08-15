import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  type SwLike,
  SKIP_WAITING_MESSAGE,
  promoteWaitingWorker,
  shouldReloadOnControllerChange,
  wireServiceWorkerUpdates,
} from '../../lib/sw-update';

/**
 * Deploy-while-editing safety (matrix section C, "SW 缓存旧构建 -> 升级").
 * A new build's worker must not take over while a document is open: it would
 * delete the old build's caches and the still-running old page would lazy-load
 * new-build pieces into its session (mixed-version editor).
 */
type FakeWorker = SwLike & {
  postMessage: ReturnType<typeof vi.fn<(msg: unknown) => unknown>>;
  listeners: Array<() => void>;
};
const worker = (state = 'installed'): FakeWorker => {
  const w: FakeWorker = {
    state,
    postMessage: vi.fn<(msg: unknown) => unknown>(),
    listeners: [],
    addEventListener: (_t, cb) => {
      w.listeners.push(cb);
    },
  };
  return w;
};
const registration = (waiting: ReturnType<typeof worker> | null = null) => {
  const r = {
    waiting: waiting as SwLike | null,
    installing: null as SwLike | null,
    updateListeners: [] as Array<() => void>,
    addEventListener: (_t: 'updatefound', cb: () => void) => {
      r.updateListeners.push(cb);
    },
  };
  return r;
};

describe('promoteWaitingWorker', () => {
  it('sends SKIP_WAITING to a waiting worker when no document is open', () => {
    const w = worker();
    expect(promoteWaitingWorker(registration(w), () => false)).toBe(true);
    expect(w.postMessage).toHaveBeenCalledWith(SKIP_WAITING_MESSAGE);
  });

  it('never promotes while a document is open', () => {
    const w = worker();
    expect(promoteWaitingWorker(registration(w), () => true)).toBe(false);
    expect(w.postMessage).not.toHaveBeenCalled();
  });

  it('is a no-op without a waiting worker', () => {
    expect(promoteWaitingWorker(registration(null), () => false)).toBe(false);
  });
});

describe('wireServiceWorkerUpdates', () => {
  it('promotes a worker that finishes installing later (landing page, nothing open)', () => {
    const r = registration();
    wireServiceWorkerUpdates(r, () => false);
    const w = worker('installing');
    r.installing = w;
    r.updateListeners.forEach((cb) => cb());
    w.state = 'installed';
    r.waiting = w;
    w.listeners.forEach((cb) => cb());
    expect(w.postMessage).toHaveBeenCalledWith(SKIP_WAITING_MESSAGE);
  });

  it('leaves the new worker waiting while a document is open', () => {
    const r = registration();
    wireServiceWorkerUpdates(r, () => true);
    const w = worker('installing');
    r.installing = w;
    r.updateListeners.forEach((cb) => cb());
    w.state = 'installed';
    r.waiting = w;
    w.listeners.forEach((cb) => cb());
    expect(w.postMessage).not.toHaveBeenCalled();
  });
});

describe('shouldReloadOnControllerChange', () => {
  it('reloads once on an update with nothing open', () => {
    expect(
      shouldReloadOnControllerChange({ hadController: true, alreadyReloading: false, hasOpenDocument: false }),
    ).toBe(true);
  });
  it('does not reload on first install, twice, or with a document open', () => {
    expect(
      shouldReloadOnControllerChange({ hadController: false, alreadyReloading: false, hasOpenDocument: false }),
    ).toBe(false);
    expect(
      shouldReloadOnControllerChange({ hadController: true, alreadyReloading: true, hasOpenDocument: false }),
    ).toBe(false);
    expect(
      shouldReloadOnControllerChange({ hadController: true, alreadyReloading: false, hasOpenDocument: true }),
    ).toBe(false);
  });
});

describe('public/sw.js keeps the waiting contract', () => {
  const src = readFileSync(resolve(__dirname, '../../public/sw.js'), 'utf8');
  it('does not skipWaiting on install and honors the SKIP_WAITING message', () => {
    const install = src
      .slice(src.indexOf("addEventListener('install'"), src.indexOf("addEventListener('message'"))
      .replace(/\/\/.*$/gm, '');
    expect(install).not.toMatch(/skipWaiting\(\)/);
    expect(src).toMatch(/type === 'SKIP_WAITING'[\s\S]*skipWaiting\(\)/);
  });
});
