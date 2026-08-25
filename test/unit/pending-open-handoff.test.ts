import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { stashPendingFile, takePendingFile } from '../../lib/pending-open';

/**
 * The landing-page handoff, both halves at once.
 *
 * public/open-local.js writes the record and lib/pending-open.ts reads it, and
 * they are separate files by necessity: the static landing pages do not ship
 * the app bundle. So the shape of what is stored is a contract between two
 * files with nothing but a comment holding them together -- this drives the
 * shipped writer and the shipped reader against one database and pins it.
 *
 * The invariant with teeth is that a refusal to store the File is survived.
 * Safari will not structured-clone a File or a Blob into IndexedDB -- the put
 * is accepted and the transaction then fails with a null error -- so the
 * handoff was broken outright there: the landing page took its "IndexedDB
 * unavailable" fallback and the visitor arrived at an empty editor, having
 * just picked a document. The writer now falls back to the bytes.
 *
 * fake-indexeddb refuses a File in the same way, so every test below takes
 * that fallback. The by-reference path is the one Chromium and Firefox take,
 * and it is covered where it is real: entry-paths.spec.ts drives this same
 * handoff through the shipped landing page on all three engines.
 */
type OpenLocal = {
  stashFile: (file: File) => Promise<void>;
  DB_NAME: string;
  STORE: string;
  KEY: string;
};

let openLocal: OpenLocal;

beforeAll(() => {
  const src = readFileSync(resolve(__dirname, '../../public/open-local.js'), 'utf8');
  // The file is an IIFE over `window`; in jsdom that is this realm's global.
  new Function(src).call(globalThis);
  openLocal = (globalThis as unknown as { __openLocal: OpenLocal }).__openLocal;
  expect(typeof openLocal?.stashFile).toBe('function');
});

/** Whatever is sitting under the handoff key right now, untouched. */
const peek = (): Promise<unknown> =>
  new Promise((done, fail) => {
    const req = indexedDB.open(openLocal.DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(openLocal.STORE);
    req.onerror = () => fail(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const get = db.transaction(openLocal.STORE, 'readonly').objectStore(openLocal.STORE).get(openLocal.KEY);
      get.onsuccess = () => {
        db.close();
        done(get.result);
      };
      get.onerror = () => {
        db.close();
        fail(get.error);
      };
    };
  });

const sample = () =>
  new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x11])], '落地页交接.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    lastModified: 1_700_000_000_000,
  });

describe('landing page -> editor file handoff', () => {
  it('the landing page writes what the app reads back, name and bytes intact', async () => {
    await openLocal.stashFile(sample());

    const taken = await takePendingFile();
    expect(taken).toBeInstanceOf(File);
    expect(taken!.name).toBe('落地页交接.docx');
    expect(taken!.type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(taken!.lastModified).toBe(1_700_000_000_000);
    expect([...new Uint8Array(await taken!.arrayBuffer())]).toEqual([0x50, 0x4b, 0x03, 0x04, 0x11]);
  });

  it('falls back to plain bytes when the engine will not store a File', async () => {
    await openLocal.stashFile(sample());
    const stored = await peek();
    expect(stored).not.toBeInstanceOf(Blob);
    expect(stored).toMatchObject({ name: '落地页交接.docx' });
    await takePendingFile();
  });

  it('the app half stores the same shape when it does the stashing (the /history route)', async () => {
    expect(await stashPendingFile(sample())).toBe(true);
    const stored = await peek();
    expect(stored).not.toBeInstanceOf(Blob);
    const taken = await takePendingFile();
    expect(taken!.name).toBe('落地页交接.docx');
  });

  it('is one-shot: a reload of `?open=local` finds nothing left', async () => {
    await openLocal.stashFile(sample());
    expect(await takePendingFile()).toBeInstanceOf(File);
    expect(await takePendingFile()).toBeNull();
  });
});
