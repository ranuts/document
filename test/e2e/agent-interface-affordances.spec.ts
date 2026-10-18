import { expect, test } from './lib/l0';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('document-assistant-enabled', 'true'));
  await page.goto('/editor?new=docx&locale=en');
  await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
  await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
  await page.locator('.agent-runtime-panel .agent-panel-title').click();
});

for (const width of [360, 1280]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`text controls and import fields remain recognizable at ${width}px in ${theme}`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme });
      for (const selector of ['.agent-panel-title', '.agent-task-action']) {
        const button = page.locator(`.agent-runtime-panel ${selector}`).first();
        await button.hover();
        const insets = await button.evaluate((el) => {
          const style = getComputedStyle(el);
          return [parseFloat(style.paddingInlineStart), parseFloat(style.paddingInlineEnd)];
        });
        expect(Math.min(...insets)).toBeGreaterThanOrEqual(8);
      }
      await page.locator('.agent-runtime-panel').screenshot({ path: info.outputPath(`chat-${width}-${theme}.png`) });
      await page.locator('.agent-workspace-toggle').click();
      const artifacts = page.locator('.agent-artifacts');
      const command = artifacts.getByRole('button', { name: 'Import structured result', exact: true });
      await expect(command).toHaveCSS('border-top-width', '1px');
      await command.click();
      const title = artifacts.getByRole('textbox', { name: 'Title', exact: true });
      const payload = artifacts.getByRole('textbox', { name: 'Import structured result', exact: true });
      for (const field of [title, payload]) {
        await expect(field).toHaveCSS('border-top-width', '1px');
        expect(
          await field.evaluate((el) => parseFloat(getComputedStyle(el).paddingInlineStart)),
        ).toBeGreaterThanOrEqual(8);
      }
      await title.fill('Quarterly notes');
      await payload.fill('{"schemaVersion":1,"payload":{"kind":"table","columns":["Name"],"rows":[["Value"]]}}');
      await expect(artifacts.getByRole('button', { name: 'Save as new artifact', exact: true })).toBeEnabled();
      expect(await artifacts.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThan(2);
      await page.locator('.agent-runtime-panel').screenshot({ path: info.outputPath(`import-${width}-${theme}.png`) });
    });
  }

  test(`speech overlays stay anchored and mutually exclusive at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const privacy = page.locator('.agent-speech-privacy');
    const toggle = privacy.locator('button');
    const language = page.locator('.agent-speech-language');
    const popup = page.locator('.agent-speech-popover');
    await toggle.click();
    await expect(popup).toBeVisible();
    await expect
      .poll(async () => {
        const anchor = (await toggle.boundingBox())!;
        const panel = (await popup.boundingBox())!;
        return anchor.y - panel.y - panel.height;
      })
      .toBeLessThanOrEqual(12);
    const panel = (await popup.boundingBox())!;
    expect(panel.x).toBeGreaterThanOrEqual(0);
    expect(panel.x + panel.width).toBeLessThanOrEqual(width);
    await page.locator('.agent-runtime-panel').screenshot({ path: info.outputPath(`speech-${width}.png`) });
    await language.click();
    await expect(language).toHaveAttribute('open', '');
    await expect(privacy).not.toHaveAttribute('open', '');
    await expect(popup).not.toBeVisible();
    await language.press('Escape');
    await expect(language).not.toHaveAttribute('open', '');
    await toggle.focus();
    await toggle.press('Enter');
    await expect(privacy).toHaveAttribute('open', '');
    await toggle.press('Escape');
    await expect(privacy).not.toHaveAttribute('open', '');
    await expect(toggle).toBeFocused();
  });
}

test.describe('touch controls', () => {
  test.use({ hasTouch: true, viewport: { width: 360, height: 800 } });
  test('assistant switch keeps a full touch target around its compact track', async ({ page }) => {
    await page.locator('.agent-panel-settings-toggle').click();
    await page.getByText('More settings', { exact: true }).click();
    const toggle = page.getByRole('switch', { name: 'Enable AI assistant', exact: true });
    await toggle.scrollIntoViewIfNeeded();
    const box = (await toggle.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    await toggle.focus();
    await expect(toggle).toBeFocused();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
  });
});
