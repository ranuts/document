import { expect, test } from './lib/l0';
import type { Page } from '@playwright/test';

/**
 * /history -- the local document library: paging, title search, single-row
 * delete and clear-everything.
 *
 * Rows are seeded straight into IndexedDB rather than produced by editing
 * documents: this spec is about the page, and paying for 25 real exports to
 * fill two pages would make it one of the slowest in the suite. The full
 * editor -> snapshot -> recovery path is covered by autosave-recovery.spec.ts.
 */
type SeedRow = { id: string; title: string; savedToDisk?: boolean; ageMs?: number };

async function seed(page: Page, rows: SeedRow[]): Promise<void> {
  await page.evaluate(async (seedRows: SeedRow[]) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('document-history');
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains('docs')) {
          database.createObjectStore('docs', { keyPath: 'id' }).createIndex('by_updatedAt', 'updatedAt');
        }
        if (!database.objectStoreNames.contains('blobs')) {
          database.createObjectStore('blobs', { keyPath: ['docId', 'rev'] }).createIndex('by_docId', 'docId');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['docs', 'blobs'], 'readwrite');
      seedRows.forEach((row, index) => {
        const now = Date.now() - (row.ageMs ?? 0) - (seedRows.length - index) * 1000;
        tx.objectStore('docs').put({
          id: row.id,
          title: row.title,
          titleLower: row.title.toLowerCase(),
          ext: row.title.split('.').pop(),
          origin: 'local',
          size: 32,
          totalBytes: 32,
          createdAt: now,
          updatedAt: now,
          lastOpenedAt: now,
          revCount: 1,
          nextRev: 1,
          savedToDiskAt: row.savedToDisk ? now + 1 : undefined,
        });
        tx.objectStore('blobs').put({
          docId: row.id,
          rev: 0,
          savedAt: now,
          bytes: new Uint8Array(32),
          byteLength: 32,
        });
      });
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }, rows);
}

async function search(page: Page, value: string): Promise<void> {
  // r-input keeps its real <input> in a closed shadow root, so the component's
  // own contract (value + an `input` CustomEvent) is what a caller drives.
  await page.locator('#history-search').evaluate((element, text) => {
    (element as unknown as { value: string }).value = text;
    element.dispatchEvent(new CustomEvent('input', { detail: { value: text } }));
  }, value);
}

const titles = (page: Page) => page.locator('.history-row-title');

