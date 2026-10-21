import { expect, test } from './lib/l0';

for (const width of [1280, 320]) {
  test.describe(`${width}px conversation shell`, () => {
    test.use({ viewport: { width, height: 900 }, hasTouch: width === 320 });
    test('one header keeps primary routes visible and composition owns model/source context', async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem('document-assistant-enabled', 'true'));
      await page.goto('/editor?new=docx&locale=en');
      await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
      await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
      const panel = page.locator('.agent-runtime-panel');
      const header = panel.locator('.agent-panel-header');
      await expect(header.locator('.agent-workspace-nav button')).toHaveCount(3);
      await expect(panel).toHaveAttribute('data-view', 'chat');
      expect((await header.boundingBox())!.height).toBe(width === 320 ? 52 : 40);
      await expect(panel.locator(':scope > .agent-workspace-nav')).toHaveCount(0);
      await expect(panel.locator('.cui-composer .agent-sources-nav')).toBeVisible();
      await expect(panel.locator('.cui-footer .agent-panel-settings-toggle')).toBeVisible();
      await panel.locator('.cui-input').fill('Keep this draft');
      for (const [trigger, view] of [
        ['.agent-history-toggle', 'history'],
        ['.agent-workspace-toggle', 'artifacts'],
      ] as const) {
        await header.locator(trigger).click();
        await expect(panel).toHaveAttribute('data-view', view);
        await expect(header.locator(trigger)).toHaveAttribute('aria-current', 'page');
        await header.locator('.agent-chat-toggle').click();
        await expect(panel.locator('.cui-input')).toHaveValue('Keep this draft');
      }
      await panel.locator('.agent-panel-settings-toggle').click();
      await expect(panel).toHaveAttribute('data-view', 'settings');
      await header.locator('.agent-chat-toggle').click();
      await panel.locator('.agent-sources-nav').click();
      await expect(panel).toHaveAttribute('data-view', 'sources');
      await panel.locator('.agent-sources-view input[type=file]').setInputFiles({
        name: 'project-notes.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('A local source preview.'),
      });
      await expect(panel.locator('.agent-source-row')).toContainText('project-notes.txt');
      await header.locator('.agent-chat-toggle').click();
      const chip = panel.locator('.agent-source-chip');
      await expect(chip).toHaveText('project-notes.txt');
      await chip.click();
      await expect(panel.locator('.agent-source-preview')).toHaveAttribute('open', '');
      await expect(panel.locator('.agent-source-preview summary')).toBeFocused();
      await expect(panel.locator('.agent-source-preview pre')).toHaveText('A local source preview.');
      await header.locator('.agent-chat-toggle').click();
      await expect(panel.locator('.cui-input')).toHaveValue('Keep this draft');
      expect(await panel.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    });
  });
}

test('secondary pages return to an older selected conversation and its own draft', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    localStorage.setItem('document-assistant-enabled', 'true');
    localStorage.setItem('agent_conversation_saving_v2', 'true');
    const ids = [crypto.randomUUID(), crypto.randomUUID()];
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
    tx.objectStore('conversations').put({ version: 2, revision: 1, activeId: ids[1], sessionIds: ids }, 'state');
    for (const [index, id] of ids.entries())
      tx.objectStore('sessions').put(
        {
          id,
          title: index ? 'Newer conversation' : 'Older conversation',
          createdAt: Date.now() - 2000 + index * 1000,
          updatedAt: Date.now() - 2000 + index * 1000,
          messages: [{ role: 'user', content: index ? 'Newer request' : 'Older request' }],
        },
        id,
      );
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  });
  await page.goto('/editor?new=docx&locale=en');
  await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
  await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
  const panel = page.locator('.agent-runtime-panel');
  await panel.locator('.agent-history-toggle').click();
  await panel
    .locator('.agent-conversation-title')
    .filter({ hasText: /^Older conversation$/ })
    .click();
  await expect(panel.locator('.cui-msg-user')).toHaveText('Older request');
  await panel.locator('.cui-input').fill('Only the older conversation owns this draft');
  for (const selector of [
    '.agent-sources-nav',
    '.agent-panel-settings-toggle',
    '.agent-workspace-toggle',
    '.agent-history-toggle',
  ]) {
    await panel.locator(selector).click();
    await panel.locator('.agent-chat-toggle').click();
    await expect(panel.locator('.cui-msg-user')).toHaveText('Older request');
    await expect(panel.locator('.cui-input')).toHaveValue('Only the older conversation owns this draft');
  }
});
