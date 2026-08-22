import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { openLocalFile } = vi.hoisted(() => ({ openLocalFile: vi.fn() }));
vi.mock('../../lib/document', () => ({ openLocalFile }));

import { DB_NAME, resetHistoryDbForTests } from '../../lib/history/db';
import { putSnapshot, resetHistoryClockForTests } from '../../lib/history/store';
import { formatRelativeTime, restoreDocument } from '../../lib/history/recovery';

async function wipe(): Promise<void> {
  resetHistoryDbForTests();
  resetHistoryClockForTests();
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

describe('restoring a stored document', () => {
  beforeEach(async () => {
    await wipe();
    openLocalFile.mockReset();
  });

  it('reopens the newest snapshot through the ordinary open path', async () => {
    const doc = await putSnapshot({ title: 'Restore.docx', origin: 'local', bytes: new Uint8Array([7, 7]) });

    expect(await restoreDocument(doc!)).toBe(true);

    const [file, options] = openLocalFile.mock.calls[0];
    expect((file as File).name).toBe('Restore.docx');
    expect(new Uint8Array(await (file as File).arrayBuffer())).toEqual(new Uint8Array([7, 7]));
    // Continues the same history row instead of starting a duplicate.
    expect(options).toEqual({ historyId: doc!.id });
  });

  it('reports failure rather than opening an empty document when nothing is stored', async () => {
    const doc = await putSnapshot({ title: 'Gone.docx', origin: 'local', bytes: new Uint8Array([1]) });
    await wipe();

    expect(await restoreDocument(doc!)).toBe(false);
    expect(openLocalFile).not.toHaveBeenCalled();
  });

  it('describes when the edits happened, not just that they exist', () => {
    const now = Date.UTC(2026, 0, 1, 12, 0, 0);
    expect(formatRelativeTime(now - 5 * 60_000, now)).toMatch(/5/);
    expect(formatRelativeTime(now - 3 * 60 * 60_000, now)).toMatch(/3/);
  });
});

describe('the editor entry', () => {
  it('does not ship a boot-time recovery card', () => {
    // The card interrupted a document the user had just opened to talk about a
    // different one. Old work is offered on the landing page and /history,
    // where the user is not mid-task -- nothing here may put it back.
    const source = readFileSync(resolve(__dirname, '../../index.ts'), 'utf8');
    expect(source).not.toMatch(/offerRecovery/);
  });
});
