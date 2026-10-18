import { captureClipboard } from './lib/clipboard';
import { expect, test } from './lib/l0';

test('restored drafts retain clear identity, readable narrow content and source-only keyboard copying', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  const source = [
    '# A clearer project update',
    'The next release brings **faster document workflows** and a simpler review process.',
    '- Review proposed changes before applying.\n- Keep the original document in view.',
    '| Task | Owner | Status |\n| --- | --- | --- |\n| Launch note | Product team | Ready for review |',
    '```txt\n' + 'release_reference_'.repeat(20) + '\n```',
  ].join('\n\n');
  await page.goto('/');
  await page.evaluate(async (body) => {
    localStorage.setItem('document-assistant-enabled', 'true');
    localStorage.setItem('agent-local-preset', 'Qwen3-4B-q4f16_1-MLC');
    localStorage.setItem('agent_conversation_saving_v2', 'true');
    const id = crypto.randomUUID();
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
    tx.objectStore('conversations').put({ version: 2, revision: 1, activeId: id, sessionIds: [id] }, 'state');
    tx.objectStore('sessions').put(
      {
        id,
        title: 'Project update',
        createdAt: now,
        updatedAt: now,
        messages: [
          { role: 'user', content: 'Draft a short project update.' },
          { role: 'assistant', content: body, documentArtifact: true, copyOnly: true },
          { role: 'user', content: 'Expand the closing paragraph.' },
          { role: 'assistant', content: 'The follow-up response was interrupted', interrupted: true },
        ],
      },
      id,
    );
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  }, source);
  await page.goto('/editor?new=docx&locale=en');
  await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
  await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
  await expect(page.locator('.agent-runtime-panel')).toHaveAttribute('data-view', 'chat');
  const draft = page.locator('.cui-msg-agent[data-document-artifact]');
  await expect(draft.locator('.cui-result-label')).toHaveText('Document draft');
  await expect(draft).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(draft).toHaveCSS('border-left-width', '0px');
  await expect(page.locator('[data-interrupted] .cui-result-label')).toHaveText('Incomplete response');
  await expect(page.locator('.cui-apply')).toHaveCount(0);
  await expect(draft).toHaveAttribute('data-source', source);
  const copiedText = await captureClipboard(page);
  const copy = draft.locator('.cui-copy');
  await expect(copy).toBeVisible();
  await page.keyboard.press('Tab');
  await copy.focus();
  await expect(copy).toBeFocused();
  expect(
    await copy.evaluate((element) => {
      const style = getComputedStyle(element);
      return style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) > 0;
    }),
  ).toBe(true);
  await copy.press('Enter');
  await expect(copy).toHaveAccessibleName('Copied');
  expect(await copiedText()).toBe(source);
  const resize = page.getByRole('separator', { name: 'Resize AI panel' });
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await resize.press('Home');
    await draft.scrollIntoViewIfNeeded();
    const bounds = await draft.evaluate((row) => {
      const header = row.querySelector('.cui-result-header')!.getBoundingClientRect();
      const body = row.querySelector('.cui-bubble')!.getBoundingClientRect();
      const actions = row.querySelector('.cui-message-actions')!.getBoundingClientRect();
      return { header: header.x, body: body.x, actions: actions.x, width: row.scrollWidth - row.clientWidth };
    });
    expect(Math.abs(bounds.header - bounds.body)).toBeLessThanOrEqual(1);
    expect(Math.abs(bounds.actions - bounds.body)).toBeLessThanOrEqual(1);
    expect(bounds.width).toBeLessThan(2);
    await expect
      .poll(() => page.locator('.agent-runtime-panel').evaluate((el) => el.scrollWidth - el.clientWidth))
      .toBeLessThan(2);
    await page.locator('.agent-runtime-panel').screenshot({ path: testInfo.outputPath(`results-${theme}.png`) });
  }
  await page.setViewportSize({ width: 360, height: 640 });
  await draft.scrollIntoViewIfNeeded();
  await expect.poll(() => draft.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThan(2);
  await page.locator('.agent-runtime-panel').screenshot({ path: testInfo.outputPath('results-narrow.png') });
  await draft.locator('pre').focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => draft.locator('pre').evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
});
