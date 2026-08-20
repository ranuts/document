import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * public/sw-register.js -- the landing pages' service-worker update policy.
 *
 * This is the half that went missing when the route split moved the landing
 * page to `/` with no editor bundle: lib/sw-update.ts was left running only on
 * `/editor`, where the open starts before the registration resolves, so a
 * waiting worker was never promoted and a deploy never reached a returning
 * visitor without closing every tab of the site.
 *
 * The shipped file is evaluated here rather than reimplemented -- sw-routing.
 * test.ts keeps a hand-synced copy of sw.js's routing rules, and a copy that
 * drifts tests nothing.
 */
type Updater = {
  start: () => Promise<unknown>;
  wire: (registration: unknown) => void;
  maybePromote: (registration: unknown) => Promise<boolean>;
  countClients: () => Promise<number | null>;
};
type CreateUpdater = (nav: unknown, options?: { timeoutMs?: number }) => Updater;

let createSwUpdater: CreateUpdater;

beforeAll(() => {
  const src = readFileSync(resolve(__dirname, '../../public/sw-register.js'), 'utf8');
  // The file is an IIFE over `window`; in jsdom that is this realm's global.
  new Function(src).call(globalThis);
  createSwUpdater = (globalThis as unknown as { __createSwUpdater: CreateUpdater }).__createSwUpdater;
  expect(typeof createSwUpdater).toBe('function');
});

/** A worker the page can post to, recording what it was told. */
const fakeWorker = () => {
  const posted: unknown[] = [];
  return { posted, postMessage: (msg: unknown) => posted.push(msg) };
};

/**
 * A controller that answers CLIENT_COUNT over the transferred port, like
 * public/sw.js does. `count: null` models a worker that never answers;
 * `editors` defaults to none, i.e. only landing tabs are open.
 */
const fakeController = (count: number | null, editors = 0) => ({
  postMessage: (_msg: unknown, transfer?: MessagePort[]) => {
    const port = transfer?.[0];
    if (!port || count === null) return;
    port.postMessage({ type: 'CLIENT_COUNT', count, editors });
  },
});

/** A worker from before the reply carried `editors` (the previous deploy). */
const legacyController = (count: number) => ({
  postMessage: (_msg: unknown, transfer?: MessagePort[]) => {
    transfer?.[0]?.postMessage({ type: 'CLIENT_COUNT', count });
  },
});

const fakeRegistration = (waiting: ReturnType<typeof fakeWorker> | null) => {
  const listeners: Record<string, Array<() => void>> = {};
  return {
    waiting,
    installing: null as null | { state: string; addEventListener: (t: string, cb: () => void) => void },
    addEventListener: (type: string, cb: () => void) => {
      (listeners[type] ??= []).push(cb);
    },
    emit: (type: string) => (listeners[type] ?? []).forEach((cb) => cb()),
  };
};

const navWith = (controller: unknown, register?: () => Promise<unknown>) => ({
  serviceWorker: {
    controller,
    register: register ?? vi.fn().mockResolvedValue(undefined),
  },
});

