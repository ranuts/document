import type { Page } from '@playwright/test';
import { expect, test } from './lib/l0';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('document-assistant-enabled', 'true'));
});

async function openAssistant(page: Page) {
  await page.goto('/editor?new=docx&locale=en');
  await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
  await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
  await page.locator('.agent-runtime-panel .agent-panel-title').click();
}

for (const width of [360, 1280]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`text controls and import fields remain recognizable at ${width}px in ${theme}`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme });
      await page.addInitScript((value) => localStorage.setItem('ran-theme', value), theme);
      await openAssistant(page);
      await expect(page.locator('html')).toHaveAttribute('data-ran-theme', theme);
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
      // Primary commands use a resting fill; only editable fields need a frame.
      await page.mouse.move(0, 0);
      const surface = await command.evaluate((el) => {
        const css = getComputedStyle(el);
        const luminance = (color: string) => {
          const [r, g, b] = color
            .match(/[\d.]+/g)!
            .slice(0, 3)
            .map(Number)
            .map((value) => {
              const channel = value / (color.startsWith('color(srgb') ? 1 : 255);
              return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
            });
          return r * 0.2126 + g * 0.7152 + b * 0.0722;
        };
        const foreground = luminance(css.color),
          background = luminance(css.backgroundColor);
        return {
          background: css.backgroundColor,
          shadow: css.boxShadow,
          canvas: getComputedStyle(el.closest('.agent-panel')!).backgroundColor,
          contrast: (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05),
        };
      });
      expect(surface.background).not.toBe('rgba(0, 0, 0, 0)');
      expect(surface.background !== surface.canvas || surface.shadow !== 'none').toBe(true);
      expect(surface.contrast).toBeGreaterThanOrEqual(4.5);
      await command.focus();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab');
      await expect(command).toBeFocused();
      await expect(command).toHaveCSS('outline-style', 'solid');
      await expect(command).toHaveCSS('outline-width', '2px');
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
    await openAssistant(page);
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
    await openAssistant(page);
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
    await toggle.click({ position: { x: box.width / 2, y: 2 } });
    await expect.poll(() => page.evaluate(() => localStorage.getItem('document-assistant-enabled'))).toBe('false');
  });
  test('structured import keeps a full touch target after labeling the title field', async ({ page }) => {
    await openAssistant(page);
    await page.locator('.agent-workspace-toggle').click();
    await page.getByRole('button', { name: 'Import structured result', exact: true }).click();
    const title = page.getByRole('textbox', { name: 'Title', exact: true });
    expect((await title.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await title.fill('Touch import');
    await expect(title).toHaveValue('Touch import');
  });
});
