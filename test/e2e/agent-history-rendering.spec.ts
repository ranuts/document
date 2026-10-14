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
  const search = page.getByRole('searchbox', { name: 'Search conversations' });
  await search.fill('Short answer');
  await expect(page.locator('.agent-conversation-open')).toHaveCount(1);
  await search.fill('No matching request');
  await expect(page.locator('.agent-history-empty')).toBeVisible();
  await search.fill('');
  await expect(page.locator('.agent-history-management')).not.toHaveAttribute('open', '');
  await page.locator(`.agent-conversation-open[data-id="${ids.short}"]`).click();
  await expect(rows).toHaveCount(2);
  await expect(rows.last().locator('.cui-bubble')).toHaveText('Short answer');
  await page.locator('.agent-history-toggle').click();
  await page.locator(`.agent-conversation-open[data-id="${ids.long}"]`).click();
  await expect(rows).toHaveCount(400);
  await expect(rows.last()).toHaveAttribute('data-source', '**Answer 199**');
  await page.locator('.cui-input').fill('Next request');
  await expect(page.locator('.cui-input')).toHaveValue('Next request');
  await page.locator('.agent-history-toggle').click();
  const history = page.locator('.agent-history-view');
  const titleBox = await history.locator('.agent-history-heading').boundingBox();
  const headerBox = await page.locator('.agent-runtime-panel .agent-panel-title').boundingBox();
  expect(Math.abs(titleBox!.x - headerBox!.x)).toBeLessThanOrEqual(1);
  const rowBox = await history.locator('.agent-conversation-title').first().boundingBox();
  expect(Math.abs(titleBox!.x - rowBox!.x)).toBeLessThanOrEqual(1);
  await page.locator('.agent-runtime-panel').screenshot({ path: test.info().outputPath('history-light.png') });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.locator('.agent-runtime-panel').screenshot({ path: test.info().outputPath('history-dark.png') });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.setViewportSize({ width: 360, height: 640 });
  await expect.poll(() => history.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.locator('.agent-runtime-panel').screenshot({ path: test.info().outputPath('history-narrow.png') });
  await page.setViewportSize({ width: 1280, height: 900 });
  const inactiveDelete = page.locator(`.agent-conversation-delete[data-id="${ids.short}"]`);
  await inactiveDelete.click();
  await expect(page.locator('.agent-history-confirmation')).toBeVisible();
  await expect(page.locator('.agent-history-cancel')).toBeFocused();
  await expect(page.locator('.agent-history-confirmation')).toContainText('Short history');
  await page.keyboard.press('Escape');
  await expect(history).toBeVisible();
  await expect(inactiveDelete).toBeFocused();
  await expect(page.locator('.agent-conversation-open')).toHaveCount(2);
  await inactiveDelete.click();
  await page.locator('.agent-history-confirm').click();
  await expect(page.locator('.agent-conversation-open')).toHaveCount(1);
  await expect(search).toBeFocused();
  await expect(page.locator('.agent-conversation-open')).toHaveAttribute('data-id', ids.long);
  await page.keyboard.press('Escape');
  await expect(rows).toHaveCount(400);
  await expect(page.locator('.cui-input')).toHaveValue('Next request');
});
