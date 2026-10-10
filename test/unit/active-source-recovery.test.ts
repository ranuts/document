import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const { opened } = vi.hoisted(() => ({ opened: vi.fn(async (_file: File, _options?: unknown) => {}) }));
vi.mock('../../lib/document', () => ({ openLocalFile: opened }));
import { rememberActiveSource, readActiveSource } from '../../lib/active-document-source';
import { resetHistoryDbForTests } from '../../lib/history/db';
import { getDoc, putSnapshot, resetHistoryClockForTests } from '../../lib/history/store';
import { restoreSavedDocument } from '../../lib/history/recovery';

beforeEach(() => {
  resetHistoryDbForTests();
  resetHistoryClockForTests();
  vi.stubGlobal('indexedDB', new IDBFactory());
  sessionStorage.clear();
  opened.mockClear();
});
afterEach(() => {
  resetHistoryDbForTests();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const original = () => new File(['original bytes'], 'Original.docx', { type: 'application/test', lastModified: 12 });
describe('saved-route recovery source precedence', () => {
  it('restores an unedited active file without creating a history row', async () => {
    await rememberActiveSource('doc-a', original());
    expect(await restoreSavedDocument('doc-a')).toBe(true);
    const [file, options] = opened.mock.calls[0];
    expect(await file.text()).toBe('original bytes');
    expect(file.name).toBe('Original.docx');
    expect(file.type).toBe('application/test');
    expect(file.lastModified).toBe(12);
    expect(options).toEqual({ historyId: 'doc-a' });
    expect(await getDoc('doc-a')).toBeNull();
  });
  it('always restores the newest stored revision ahead of the active original', async () => {
    await rememberActiveSource('doc-a', original());
    await putSnapshot({
      id: 'doc-a',
      title: 'Edited.docx',
      origin: 'local',
      bytes: new Uint8Array([101, 100, 105, 116, 32, 111, 110, 101]),
    });
    await putSnapshot({
      id: 'doc-a',
      title: 'Edited.docx',
      origin: 'local',
      bytes: new Uint8Array([101, 100, 105, 116, 32, 116, 119, 111]),
    });
    expect(await restoreSavedDocument('doc-a')).toBe(true);
    expect(await opened.mock.calls[0][0].text()).toBe('edit two');
    expect(opened.mock.calls[0][0].name).toBe('Edited.docx');
  });
  it('does not apply original bytes when history storage cannot be checked', async () => {
    await rememberActiveSource('doc-a', original());
    const open = indexedDB.open.bind(indexedDB);
    vi.spyOn(indexedDB, 'open').mockImplementation((name, version) => {
      if (name === 'document-history') throw new Error('history denied');
      return open(name, version);
    });
    expect(await restoreSavedDocument('doc-a')).toBe(false);
    expect(opened).not.toHaveBeenCalled();
    expect(await readActiveSource('doc-a')).not.toBeNull();
  });
  it('does not restore another document from this tab', async () => {
    await rememberActiveSource('doc-a', original());
    expect(await restoreSavedDocument('doc-b')).toBe(false);
    expect(opened).not.toHaveBeenCalled();
  });
});
