import type { Locator, Page } from '@playwright/test';
import { expect, test } from './lib/l0';
import { frameLeft, textGeometry } from './lib/layout-geometry';

async function openHistory(page: Page, locale = 'en') {
  await page.goto(`/editor?new=docx&locale=${locale}`);
  await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
  await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
  await page.locator('.agent-history-toggle').click();
  await page.locator('.agent-history-management > summary').click();
  await expect(page.locator('.agent-history-restore')).toBeEnabled();
  await page.evaluate(() => document.fonts.ready);
}

async function surface(button: Locator) {
  return button.evaluate((el) => {
    const css = getComputedStyle(el);
    return {
      background: css.backgroundColor,
      color: css.color,
      border: css.borderColor,
      borderWidth: parseFloat(css.borderTopWidth),
      borderStyle: css.borderTopStyle,
      outline: css.outlineStyle,
      outlineWidth: parseFloat(css.outlineWidth),
    };
  });
}

function contrast(foreground: string, background: string) {
  const luminance = (color: string) => {
    const rgb = color
      .match(/[\d.]+/g)!
      .slice(0, 3)
      .map(Number);
    const [r, g, b] = rgb.map((value) => {
      const channel = value / (color.startsWith('color(srgb') ? 1 : 255);
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return r * 0.2126 + g * 0.7152 + b * 0.0722;
  };
  const a = luminance(foreground),
    b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('document-assistant-enabled', 'true');
    localStorage.setItem('agent-local-preset', 'Qwen3-4B-q4f16_1-MLC');
    localStorage.setItem('agent_conversation_saving_v2', 'true');
  });
});

