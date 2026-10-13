import { expect, test } from './lib/l0';

for (const width of [320, 1280]) {
  test(`assistant content aligns and model actions stay compact at ${width}px`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/editor?new=docx&locale=en');
    await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
    await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
    await page.locator('.agent-onboarding .agent-enable-switch').click();
    const panel = page.locator('.agent-runtime-panel');
    await expect(panel).toHaveAttribute('data-view', 'settings');
    await page.locator('.agent-panel-settings-toggle').click();
    await expect(panel).toHaveAttribute('data-view', 'chat');
    await expect(page.locator('.cui-composer')).toBeVisible();
    await expect(page.locator('.cui-empty')).toBeVisible();
    const alignment = await page.locator('.agent-runtime-panel').evaluate((panel) => {
      const left = (selector: string) => panel.querySelector(selector)!.getBoundingClientRect().left;
      return [left('.agent-panel-title'), left('.cui-empty'), left('.cui-composer')];
    });
    expect(Math.max(...alignment) - Math.min(...alignment)).toBeLessThanOrEqual(1);
    await page.locator('.agent-panel-settings-toggle').click();
    await expect(page.locator('.agent-panel-settings')).toBeVisible();
    const size = await page.locator('.agent-panel-load').evaluate((button) => button.getBoundingClientRect().height);
    expect(size).toBeGreaterThanOrEqual(30);
    expect(size).toBeLessThanOrEqual(34);
    const overflow = await page.locator('.agent-panel-settings').evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}
