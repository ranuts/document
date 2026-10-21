import { expect, test } from './lib/l0';
import { installConversationFixture } from './lib/conversation-fixture';

test('public reasoning is a reader-owned transient phase and never a saved answer', async ({ page }, info) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.addInitScript(installConversationFixture);
  await page.goto('/editor?new=docx&locale=en');
  await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
  await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
  const panel = page.locator('.agent-runtime-panel');
  const input = panel.locator('.cui-input');
  await input.fill('Hello');
  await panel.locator('.cui-send').click();
  await expect(panel.locator('.agent-panel-endpoint-status')).toContainText('Connected');
  await panel.locator('.cui-send').click();
  const reasoning = panel.locator('r-reasoning');
  await expect(reasoning).toHaveCount(1);
  await expect
    .poll(() => reasoning.evaluate((el) => (el as HTMLElement & { content: string }).content))
    .toContain('project notes');
  await expect(panel.locator('.cui-msg-agent')).toHaveCount(0);
  // The native disclosure uses a closed shadow root; click its visible header.
  await reasoning.click({ position: { x: 32, y: 16 } });
  await expect(reasoning).not.toHaveAttribute('open');
  await page.evaluate(() => window.__conversationFixture.advance());
  await expect
    .poll(() => reasoning.evaluate((el) => (el as HTMLElement & { content: string }).content))
    .toContain('next action');
  await expect(reasoning).not.toHaveAttribute('open');
  await page.evaluate(() => window.__conversationFixture.advance());
  await expect(panel.locator('.cui-msg-agent .cui-bubble')).toContainText('Project update');
  await expect(reasoning).not.toHaveAttribute('streaming');
  expect(await page.evaluate(() => window.__conversationFixture.completed)).toBe(false);
  for (let i = 0; i < 6; i++) await page.evaluate(() => window.__conversationFixture.advance());
  await expect(panel.locator('.cui-stop')).toBeHidden();
  await expect(panel.locator('.cui-msg-agent .cui-bubble table')).toHaveCount(1);
  await expect(panel.locator('.cui-msg-agent .cui-bubble pre')).toContainText('const status');
  expect(await panel.locator('.cui-msg-agent').getAttribute('data-source')).not.toContain('supplied project notes');
  await panel.locator('.cui-msg-agent .cui-copy').click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain('Project update');
  expect(copied).not.toContain('checking the supplied project notes');
  await panel.locator('.cui-msg-agent .cui-save').click();
  await expect(panel.locator('[data-artifact-reader]')).toBeVisible();
  await expect(panel.locator('[data-artifact-source]')).toHaveValue(/Project update/);
  expect(await panel.locator('[data-artifact-source]').inputValue()).not.toContain(
    'checking the supplied project notes',
  );
  await panel.locator('.agent-chat-toggle').click();
  await panel.screenshot({ path: info.outputPath('public-reasoning-completed.png') });
  await input.fill('Hi');
  await panel.locator('.cui-send').click();
  await expect(reasoning).toHaveCount(2);
  expect(JSON.stringify(await page.evaluate(() => window.__conversationFixture.requests))).not.toContain(
    'checking the supplied project notes',
  );
  await panel.locator('.cui-stop').click();
  await expect(panel.locator('.cui-stop')).toBeHidden();
  await expect(reasoning.last()).not.toHaveAttribute('streaming');
  const before = await reasoning.last().evaluate((el) => (el as HTMLElement & { content: string }).content);
  await page.evaluate(() => window.__conversationFixture.advance());
  expect(await reasoning.last().evaluate((el) => (el as HTMLElement & { content: string }).content)).toBe(before);
  await input.fill('Hello again');
  await page.evaluate(() => {
    window.__conversationFixture.mode = 'answer-only';
  });
  await panel.locator('.cui-send').click();
  await expect(panel.locator('.cui-msg-agent')).toHaveCount(2);
  await expect(reasoning).toHaveCount(2);
  await panel.locator('.cui-stop').click();
});

test.describe('touch streaming composer', () => {
  test.use({ hasTouch: true });
  for (const width of [320, 360]) {
    test(`keeps voice language readable beside Stop and Send at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(installConversationFixture);
      await page.goto('/editor?new=docx&locale=pt');
      await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
      await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
      await page.locator('.cui-input').fill('Hello');
      await page.locator('.cui-send').click();
      await expect(page.locator('.agent-panel-endpoint-status')).toContainText('Ligado');
      await page.locator('.cui-send').click();
      await expect(page.locator('.cui-stop')).toBeVisible();
      const language = await page.locator('.agent-speech-language').evaluate((el) => {
        const root = el.shadowRoot ?? (el as HTMLElement & { _shadowDom: ShadowRoot })._shadowDom;
        const label = root.querySelector('[part="selection-item"]')!;
        const range = document.createRange();
        range.selectNodeContents(label);
        return {
          text: label.textContent,
          width: label.getBoundingClientRect().width,
          textWidth: range.getBoundingClientRect().width,
        };
      });
      expect(language.text).toBe('Português');
      expect(language.width).toBeGreaterThanOrEqual(language.textWidth);
      for (const control of [
        '.agent-sources-toggle',
        '.agent-speech-mic',
        '.agent-speech-privacy button',
        '.cui-stop',
        '.cui-send',
      ]) {
        const box = (await page.locator(control).boundingBox())!;
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
      expect(await page.locator('.cui-composer').evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThan(2);
      await page.locator('.cui-stop').click();
    });
  }
});
