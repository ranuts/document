import { readHistoryDocs } from './lib/history-db';
import { buildDocx } from './lib/ooxml';
import { expect, test } from './lib/l0';

test('an expired active document keeps the bytes from its next autosave', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/editor?new=docx&locale=en');
  await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
  const id = new URL(page.url()).searchParams.get('saved')!;
  const recovery = Array.from(buildDocx('Previous recovery'));
  await page.evaluate(
    async ({ id, bytes }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('document-history', 3);
        request.onupgradeneeded = () => {
          request.transaction!.abort();
          reject(new Error('The editor must initialize its history database'));
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(['docs', 'blobs'], 'readwrite');
          const old = Date.now() - 8 * 24 * 60 * 60 * 1000;
          tx.objectStore('docs').put({
            id,
            title: 'Untitled.docx',
            titleLower: 'untitled.docx',
            ext: 'docx',
            origin: 'new',
            size: bytes.length,
            totalBytes: bytes.length,
            createdAt: old,
            updatedAt: old,
            lastOpenedAt: old,
            revCount: 1,
            nextRev: 1,
          });
          tx.objectStore('blobs').put({
            docId: id,
            rev: 0,
            savedAt: old,
            bytes: new Uint8Array(bytes),
            byteLength: bytes.length,
          });
          tx.oncomplete = () => resolve();
          tx.onabort = () => reject(tx.error);
        });
      } finally {
        db.close();
      }
    },
    { id, bytes: recovery },
  );
  const sdk = page.frameLocator('iframe[name="frameEditor"]').locator('#editor_sdk');
  await sdk.click({ position: { x: 300, y: 200 } });
  await page.keyboard.type('A fresh edit after eight idle days');
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect
    .poll(
      () =>
        page.evaluate(
          (id) =>
            new Promise<number>((resolve, reject) => {
              const request = indexedDB.open('document-history', 3);
              request.onerror = () => reject(request.error);
              request.onsuccess = () => {
                const db = request.result;
                const read = db.transaction('docs').objectStore('docs').get(id);
                read.onsuccess = () => {
                  db.close();
                  resolve(read.result?.nextRev ?? 0);
                };
                read.onerror = () => {
                  db.close();
                  reject(read.error);
                };
              };
            }),
          id,
        ),
      { timeout: 25_000 },
    )
    .toBe(2);
  const bytes = await page.evaluate(
    (id) =>
      new Promise<number[] | null>((resolve, reject) => {
        const request = indexedDB.open('document-history', 3);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const read = db.transaction('blobs').objectStore('blobs').get([id, 1]);
          read.onsuccess = () => {
            db.close();
            resolve(read.result ? Array.from(read.result.bytes) : null);
          };
          read.onerror = () => {
            db.close();
            reject(read.error);
          };
        };
      }),
    id,
  );
  expect(bytes).not.toBeNull();
  const { ooxmlText, zipEntryText } = await import('./lib/ooxml');
  expect(ooxmlText((await zipEntryText(new Uint8Array(bytes!), 'word/document.xml')) || '')).toContain('fresh edit');
});

test('a failed autosave quota retry preserves the previous recovery document', async ({ page }) => {
  test.setTimeout(90_000);
  const recovery = Array.from(buildDocx('The only recovery copy'));
  await page.goto('/editor?new=docx&locale=en');
  await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));

  await page.evaluate(async (bytes) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('document-history', 3);
      request.onupgradeneeded = () => {
        request.transaction!.abort();
        reject(new Error('The editor must initialize its history database'));
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(['docs', 'blobs'], 'readwrite');
        const now = Date.now() - 60_000;
        tx.objectStore('docs').put({
          id: 'only-recovery',
          title: 'Recovery.docx',
          titleLower: 'recovery.docx',
          ext: 'docx',
          origin: 'local',
          size: bytes.length,
          totalBytes: bytes.length,
          createdAt: now,
          updatedAt: now,
          lastOpenedAt: now,
          revCount: 1,
          nextRev: 1,
        });
        tx.objectStore('blobs').put({
          docId: 'only-recovery',
          rev: 0,
          savedAt: now,
          bytes: new Uint8Array(bytes),
          byteLength: bytes.length,
        });
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }

    const target = window as unknown as { quotaWriteAttempts: number };
    target.quotaWriteAttempts = 0;
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.transaction.db.name === 'document-history' && this.name === 'blobs') {
        target.quotaWriteAttempts++;
        throw new DOMException('Injected full storage', 'QuotaExceededError');
      }
      return put.apply(this, args as Parameters<typeof put>);
    };
  }, recovery);

  const sdk = page.frameLocator('iframe[name="frameEditor"]').locator('#editor_sdk');
  await sdk.click({ position: { x: 300, y: 200 } });
  await page.keyboard.type('A newer document that cannot be snapshotted');
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  // Stay below the 30-second periodic interval: the visibility path must cause
  // this export, including its one quota retry.
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { quotaWriteAttempts: number }).quotaWriteAttempts), {
      timeout: 25_000,
    })
    .toBe(2);

  expect(await readHistoryDocs(page)).toMatchObject([{ id: 'only-recovery', title: 'Recovery.docx' }]);
  await page.goto('/history?locale=en');
  await expect(page.locator('.history-row-title')).toHaveText(['Recovery.docx']);
  const stored = await page.evaluate(
    () =>
      new Promise<number[]>((resolve, reject) => {
        const opening = indexedDB.open('document-history', 3);
        opening.onerror = () => reject(opening.error);
        opening.onsuccess = () => {
          const db = opening.result;
          const read = db.transaction('blobs', 'readonly').objectStore('blobs').get(['only-recovery', 0]);
          read.onsuccess = () => {
            db.close();
            resolve(Array.from(read.result.bytes));
          };
          read.onerror = () => {
            db.close();
            reject(read.error);
          };
        };
      }),
  );
  expect(stored).toEqual(recovery);
});