test.describe('local history page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/history');
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          const request = indexedDB.deleteDatabase('document-history');
          request.onsuccess = () => resolve();
          request.onerror = () => resolve();
          request.onblocked = () => resolve();
        }),
    );
  });

  test('says so when there is nothing stored', async ({ page }) => {
    await page.reload();
    await expect(page.locator('#history-empty')).toBeVisible();
    await expect(page.locator('.history-row')).toHaveCount(0);
  });

  test('pages the library newest first', async ({ page }) => {
    await seed(
      page,
      Array.from({ length: 25 }, (_, i) => ({ id: `doc-${i}`, title: `Doc-${i}.docx` })),
    );
    await page.reload();

    await expect(page.locator('.history-row')).toHaveCount(20);
    // Newest first: the last one seeded is the freshest.
    await expect(titles(page).first()).toHaveText('Doc-24.docx');
    await expect(page.locator('.history-page-info')).toContainText('1');

    await page.locator('#history-next').click();

    await expect(page.locator('.history-row')).toHaveCount(5);
    await expect(titles(page).last()).toHaveText('Doc-0.docx');
    // The view is in the URL, so this page survives a reload and can be shared.
    expect(new URL(page.url()).searchParams.get('page')).toBe('2');
  });

  test('filters by title, including a substring of a Chinese name', async ({ page }) => {
    await seed(page, [
      { id: 'a', title: 'Quarterly Report.docx' },
      { id: 'b', title: '年度总结报告.docx' },
      { id: 'c', title: 'budget.xlsx' },
    ]);
    await page.reload();
    await expect(page.locator('.history-row')).toHaveCount(3);

    // Assert on the text, not just the count: one row matches either query, so
    // a count alone cannot tell a re-render from the previous result standing.
    await search(page, 'REPORT');
    await expect(titles(page)).toHaveText(['Quarterly Report.docx']);

    await search(page, '总结');
    await expect(titles(page)).toHaveText(['年度总结报告.docx']);

    await search(page, 'nothing here');
    await expect(page.locator('#history-empty')).toBeVisible();
  });

  test('marks the rows whose only copy is in this browser', async ({ page }) => {
    await seed(page, [
      { id: 'only-here', title: 'OnlyHere.docx' },
      { id: 'on-disk', title: 'OnDisk.docx', savedToDisk: true },
    ]);
    await page.reload();
    await expect(page.locator('.history-row')).toHaveCount(2);

    const unsavedRow = page.locator('.history-row', { hasText: 'OnlyHere.docx' });
    const savedRow = page.locator('.history-row', { hasText: 'OnDisk.docx' });
    await expect(unsavedRow.locator('.history-badge')).toBeVisible();
    await expect(savedRow.locator('.history-badge')).toHaveCount(0);
  });

  test('deletes one document and leaves the rest alone', async ({ page }) => {
    await seed(page, [
      { id: 'keep', title: 'Keep.docx' },
      { id: 'drop', title: 'Drop.docx' },
    ]);
    await page.reload();

    // The confirmation is the design system's modal now, not the browser's:
    // a page about the user's own documents should not be interrupted by
    // "edit.chaxus.com says".
    await page.locator('.history-row', { hasText: 'Drop.docx' }).locator('.history-delete').click();
    await page.locator('r-modal .confirm-ok').click();

    await expect(titles(page)).toHaveText(['Keep.docx']);

    // Gone from storage, not just from the list -- the bytes have to go too.
    const remaining = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const request = indexedDB.open('document-history');
          request.onsuccess = () => {
            const db = request.result;
            const all = db.transaction('blobs', 'readonly').objectStore('blobs').getAllKeys();
            all.onsuccess = () => {
              db.close();
              resolve(all.result.length);
            };
          };
          request.onerror = () => resolve(-1);
        }),
    );
    expect(remaining).toBe(1);
  });

  test('says how long each document has left', async ({ page }) => {
    await seed(page, [
      { id: 'fresh', title: 'Fresh.docx' },
      { id: 'old', title: 'Old.docx', ageMs: 6.5 * 24 * 60 * 60 * 1000 },
    ]);
    await page.reload();

    await expect(page.locator('.history-row', { hasText: 'Fresh.docx' })).toContainText('7 days');
    await expect(page.locator('.history-row', { hasText: 'Old.docx' })).toContainText('1 day');
    // And the rule itself, not just its consequence.
    await expect(page.locator('.history-note').first()).toContainText('7 days');
  });

  test('deletes documents past the retention window without being asked', async ({ page }) => {
    await seed(page, [
      { id: 'kept', title: 'Kept.docx' },
      { id: 'expired', title: 'Expired.docx', ageMs: 8 * 24 * 60 * 60 * 1000 },
    ]);
    await page.reload();

    await expect(titles(page)).toHaveText(['Kept.docx']);

    // Gone from storage, not merely filtered out of the view.
    const remaining = await page.evaluate(
      () =>
        new Promise<string[]>((resolve) => {
          const request = indexedDB.open('document-history');
          request.onsuccess = () => {
            const db = request.result;
            const all = db.transaction('docs', 'readonly').objectStore('docs').getAllKeys();
            all.onsuccess = () => {
              db.close();
              resolve(all.result as string[]);
            };
          };
          request.onerror = () => resolve([]);
        }),
    );
    expect(remaining).toEqual(['kept']);
  });

  test('the homepage says what autosave keeps, for how long, and where to look', async ({ page }) => {
    // Served HTML, not drawn by script: a promise about someone's documents
    // has to hold for a first-time visitor and with JavaScript off.
    await page.goto('/');
    const line = page.locator('#landing-hero .recent');
    await expect(line).toContainText('7 days');
    await expect(line.locator('a.recent-all')).toHaveAttribute('href', '/history');

    await line.locator('a.recent-all').click();
    await page.waitForURL(/\/history/);
    await expect(page.locator('.history-title')).toBeVisible();
  });

  test('takes no for an answer', async ({ page }) => {
    await seed(page, [{ id: 'stays', title: 'Stays.docx' }]);
    await page.reload();

    await page.locator('.history-delete').click();
    await page.locator('r-modal .confirm-cancel').click();

    // Cancelling deletes nothing, and the dialog gets out of the way.
    await expect(page.locator('r-modal')).toHaveCount(0);
    await expect(titles(page)).toHaveText(['Stays.docx']);
  });

  test('clears everything at once', async ({ page }) => {
    await seed(page, [
      { id: 'a', title: 'A.docx' },
      { id: 'b', title: 'B.docx' },
    ]);
    await page.reload();

    await page.locator('#history-clear-all').click();
    await page.locator('r-modal .confirm-ok').click();

    await expect(page.locator('#history-empty')).toBeVisible();
  });

  test('opens a stored document back in the editor', async ({ page }) => {
    await seed(page, [{ id: 'reopen-me', title: 'Reopen.docx' }]);
    await page.reload();

    await page.locator('.history-row', { hasText: 'Reopen.docx' }).locator('.history-open').click();

    // The id is the document's identity everywhere: in the URL the editor
    // already uses, and in the link the history page hands back to it.
    await page.waitForURL(/\/editor\?saved=reopen-me/);
  });
});