describe('countClients', () => {
  it('asks the active worker and reports its answer', async () => {
    const updater = createSwUpdater(navWith(fakeController(1)));
    await expect(updater.countClients()).resolves.toMatchObject({ count: 1, editors: 0 });
  });

  it('answers null when there is no controller (nothing has ever activated)', async () => {
    const updater = createSwUpdater(navWith(null));
    await expect(updater.countClients()).resolves.toBeNull();
  });

  it('answers null instead of hanging when the worker never replies', async () => {
    vi.useFakeTimers();
    try {
      const updater = createSwUpdater(navWith(fakeController(null)), { timeoutMs: 50 });
      const pending = updater.countClients();
      await vi.advanceTimersByTimeAsync(50);
      await expect(pending).resolves.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('maybePromote', () => {
  it('promotes the waiting worker when this tab is the only one', async () => {
    const waiting = fakeWorker();
    const updater = createSwUpdater(navWith(fakeController(1)));
    await expect(updater.maybePromote(fakeRegistration(waiting))).resolves.toBe(true);
    expect(waiting.posted).toEqual([{ type: 'SKIP_WAITING' }]);
  });

  it('refuses while a window is on the editor route (it could have a document open)', async () => {
    // Activation deletes the outgoing build's caches; that tab would then
    // lazy-load the new build's vendor pieces into an old session.
    const waiting = fakeWorker();
    const updater = createSwUpdater(navWith(fakeController(2, 1)));
    await expect(updater.maybePromote(fakeRegistration(waiting))).resolves.toBe(false);
    expect(waiting.posted).toEqual([]);
  });

  it('promotes with a second LANDING tab open -- it has no session to lose', async () => {
    // Refusing on any second window is what left a reader who keeps two tabs
    // of the site open on an old build indefinitely.
    const waiting = fakeWorker();
    const updater = createSwUpdater(navWith(fakeController(2, 0)));
    await expect(updater.maybePromote(fakeRegistration(waiting))).resolves.toBe(true);
    expect(waiting.posted).toEqual([{ type: 'SKIP_WAITING' }]);
  });

  it('falls back to "am I alone" against a worker whose reply predates editors', async () => {
    const waiting = fakeWorker();
    const alone = createSwUpdater(navWith(legacyController(1)));
    await expect(alone.maybePromote(fakeRegistration(waiting))).resolves.toBe(true);

    const crowded = createSwUpdater(navWith(legacyController(2)));
    await expect(crowded.maybePromote(fakeRegistration(fakeWorker()))).resolves.toBe(false);
  });

  it('refuses when the client count is unknown', async () => {
    const waiting = fakeWorker();
    const updater = createSwUpdater(navWith(null));
    await expect(updater.maybePromote(fakeRegistration(waiting))).resolves.toBe(false);
    expect(waiting.posted).toEqual([]);
  });

  it('is a no-op with nothing waiting', async () => {
    const updater = createSwUpdater(navWith(fakeController(1)));
    await expect(updater.maybePromote(fakeRegistration(null))).resolves.toBe(false);
  });
});

describe('wire', () => {
  /** A worker mid-install whose statechange listener the test can fire. */
  const fakeInstalling = (state: string) => {
    let onStateChange = () => {};
    return {
      worker: {
        state,
        addEventListener: (_type: string, cb: () => void) => {
          onStateChange = cb;
        },
      },
      change: () => onStateChange(),
    };
  };

  it('promotes a worker that finishes installing after the page loaded', async () => {
    const waiting = fakeWorker();
    const registration = fakeRegistration(null);
    const updater = createSwUpdater(navWith(fakeController(1)));
    updater.wire(registration);

    let onStateChange = () => {};
    registration.installing = {
      state: 'installing',
      addEventListener: (_type, cb) => {
        onStateChange = cb;
      },
    };
    registration.emit('updatefound');
    // Installed: the worker is now the waiting one.
    registration.installing.state = 'installed';
    registration.waiting = waiting;
    onStateChange();
    await vi.waitFor(() => expect(waiting.posted).toEqual([{ type: 'SKIP_WAITING' }]));
  });

  // `statechange` only fires for transitions from here on. A worker that
  // reached `installed` before the listener existed used to be dropped on the
  // floor for the rest of the page's life -- the exact symptom this file was
  // written to fix, in the sessions most likely to hit it (a fast install, or
  // an update found during registration itself).
  it('promotes a worker that was already installed when the event arrived', async () => {
    const waiting = fakeWorker();
    const registration = fakeRegistration(null);
    const updater = createSwUpdater(navWith(fakeController(1)));
    updater.wire(registration);

    // Installed by the time the handler looks: no further statechange is coming.
    registration.installing = fakeInstalling('installed').worker;
    registration.waiting = waiting;
    registration.emit('updatefound');
    await vi.waitFor(() => expect(waiting.posted).toEqual([{ type: 'SKIP_WAITING' }]));
  });

  it('promotes when the install finished before updatefound was handled at all', async () => {
    // installing is already null: the worker moved on to `waiting`.
    const waiting = fakeWorker();
    const registration = fakeRegistration(null);
    const updater = createSwUpdater(navWith(fakeController(1)));
    updater.wire(registration);

    registration.waiting = waiting;
    registration.emit('updatefound');
    await vi.waitFor(() => expect(waiting.posted).toEqual([{ type: 'SKIP_WAITING' }]));
  });

  it('picks up an install already in flight when wire() runs', async () => {
    // register() resolves after the browser has found the update, so
    // `updatefound` can fire before .then(wire) ever attaches a listener.
    const waiting = fakeWorker();
    const registration = fakeRegistration(null);
    const installing = fakeInstalling('installing');
    registration.installing = installing.worker;

    const updater = createSwUpdater(navWith(fakeController(1)));
    updater.wire(registration);

    installing.worker.state = 'installed';
    registration.waiting = waiting;
    installing.change();
    await vi.waitFor(() => expect(waiting.posted).toEqual([{ type: 'SKIP_WAITING' }]));
  });
});

describe('start', () => {
  it('registers an absolute /sw.js so /zh-CN/ does not scope the worker to itself', async () => {
    const register = vi.fn().mockResolvedValue(fakeRegistration(null));
    await createSwUpdater(navWith(fakeController(1), register)).start();
    expect(register).toHaveBeenCalledWith('/sw.js');
  });

  it('survives a registration that fails (the landing page works without it)', async () => {
    const register = vi.fn().mockRejectedValue(new Error('no'));
    await expect(createSwUpdater(navWith(null, register)).start()).resolves.toBeUndefined();
  });
});

describe('the landing pages carry the policy', () => {
  const read = (rel: string) => readFileSync(resolve(__dirname, '../..', rel), 'utf8');

  // Both locale homepages are entry points; `/zh-CN/` used to register no
  // worker at all, so a visitor who started there never got a new build.
  it.each(['index.html', 'public/zh-CN/index.html'])('%s loads sw-register.js', (page) => {
    expect(read(page)).toContain('src="/sw-register.js"');
  });

  it('leaves no page registering the worker without the update policy', () => {
    // An inline `register()` with no promotion is what silently pinned users
    // to an old build for four days on GitHub #144.
    for (const page of ['index.html', 'public/zh-CN/index.html']) {
      expect(read(page)).not.toMatch(/serviceWorker\s*\.\s*register/);
    }
  });

  it('sw.js answers the client-count query the policy depends on', () => {
    const sw = read('public/sw.js');
    expect(sw).toContain("type === 'CLIENT_COUNT'");
    expect(sw).toContain("self.clients.matchAll({ type: 'window' })");
    // The half the decision is actually made on: an editor window blocks
    // promotion, a second landing tab does not.
    expect(sw).toContain('isEditorWindow(client.url)');
    expect(sw).toMatch(/const EDITOR_ROUTE = /);
  });
});
