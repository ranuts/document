import { expect, test } from './lib/l0';
import { frameLeft, textGeometry } from './lib/layout-geometry';

const variants = [
  { width: 1280, locale: 'en', theme: 'light', coarse: false },
  { width: 1280, locale: 'en', theme: 'dark', coarse: false },
  { width: 320, locale: 'pt', theme: 'light', coarse: true },
  { width: 360, locale: 'pt', theme: 'dark', coarse: true },
] as const;

for (const variant of variants) {
  test.describe(`${variant.width}px ${variant.locale} ${variant.theme}`, () => {
    test.use({ viewport: { width: variant.width, height: 1000 }, hasTouch: variant.coarse });
    test('parallel navigation and settings commands form one coherent pane', async ({ page }, info) => {
      test.setTimeout(120_000);
      await page.emulateMedia({ colorScheme: variant.theme, reducedMotion: 'reduce' });
      await page.addInitScript((theme) => {
        localStorage.setItem('document-assistant-enabled', 'true');
        localStorage.setItem('agent-local-preset', 'Qwen3-4B-q4f16_1-MLC');
        localStorage.setItem('agent_conversation_saving_v2', 'true');
        localStorage.setItem('ran-theme', theme);
      }, variant.theme);
      await page.goto(`/editor?new=docx&locale=${variant.locale}`);
      await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
      await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
      const panel = page.locator('.agent-runtime-panel');
      await expect(page.locator('html')).toHaveAttribute('data-ran-theme', variant.theme);
      await page.locator('.agent-history-toggle').click();
      const history = page.locator('.agent-history-view');
      await history.locator('.agent-history-management > summary').click();
      await page.evaluate(() => document.fonts.ready);
      const options = history.locator('.agent-history-options');
      const buttons = options.locator('.agent-history-actions button');
      const widths: number[] = [];
      for (const button of await buttons.all()) {
        // Resting button frames belong to the content spine, not a second gutter.
        expect(await frameLeft(button)).toBeCloseTo(16, 1);
        const box = (await button.boundingBox())!;
        widths.push(box.width);
        expect(box.height).toBeGreaterThanOrEqual(variant.coarse ? 44 : 32);
        if (!variant.coarse) expect(box.height).toBe(32);
        expect(await frameLeft(button.locator('svg'))).toBeCloseTo(24, 1);
        expect((await textGeometry(button.locator('span'))).textLeft).toBeCloseTo(48, 1);
      }
      expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(0.5);
      expect(await frameLeft(options.locator('.agent-history-save'))).toBeCloseTo(24, 1);
      expect((await textGeometry(options.locator('label > span'))).textLeft).toBeCloseTo(48, 1);
      expect((await textGeometry(options.locator('.agent-history-status'))).textLeft).toBeCloseTo(48, 1);
      await page.mouse.move(0, 0);
      await panel.screenshot({ path: info.outputPath('history-full-pane.png') });

      const nav = panel.locator('.agent-workspace-nav');
      await expect(nav.getByRole('button')).toHaveCount(5);
      if (variant.coarse) {
        for (const button of await nav.getByRole('button').all()) {
          const box = (await button.boundingBox())!;
          expect(box.height).toBeGreaterThanOrEqual(44);
          expect(box.width).toBeGreaterThanOrEqual(44);
        }
        expect((await options.locator('label').boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      const draft = 'Keep the current conversation draft';
      await panel.locator('.agent-chat-toggle').click();
      await panel.locator('.cui-input').fill(draft);
      for (const [trigger, view] of [
        ['.agent-workspace-toggle', '.agent-artifacts'],
        ['.agent-sources-nav', '.agent-sources-view'],
        ['.agent-panel-settings-toggle', '.agent-panel-settings'],
        ['.agent-history-toggle', '.agent-history-view'],
      ]) {
        const button = nav.locator(trigger);
        await button.click();
        await expect(button).toHaveAttribute('aria-current', 'page');
        const current = panel.locator(view);
        await expect(current).toBeVisible();
        await expect(current.locator('.agent-view-back')).toHaveCount(0);
        const heading = current.locator('.agent-view-header h2');
        expect((await textGeometry(heading)).textLeft).toBeCloseTo(16, 1);
        await expect(heading).toHaveCSS('font-size', '16px');
        await expect(panel.locator(':scope > .agent-runtime-row')).toBeHidden();
        // Reselecting a destination must not act as Back or invalidate its state.
        await button.click();
        await expect(current).toBeVisible();
        await button.focus();
        const visible = await button.evaluate((el) => {
          const box = el.getBoundingClientRect(),
            parent = el.parentElement!.getBoundingClientRect();
          return box.left >= parent.left && box.right <= parent.right + 1;
        });
        expect(visible).toBe(true);
        expect(await current.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
        await page.mouse.move(0, 0);
        await panel.screenshot({ path: info.outputPath(`${view.slice(1)}-full-pane.png`) });
      }
      await panel.locator('.agent-chat-toggle').click();
      await expect(panel.locator('.cui-input')).toHaveValue(draft);
      await page.setViewportSize({ width: variant.width === 1280 ? 360 : 1280, height: 1000 });
      await panel.locator('.agent-sources-nav').click();
      await expect(panel.locator('.agent-sources-view')).toBeVisible();
      expect(await panel.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    });
  });
}
