import { expect, test } from './lib/l0';

test('default off and remembered on never prepare models or connect services on navigation', async ({ page }) => {
  test.setTimeout(120_000);
  const inference: string[] = [];
  page.on('request', (request) => {
    if (
      /huggingface|mlc-ai|web-llm|localhost:11434|127\.0\.0\.1:11434|api\.openai|anthropic|generativelanguage|\.gguf(?:\?|$)/i.test(
        request.url(),
      )
    )
      inference.push(request.url());
  });
  await page.goto('/editor?new=docx&agent=1');
  await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
  const frame = page.frameLocator('iframe[name="frameEditor"]');
  await frame.locator('.agent-sidebar-entry').click();
  await expect(page.locator('.agent-onboarding .agent-enable-switch')).toHaveAttribute('aria-checked', 'false');
  await expect(page.locator('.agent-runtime-panel')).toHaveCount(0);
  await page.locator('.agent-onboarding .agent-enable-switch').click();
  await expect(page.locator('.agent-runtime-panel')).toBeVisible();
  await expect(page.locator('.agent-panel-settings')).toBeVisible();
  await page.locator('.agent-panel-settings-toggle').click();
  await expect(page.locator('.agent-runtime-panel')).toHaveAttribute('data-view', 'chat');
  await page.locator('.cui-input').fill('My draft');
  await expect(page.locator('.cui-send')).toBeDisabled();
  await page.locator('.agent-panel-settings-toggle').click();
  await page.locator('.agent-panel-settings-toggle').click();
  await expect(page.locator('.agent-runtime-panel')).toHaveAttribute('data-view', 'chat');
  await expect(page.locator('.cui-input')).toHaveValue('My draft');
  await page.locator('.agent-runtime-panel .agent-panel-close').click();
  await expect(page.locator('.agent-runtime-panel')).toBeHidden();
  await frame.locator('.agent-sidebar-entry').click();
  await expect(page.locator('.agent-runtime-panel')).toBeVisible();
  await page.locator('.agent-panel-settings-toggle').click();
  await page.locator('.agent-preferences > summary').click();
  await page.locator('.agent-disable-switch').click();
  await expect(page.locator('.agent-onboarding')).toBeVisible();
  await page.locator('.agent-onboarding .agent-enable-switch').click();
  await expect(page.locator('.agent-runtime-panel')).toBeVisible();
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
  await expect(page.locator('.agent-runtime-panel')).toHaveCount(0);
  await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
  await expect(page.locator('.agent-runtime-panel')).toBeVisible();
  expect(inference).toEqual([]);
});

for (const width of [1280, 375, 320]) {
  test(`assistant views fit ${width}px and preserve an editable draft`, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 850 });
    if (width === 320) {
      await page.addInitScript(() => localStorage.setItem('ran-theme', 'dark'));
      await page.emulateMedia({ reducedMotion: 'reduce' });
    }
    await page.goto(`/editor?new=docx&locale=${width === 1280 ? 'de' : 'zh-CN'}`);
    await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
    await page.evaluate(() => window.__toggleAgentPanel?.());
    await page.locator('.agent-onboarding .agent-enable-switch').click();
    await expect(page.locator('.agent-runtime-panel')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('settings.png') });
    await page.locator('.agent-panel-settings-toggle').click();
    await expect(page.locator('.agent-runtime-panel')).toHaveAttribute('data-view', 'chat');
    await page.locator('.cui-input').fill('Keep this draft while switching views');
    await page.locator('.agent-history-toggle').click();
    await expect(page.locator('.agent-history-view')).toBeVisible();
    await page.locator('.agent-history-toggle').click();
    await expect(page.locator('.agent-runtime-panel')).toHaveAttribute('data-view', 'chat');
    await expect(page.locator('.cui-input')).toHaveValue('Keep this draft while switching views');
    const fits = await page.locator('.agent-runtime-panel').evaluate((panel) => {
      const box = panel.getBoundingClientRect();
      const composer = panel.querySelector('.cui-composer')!.getBoundingClientRect();
      return (
        box.width <= innerWidth &&
        box.right <= innerWidth + 1 &&
        composer.bottom <= innerHeight + 1 &&
        panel.scrollWidth <= panel.clientWidth + 1
      );
    });
    expect(fits).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('chat.png') });
  });
}
