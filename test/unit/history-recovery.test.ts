import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { openLocalFile } = vi.hoisted(() => ({ openLocalFile: vi.fn() }));
vi.mock('../../lib/document', () => ({ openLocalFile }));

import { DB_NAME, resetHistoryDbForTests } from '../../lib/history/db';
import { getDoc, markSavedToDisk, putSnapshot } from '../../lib/history/store';
import { dismissRecoveryBar, formatRelativeTime, offerRecovery, restoreDocument } from '../../lib/history/recovery';

async function wipe(): Promise<void> {
  resetHistoryDbForTests();
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

function bar(): HTMLElement | null {
  return document.getElementById('recovery-bar');
}

describe('recovery offer', () => {
  beforeEach(async () => {
    await wipe();
    dismissRecoveryBar();
    openLocalFile.mockReset();
  });

  it('says nothing when there is nothing to recover', async () => {
    expect(await offerRecovery()).toBeNull();
    expect(bar()).toBeNull();
  });

  it('offers the document whose edits never reached the disk, naming it', async () => {
    const doc = await putSnapshot({ title: 'Report.docx', origin: 'local', bytes: new Uint8Array([1]) });

    const offered = await offerRecovery();

    expect(offered?.id).toBe(doc!.id);
    expect(bar()?.textContent).toContain('Report.docx');
  });

  it('says nothing about a document that was saved to disk', async () => {
    const doc = await putSnapshot({ title: 'Saved.docx', origin: 'local', bytes: new Uint8Array([1]) });
    await markSavedToDisk(doc!.id);

    expect(await offerRecovery()).toBeNull();
  });

  it('does not offer the document that is already open', async () => {
    const doc = await putSnapshot({ title: 'Open.docx', origin: 'local', bytes: new Uint8Array([1]) });

    expect(await offerRecovery({ excludeId: doc!.id })).toBeNull();
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

  it('restores from the bar and takes the bar away', async () => {
    await putSnapshot({ title: 'Bar.docx', origin: 'local', bytes: new Uint8Array([1]) });
    await offerRecovery();

    bar()!.querySelectorAll('r-button')[0].dispatchEvent(new Event('click'));

    expect(bar()).toBeNull();
    await vi.waitFor(() => expect(openLocalFile).toHaveBeenCalled());
  });

  it('remembers a dismissal so the next boot stays quiet', async () => {
    const doc = await putSnapshot({ title: 'Dismiss.docx', origin: 'local', bytes: new Uint8Array([1]) });
    await offerRecovery();

    bar()!.querySelectorAll('r-button')[1].dispatchEvent(new Event('click'));

    expect(bar()).toBeNull();
    await vi.waitFor(async () => expect((await getDoc(doc!.id))?.dismissedAt).toBeGreaterThan(0));
    expect(await offerRecovery()).toBeNull();
  });

  it('describes when the edits happened, not just that they exist', () => {
    const now = Date.UTC(2026, 0, 1, 12, 0, 0);
    expect(formatRelativeTime(now - 5 * 60_000, now)).toMatch(/5/);
    expect(formatRelativeTime(now - 3 * 60 * 60_000, now)).toMatch(/3/);
  });
});
