import { expect, test } from './lib/l0';
import { contentGeometry, frameLeft, textGeometry } from './lib/layout-geometry';

const variants = [
  { width: 1280, locale: 'en', coarse: false },
  { width: 360, locale: 'en', coarse: false },
  { width: 320, locale: 'pt', coarse: true },
];

for (const variant of variants) {
  test.describe(`${variant.width}px ${variant.locale}`, () => {
    test.use({ viewport: { width: variant.width, height: 900 }, hasTouch: variant.coarse });
    test('assistant text, navigation and content rails', async ({ page }, testInfo) => {
      test.setTimeout(180_000);
      await page.addInitScript(() => {
        localStorage.setItem('document-assistant-enabled', 'true');
        localStorage.setItem('agent-local-preset', 'Qwen3-4B-q4f16_1-MLC');
      });
      await page.goto(`/editor?new=docx&locale=${variant.locale}`);
      await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
      await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
      const panel = page.locator('.agent-runtime-panel');
      const title = panel.locator('.agent-panel-title');
      await expect(title).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      for (const theme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme: theme });
        const titleBox = await textGeometry(title);
        // A flex-expanded frame or an 8px text-only inset must fail independently.
        expect(titleBox.textLeft).toBeCloseTo(16, 1);
        expect(titleBox.width).toBeLessThanOrEqual(titleBox.textWidth + 17);
        await title.hover();
        await expect(title).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
        await title.click();
        await expect(panel).toHaveAttribute('data-view', 'chat');
        await page.locator('.cui-input').fill('Preserve this draft while checking every view');

        for (const [toggle, selector, frame] of [
          ['.agent-panel-settings-toggle', '.agent-panel-settings', '.agent-source-picker'],
          ['.agent-history-toggle', '.agent-history-view', '.agent-history-search-row'],
          ['.agent-sources-toggle', '.agent-sources-view', 'input[type="search"]'],
          ['.agent-workspace-toggle', '.agent-artifacts', ':scope > div:not(.agent-view-header)'],
        ]) {
          await panel.locator(toggle).click();
          const view = panel.locator(selector);
          const back = view.locator('.agent-view-back');
          await expect(back).toBeVisible();
          const geometry = await contentGeometry(view);
          expect(geometry.contentLeft, selector).toBeCloseTo(16, 1);
          expect(geometry.iconLeft, selector).toBeCloseTo(16, 1);
          expect(geometry.headingLeft, selector).toBeCloseTo(variant.coarse ? 54 : 48, 1);
          expect(geometry.backWidth, selector).toBe(variant.coarse ? 44 : 32);
          expect(geometry.backLeft, selector).toBeGreaterThanOrEqual(0);
          expect(geometry.overflow, selector).toBeLessThanOrEqual(1);
          expect(await frameLeft(view.locator(frame).first()), selector).toBeCloseTo(16, 1);
          await panel.screenshot({ path: testInfo.outputPath(`${selector.slice(1)}-${theme}.png`) });
          await back.focus();
          await back.press('Enter');
          await expect(panel).toHaveAttribute('data-view', 'chat');
          await expect(page.locator('.cui-input')).toHaveValue('Preserve this draft while checking every view');
        }

        // Import and editor return states share the same header and content owner.
        await panel.locator('.agent-workspace-toggle').click();
        const artifacts = panel.locator('.agent-artifacts');
        const importing = artifacts.locator('[data-action="import"]');
        await expect(importing).toBeVisible();
        expect(await frameLeft(importing)).toBeCloseTo(16, 1);
        const emptyCopy = artifacts.locator(':scope > div:not(.agent-view-header) > p');
        if (await emptyCopy.count()) expect((await textGeometry(emptyCopy)).textLeft).toBeCloseTo(16, 1);
        await importing.click();
        const form = artifacts.locator('.agent-artifact-import');
        const input = form.locator('input');
        await expect(input).toBeVisible();
        for (const field of await form.locator('input, textarea, label > span').all())
          expect(await frameLeft(field)).toBeCloseTo(16, 1);
        expect((await contentGeometry(artifacts)).iconLeft).toBeCloseTo(16, 1);
        await input.fill('Layout fixture');
        await form
          .locator('textarea')
          .fill(
            JSON.stringify({ schemaVersion: 1, payload: { kind: 'text', text: 'A result retained on this device.' } }),
          );
        await form.locator('[data-action="saveNew"]').click();
        const editor = artifacts.locator('.agent-artifact-editor:not(.agent-artifact-import)');
        await expect(editor.locator('textarea').first()).toBeVisible();
        expect(await frameLeft(editor.locator('input').first())).toBeCloseTo(16, 1);
        expect((await contentGeometry(artifacts)).headingLeft).toBeCloseTo(variant.coarse ? 54 : 48, 1);
        await panel.screenshot({ path: testInfo.outputPath(`artifact-editor-${theme}.png`) });
        await artifacts.locator('.agent-view-back').click();
        await expect(artifacts.locator('[data-action="import"]')).toBeVisible();
        await artifacts.locator('.agent-view-back').click();
      }
    });
  });
}
