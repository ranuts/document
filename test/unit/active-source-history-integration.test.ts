import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { rememberActiveSource, readActiveSource } from '../../lib/active-document-source';
import { resetHistoryDbForTests } from '../../lib/history/db';
import { putSnapshot, deleteDoc, clearAllHistory, getDoc, resetHistoryClockForTests } from '../../lib/history/store';

beforeEach(() => {
  resetHistoryDbForTests();
  resetHistoryClockForTests();
  vi.stubGlobal('indexedDB', new IDBFactory());
  sessionStorage.clear();
});
afterEach(() => {
  resetHistoryDbForTests();
  vi.unstubAllGlobals();
});
const original = () => new File(['original'], 'Original.docx', { type: 'application/test', lastModified: 12 });

describe('history deletion and active originals', () => {
  it('forgets an active original when its history document is explicitly deleted', async () => {
    const doc = await putSnapshot({
      id: 'doc-a',
      title: 'Original.docx',
      origin: 'local',
      bytes: new Uint8Array([1, 2, 3]),
    });
    expect(doc).not.toBeNull();
    await rememberActiveSource('doc-a', original());
    expect(await deleteDoc('doc-a')).toBe(true);
    expect(await getDoc('doc-a')).toBeNull();
    expect(await readActiveSource('doc-a')).toBeNull();
  });

  it('clears active originals even when no history snapshot exists', async () => {
    await rememberActiveSource('doc-a', original());
    expect(await getDoc('doc-a')).toBeNull();
    expect(await clearAllHistory()).toBe(true);
    expect(await readActiveSource('doc-a')).toBeNull();
  });

  it('does not report complete deletion when temporary source storage is unavailable', async () => {
    await rememberActiveSource('doc-a', original());
    const open = indexedDB.open.bind(indexedDB);
    vi.spyOn(indexedDB, 'open').mockImplementation((name, version) => {
      if (name === 'document-active-sources') throw new Error('source storage denied');
      return open(name, version);
    });
    expect(await clearAllHistory()).toBe(false);
  });
});
