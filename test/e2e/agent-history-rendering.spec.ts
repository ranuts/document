import { expect, test } from './lib/l0';

test('restores a long saved conversation and switches sessions with completed answer actions', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/');
  const ids = await page.evaluate(async () => {
    localStorage.setItem('document-assistant-enabled', 'true');
    localStorage.setItem('agent-local-preset', 'Qwen3-4B-q4f16_1-MLC');
    localStorage.setItem('agent_conversation_saving_v2', 'true');
    const long = crypto.randomUUID();
    const short = crypto.randomUUID();
    const now = Date.now();
    const request = indexedDB.open('document-ai-conversations', 2);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('conversations');
      request.result.createObjectStore('sessions');
    };
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction(['conversations', 'sessions'], 'readwrite');
    tx.objectStore('conversations').put(
      { version: 2, revision: 1, activeId: long, sessionIds: [long, short] },
      'state',
    );
    const messages = Array.from({ length: 200 }, (_, index) => [
      { role: 'user', content: `Question ${index}` },
      { role: 'assistant', content: `**Answer ${index}**` },
    ]).flat();
    tx.objectStore('sessions').put({ id: long, title: 'Long history', createdAt: now, updatedAt: now, messages }, long);
    tx.objectStore('sessions').put(
      {
        id: short,
        title: 'Short history',
        createdAt: now,
        updatedAt: now,
        messages: [
          { role: 'user', content: 'Short request' },
          { role: 'assistant', content: 'Short answer' },
        ],
      },
      short,
    );
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
    });
    db.close();
    return { long, short };
  });
  await page.goto('/editor?new=docx&locale=en');
  await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
  await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
  const rows = page.locator('.cui-messages .cui-msg');
  await expect(rows).toHaveCount(400);
  await expect(rows.first().locator('.cui-bubble')).toHaveText('Question 0');
  await expect(rows.last().locator('.cui-bubble strong')).toHaveText('Answer 199');
  await expect(rows.last().locator('.cui-copy')).toBeEnabled();
  await expect
    .poll(() =>
      page
        .locator('.cui-messages')
        .evaluate((element) => element.scrollHeight - element.clientHeight - element.scrollTop),
    )
    .toBeLessThanOrEqual(2);
  await page.locator('.agent-history-toggle').click();
  await page.locator('.agent-session-select').selectOption(ids.short);
  await expect(rows).toHaveCount(2);
  await expect(rows.last().locator('.cui-bubble')).toHaveText('Short answer');
  await page.locator('.agent-history-toggle').click();
  await page.locator('.agent-session-select').selectOption(ids.long);
  await expect(rows).toHaveCount(400);
  await expect(rows.last()).toHaveAttribute('data-source', '**Answer 199**');
  await page.locator('.cui-input').fill('Next request');
  await expect(page.locator('.cui-input')).toHaveValue('Next request');
});
