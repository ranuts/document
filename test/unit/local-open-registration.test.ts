import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const swSource = readFileSync(resolve(__dirname, '../../public/sw-register.js'), 'utf8');
const openSource = readFileSync(resolve(__dirname, '../../public/open-local.js'), 'utf8');

// Exercise both shipped scripts and the real stash; only browser registration
// and navigation/timers are controlled. Removing the consumer wait must fail.
function landing(options: { noWorker?: boolean; noLoad?: boolean; failedStash?: boolean } = {}) {
  const doc = document.implementation.createHTMLDocument();
  doc.body.innerHTML = '<button data-open-local="/editor?locale=zh-CN&open=local">Open</button>';
  let settle!: (value?: unknown) => void;
  let reject!: (reason: Error) => void;
  const registration = new Promise((yes, no) => {
    settle = yes;
    reject = no;
  });
  const register = vi.fn(() => registration);
  const timers = new Map<number, { run: () => void; ms: number }>();
  let nextTimer = 0;
  let load = () => {};
  const host = {
    navigator: options.noWorker ? {} : { serviceWorker: { register, controller: null } },
    addEventListener: (_type: string, cb: () => void) => {
      load = cb;
    },
    setTimeout: (run: () => void, ms: number) => {
      const id = ++nextTimer;
      timers.set(id, { run, ms });
      return id;
    },
    clearTimeout: (id: number) => {
      timers.delete(id);
    },
  };
  const location = { href: '/' };
  const db = options.failedStash
    ? {
        open: () => {
          throw new Error('IDB unavailable');
        },
      }
    : new IDBFactory();
  new Function('window', swSource)(host);
  new Function('window', 'document', 'location', 'indexedDB', openSource)(host, doc, location, db);
  doc.dispatchEvent(new Event('DOMContentLoaded'));
  if (!options.noLoad) load();
  const input = doc.querySelector('input')!;
  const picker = vi.spyOn(input, 'click').mockImplementation(() => {});
  doc.querySelector('button')!.click();
  expect(picker).toHaveBeenCalledTimes(1); // synchronous activation, before any await
  Object.defineProperty(input, 'files', { value: [new File(['picked bytes'], 'picked.docx')] });
  const select = () => input.dispatchEvent(new Event('change'));
  return { select, location, timers, settle, reject, register, db };
}

async function waitAtHandoff(page: ReturnType<typeof landing>) {
  await vi.waitFor(() => {
    // Either waiting correctly or departed too early: do not turn the old
    // bug into a timeout instead of the navigation assertion below.
    expect(page.timers.size > 0 || page.location.href !== '/').toBe(true);
  });
}

describe('local file navigation and landing registration', () => {
  it('commits the file but stays on Home until the existing registration settles', async () => {
    const page = landing();
    page.select();
    await waitAtHandoff(page);
    expect(page.location.href).toBe('/');
    expect(page.register).toHaveBeenCalledTimes(1);
    page.settle();
    await vi.waitFor(() => expect(page.location.href).toBe('/editor?locale=zh-CN&open=local'));
    expect(page.timers.size).toBe(0);
    const stored = await new Promise<unknown>((done, fail) => {
      const request = page.db.open('document-handoff', 1);
      request.onerror = () => fail(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const read = db.transaction('files').objectStore('files').get('pending');
        read.onsuccess = () => {
          db.close();
          done(read.result);
        };
      };
    });
    expect(stored).toMatchObject({ name: 'picked.docx', bytes: new TextEncoder().encode('picked bytes') });
  });

  it('opens the committed file when registration rejects and clears the wait timer', async () => {
    const page = landing();
    page.select();
    await waitAtHandoff(page);
    expect(page.location.href).toBe('/');
    page.reject(new Error('Registration denied'));
    await vi.waitFor(() => expect(page.location.href).toBe('/editor?locale=zh-CN&open=local'));
    expect(page.timers.size).toBe(0);
  });

  it('opens within one second even if registration never settles', async () => {
    const page = landing();
    page.select();
    await waitAtHandoff(page);
    expect(page.location.href).toBe('/');
    expect(page.timers.size).toBe(1);
    const timer = [...page.timers.values()][0];
    expect(timer.ms).toBeGreaterThan(0);
    expect(timer.ms).toBeLessThanOrEqual(1000);
    timer.run();
    await vi.waitFor(() => expect(page.location.href).toBe('/editor?locale=zh-CN&open=local'));
    expect(page.timers.size).toBe(0);
  });

  it.each([{ noWorker: true }, { noLoad: true }])(
    'opens without waiting when no registration has started: %j',
    async (options) => {
      const page = landing(options);
      page.select();
      await vi.waitFor(() => expect(page.location.href).toBe('/editor?locale=zh-CN&open=local'));
      expect(page.timers.size).toBe(0);
      expect(page.register).not.toHaveBeenCalled();
    },
  );

  it('does not delay an already settled registration', async () => {
    const page = landing();
    page.settle();
    await vi.waitFor(() => expect(page.register).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 0));
    page.select();
    await vi.waitFor(() => expect(page.location.href).toBe('/editor?locale=zh-CN&open=local'));
    expect(page.timers.size).toBe(0);
  });

  it('preserves the empty-editor fallback after stash failure while bounding the same registration wait', async () => {
    const page = landing({ failedStash: true });
    page.select();
    await waitAtHandoff(page);
    expect(page.location.href).toBe('/');
    page.settle();
    await vi.waitFor(() => expect(page.location.href).toBe('/editor?locale=zh-CN'));
    expect(page.timers.size).toBe(0);
  });
});
