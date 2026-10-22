import { expect, test } from './lib/l0';
import { installConversationFixture } from './lib/conversation-fixture';

test('expanded artifact workspace keeps the actual conversation and draft beside an editable result', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.addInitScript(installConversationFixture);
  await page.goto('/editor?new=docx&locale=en');
  await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
  await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
  const panel = page.locator('.agent-runtime-panel');
  const expand = panel.locator('.agent-panel-expand');
  await expect(expand).toBeVisible();
  const dock = (await panel.boundingBox())!.width;
  await panel.locator('.cui-input').fill('Keep this draft while changing the layout.');
  await expand.click();
  await expect(expand).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(async () => (await panel.boundingBox())!.width).toBeGreaterThan(dock);
  await expect(panel.locator('.cui-input')).toHaveValue('Keep this draft while changing the layout.');
  await panel.locator('.agent-panel-settings-toggle').click();
  await panel.locator('.agent-panel-endpoint-connect').click();
  await panel.locator('.agent-chat-toggle').click();
  await panel.locator('.cui-input').fill('Hello');
  await panel.locator('.cui-send').click();
  await expect.poll(() => page.evaluate(() => window.__conversationFixture.streams)).toBe(1);
  for (let i = 0; i < 9; i++) await page.evaluate(() => window.__conversationFixture.advance());
  await expect(panel.locator('.cui-stop')).toBeHidden();
  await panel.locator('.cui-input').fill('A follow-up draft stays here.');
  await panel.locator('.cui-msg-agent .cui-save').click();
  await expect(panel.locator('[data-artifact-reader]')).toBeVisible();
  await expect(panel.locator('.cui-root')).toBeVisible();
  await expect(panel).toHaveAttribute('data-split', 'true');
  const chat = (await panel.locator('.cui-root').boundingBox())!;
  const artifact = (await panel.locator('.agent-artifacts').boundingBox())!;
  expect(chat.width).toBeGreaterThanOrEqual(320);
  expect(artifact.width).toBeGreaterThanOrEqual(480);
  expect(chat.x + chat.width).toBeLessThanOrEqual(artifact.x + 0.5);
  // Keep a detached reader and an active composer selection across width-only changes.
  await page.setViewportSize({ width: 1600, height: 600 });
  const log = panel.locator('.cui-messages');
  await expect.poll(() => log.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeGreaterThan(100);
  await log.evaluate((el) => {
    el.scrollTop = 60;
    el.dispatchEvent(new Event('scroll'));
  });
  await expect.poll(() => log.evaluate((el) => el.scrollTop)).toBe(60);
  await panel.locator('.cui-input').evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(2, 10, 'backward'));
  await panel.locator('.agent-artifacts [data-action=edit]').click();
  const source = panel.locator('[data-artifact-source]');
  const original = await source.inputValue();
  await source.fill(original + '\n\nA retained draft edit.');
  await expand.click();
  await expect(panel).toHaveAttribute('data-split', 'false');
  await expect(source).toBeVisible();
  await expect(source).toHaveValue(original + '\n\nA retained draft edit.');
  await expand.click();
  await expect(panel.locator('.cui-input')).toHaveValue('A follow-up draft stays here.');
  await expect.poll(() => log.evaluate((el) => el.scrollTop)).toBe(60);
  expect(
    await panel
      .locator('.cui-input')
      .evaluate((el: HTMLTextAreaElement) => [el.selectionStart, el.selectionEnd, el.selectionDirection]),
  ).toEqual([2, 10, 'backward']);
  await expect(source).toHaveValue(original + '\n\nA retained draft edit.');
  await expect(panel.locator('.agent-artifact-modes [data-action=edit]')).toHaveAttribute('aria-pressed', 'true');
  expect(await panel.locator('[data-action=back]').filter({ visible: true }).count()).toBe(1);
});