for (const scheme of ['light', 'dark'] as const) {
  test(`history command rows stay aligned and retain safe deletion states in ${scheme}`, async ({
    page,
    browserName,
  }, info) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ colorScheme: scheme });
    // Exercise the product's persisted theme choice as well as media emulation;
    // a screenshot named "dark" must not silently accept a light token canvas.
    await page.addInitScript((theme) => localStorage.setItem('ran-theme', theme), scheme);
    for (const locale of ['en', 'pt']) {
      await page.setViewportSize({ width: 1280, height: 900 });
      await openHistory(page, locale);
      await expect(page.locator('html')).toHaveAttribute('data-ran-theme', scheme);
      const options = page.locator('.agent-history-options');
      for (const width of [1280, 360, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await page.mouse.move(0, 0);
        await page.locator('.agent-runtime-panel').screenshot({
          path: info.outputPath(`history-pane-${locale}-${width}-${scheme}.png`),
        });
        await options.scrollIntoViewIfNeeded();
        const section = (await options.boundingBox())!;
        await page.screenshot({
          path: info.outputPath(`history-actions-${locale}-${width}-${scheme}.png`),
          clip: { x: section.x - 8, y: section.y, width: section.width + 16, height: section.height },
        });
        const transfer = options.locator('.agent-history-restore, .agent-history-import, .agent-history-export');
        const danger = options.locator('.agent-history-delete-current, .agent-history-delete-all');
        const group = options.locator('.agent-history-transfer-actions');
        // Native button surfaces signal action before hover. Icon/checkbox and
        // label columns align independently of the gutter-extended hit target.
        const groupBox = (await group.boundingBox())!;
        const optionsBox = (await options.boundingBox())!;
        expect(groupBox.x).toBeCloseTo(optionsBox.x - 8, 1);
        expect(await frameLeft(options.locator('.agent-history-save'))).toBeCloseTo(16, 1);
        expect((await textGeometry(options.locator('label > span'))).textLeft).toBeCloseTo(40, 1);
        const canvas = await page
          .locator('.agent-runtime-panel')
          .evaluate((el) => getComputedStyle(el).backgroundColor);
        let previousBottom = 0;
        for (const button of await transfer.or(danger).all()) {
          const css = await surface(button);
          expect(css.background).not.toBe('rgba(0, 0, 0, 0)');
          expect(css.background, 'resting button must differ from the canvas').not.toBe(canvas);
          expect(contrast(css.color, css.background)).toBeGreaterThanOrEqual(4.5);
          const box = (await button.boundingBox())!;
          expect(box.height).toBeGreaterThanOrEqual(44);
          expect(box.x).toBeCloseTo(groupBox.x, 1);
          expect(box.y).toBeGreaterThanOrEqual(previousBottom);
          previousBottom = box.y + box.height;
          const icon = button.locator('svg[aria-hidden="true"]');
          await expect(icon).toBeVisible();
          expect(await frameLeft(icon)).toBeCloseTo(16, 1);
          const label = button.locator('.agent-history-action-label');
          const text = await textGeometry(label);
          expect(text.textLeft).toBeCloseTo(40, 1);
          expect(box.width).toBeLessThanOrEqual(text.textWidth + 41);
          await expect(button).toHaveAccessibleName((await label.innerText()).trim());
          expect(await button.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
        }
        const transferBottom = Math.max(
          ...(await transfer.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().bottom))),
        );
        const dangerTop = Math.min(
          ...(await danger.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().top))),
        );
        expect(dangerTop - transferBottom).toBeGreaterThanOrEqual(16);
        expect(await options.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
      }
      await page.setViewportSize({ width: 1280, height: 900 });
      const restore = options.locator('.agent-history-restore');
      await page.mouse.move(0, 0);
      const resting = await surface(restore);
      await restore.hover();
      const hovering = await surface(restore);
      expect(hovering.background).not.toBe(resting.background);
      await page.mouse.down();
      expect((await surface(restore)).background).not.toBe(hovering.background);
      await page.mouse.move(0, 0);
      await page.mouse.up();
      await restore.evaluate((el: HTMLButtonElement) => {
        el.disabled = true;
      });
      const disabled = await surface(restore);
      await restore.hover();
      expect(await surface(restore)).toEqual(disabled);
      await restore.evaluate((el: HTMLButtonElement) => {
        el.disabled = false;
      });

      for (const danger of await options.locator('.agent-history-danger-actions button').all()) {
        await page.mouse.move(0, 0);
        const restingDanger = await surface(danger);
        await danger.hover();
        const dangerHover = await surface(danger);
        expect(dangerHover.color).not.toBe(hovering.color);
        expect(restingDanger.borderWidth).toBe(0);
        expect(dangerHover.borderWidth).toBe(0);
        expect(contrast(dangerHover.color, dangerHover.background)).toBeGreaterThanOrEqual(4.5);
        await page.mouse.down();
        const dangerActive = await surface(danger);
        expect(dangerActive.color).not.toBe(hovering.color);
        expect(dangerActive.borderWidth).toBe(0);
        expect(contrast(dangerActive.color, dangerActive.background)).toBeGreaterThanOrEqual(4.5);
        await page.mouse.move(0, 0);
        await page.mouse.up();
      }

      const remove = options.locator('.agent-history-delete-current');
      await remove.focus();
      // Safari's native keyboard navigation uses Option+Tab to include buttons.
      const tab = browserName === 'webkit' ? 'Alt+Tab' : 'Tab';
      await page.keyboard.press(tab);
      await page.keyboard.press(`Shift+${tab}`);
      await expect(remove).toBeFocused();
      expect((await surface(remove)).outline).toBe('solid');
      expect((await surface(remove)).outlineWidth).toBeGreaterThanOrEqual(2);
      await page.keyboard.press('Enter');
      const confirmation = page.locator('.agent-history-confirmation');
      await expect(confirmation).toBeVisible();
      await expect(options.locator('.agent-history-cancel')).toBeFocused();
      const confirm = options.locator('.agent-history-confirm');
      await page.mouse.move(0, 0);
      const destructive = await surface(confirm);
      expect(destructive.background).not.toBe((await surface(remove)).background);
      expect(contrast(destructive.color, destructive.background)).toBeGreaterThanOrEqual(4.5);
      await confirm.hover();
      const destructiveHover = await surface(confirm);
      expect(destructiveHover.background).not.toBe(destructive.background);
      expect(contrast(destructiveHover.color, destructiveHover.background)).toBeGreaterThanOrEqual(4.5);
      await page.mouse.down();
      const destructiveActive = await surface(confirm);
      expect(destructiveActive.background).not.toBe(destructiveHover.background);
      expect(contrast(destructiveActive.color, destructiveActive.background)).toBeGreaterThanOrEqual(4.5);
      await page.mouse.move(0, 0);
      await page.mouse.up();
      await options.screenshot({ path: info.outputPath(`history-confirm-${locale}-${scheme}.png`) });
      // Pointer activation need not focus native buttons (Safari). Exercise the
      // confirmation's Escape contract with keyboard focus inside that region.
      await options.locator('.agent-history-cancel').focus();
      await expect(options.locator('.agent-history-cancel')).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(confirmation).toBeHidden();
      await expect(remove).toBeFocused();
      const download = page.waitForEvent('download');
      await options.locator('.agent-history-export').click();
      expect((await download).suggestedFilename()).toMatch(/^conversations-\d{4}-\d{2}-\d{2}\.json$/);
    }
  });
}

test.describe('touch history actions', () => {
  test.use({ hasTouch: true, viewport: { width: 320, height: 800 } });
  test('all commands and confirmation exits retain 44px touch targets', async ({ page }) => {
    test.setTimeout(90_000);
    await openHistory(page, 'pt');
    await page.locator('.agent-history-delete-all').click();
    for (const button of await page.locator('.agent-history-options button:visible').all()) {
      const box = (await button.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(320);
    }
    await page.locator('.agent-history-cancel').click();
    await expect(page.locator('.agent-history-confirmation')).toBeHidden();
    await expect(page.locator('.agent-history-delete-all')).toBeFocused();
  });
});
