import { expect, test } from './lib/l0';

for (const width of [320, 1280]) {
  test(`assistant content aligns and model actions stay compact at ${width}px`, async ({ page }, testInfo) => {
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
    const suggestion = page.locator('.agent-task-action').first();
    await expect(suggestion).toHaveCSS('border-top-width', '0px');
    await expect(suggestion).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await page.locator('.agent-runtime-panel').screenshot({ path: testInfo.outputPath(`empty-${width}.png`) });
    const alignment = await page.locator('.agent-runtime-panel').evaluate((panel) => {
      const left = (selector: string) => panel.querySelector(selector)!.getBoundingClientRect().left;
      return [left('.agent-panel-title'), left('.cui-empty'), left('.cui-composer')];
    });
    expect(Math.max(...alignment) - Math.min(...alignment)).toBeLessThanOrEqual(1);
    await page.locator('.agent-panel-settings-toggle').click();
    await expect(page.locator('.agent-panel-settings')).toBeVisible();
    const settingsToggle = page.locator('.agent-panel-settings-toggle');
    await page.keyboard.press('Tab');
    await settingsToggle.focus();
    await expect(settingsToggle).toBeFocused();
    expect(
      await settingsToggle.evaluate((button) => {
        const style = getComputedStyle(button);
        return style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) >= 2;
      }),
    ).toBe(true);
    const size = await page.locator('.agent-panel-load').evaluate((button) => button.getBoundingClientRect().height);
    expect(size).toBeGreaterThanOrEqual(30);
    expect(size).toBeLessThanOrEqual(34);
    const overflow = await page.locator('.agent-panel-settings').evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}
