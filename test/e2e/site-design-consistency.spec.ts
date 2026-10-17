import { expect, test } from './lib/l0';
import type { Page } from '@playwright/test';

async function observeComponents(page: Page) {
  await page.addInitScript(() => {
    const roots = new WeakMap<Element, ShadowRoot>();
    const attach = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (options) {
      const root = attach.call(this, options);
      roots.set(this, root);
      return root;
    };
    Object.assign(window, {
      siteComponentPart(element: Element, part: string) {
        const target = roots.get(element)?.querySelector(`[part="${part}"]`);
        if (!target) throw new Error(`Missing component part ${part}`);
        const css = getComputedStyle(target);
        return {
          text: target.textContent,
          color: css.color,
          background: css.backgroundColor,
          border: css.borderColor,
          height: target.getBoundingClientRect().height,
          shadow: css.boxShadow,
        };
      },
    });
  });
}

// Read actual closed-shadow component surfaces; never substitute a mock modal.
const part = (page: Page, selector: string, name = 'content') =>
  page
    .locator(selector)
    .first()
    .evaluate(
      (element, partName) =>
        (
          window as unknown as {
            siteComponentPart(
              element: Element,
              part: string,
            ): { text: string; color: string; background: string; border: string; height: number; shadow: string };
          }
        ).siteComponentPart(element, partName),
      name,
    );

const command = (page: Page, selector: string) =>
  page.locator(selector).evaluate((el) => {
    const css = getComputedStyle(el);
    return { color: css.color, background: css.backgroundColor, shadow: css.boxShadow };
  });

function contrast(foreground: string, background: string) {
  const luminance = (color: string) => {
    const rgb = color
      .match(/[\d.]+/g)!
      .slice(0, 3)
      .map((value) => {
        const channel = Number(value) / (color.startsWith('color(srgb') ? 1 : 255);
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  const a = luminance(foreground),
    b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

for (const scheme of ['light', 'dark'] as const) {
  test(`all page families keep a visible home destination and token density in ${scheme}`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90000);
    await page.emulateMedia({ colorScheme: scheme });
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 800 });
      for (const route of ['/', '/help', '/history?locale=en', '/404.html', '/embed-demo']) {
        await page.goto(route);
        const brand = page.locator('header.bar .brand');
        await expect(brand).toBeVisible();
        expect((await brand.boundingBox())!.width).toBeGreaterThan(20);
        await expect(brand).toHaveAttribute('href', '/');
        if (route.startsWith('/history')) {
          const empty = await page.locator('.history-empty').boundingBox();
          const action = await page.locator('.history-empty-action').boundingBox();
          expect(Math.abs(action!.x + action!.width / 2 - (empty!.x + empty!.width / 2))).toBeLessThanOrEqual(1);
        }
        const header = page.locator('header.bar');
        expect((await header.boundingBox())!.height).toBeLessThanOrEqual(width <= 390 ? 112 : 80);
        if (route === '/embed-demo' && width === 320)
          await header.screenshot({ path: testInfo.outputPath(`embed-header-${scheme}-320.png`) });
        expect(await header.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThan(2);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThan(2);
        if (route === '/404.html') {
          const diagram = page.locator('.nf-win');
          await expect(page.locator('.nf-bar i + i').first()).toHaveCSS('margin-left', '-6px');
          expect(await diagram.evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe('1px');
          expect(await diagram.evaluate((el) => getComputedStyle(el).fontFamily)).toContain('Geist Mono');
          expect(await page.locator('.nf-net i').evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(
            'rgba(0, 0, 0, 0)',
          );
        }
      }
    }
  });
}

test('all seven localized generated headers keep their localized accessible home link', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  for (const locale of ['', 'zh-CN', 'ja', 'ko', 'de', 'es', 'pt']) {
    const prefix = locale ? `/${locale}` : '';
    for (const path of ['/', '/help']) {
      await page.goto(`${prefix}${path}`);
      const brand = page.locator('header.bar .brand');
      await expect(brand).toBeVisible();
      expect((await brand.innerText()).trim().length).toBeGreaterThan(0);
      expect((await brand.boundingBox())!.width).toBeGreaterThan(20);
      await expect(brand).toHaveAttribute('href', prefix ? `${prefix}/` : '/');
      expect(await page.locator('header.bar').evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThan(2);
      expect((await page.locator('header.bar').boundingBox())!.height).toBeLessThanOrEqual(112);
    }
  }
});

for (const scheme of ['light', 'dark'] as const) {
  test(`history uses the actual modal heading and semantic danger states in ${scheme}`, async ({ page }) => {
    await observeComponents(page);
    test.setTimeout(90000);
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/history?locale=en');
    await expect(page.locator('#history-clear-all')).toBeVisible();
    expect((await part(page, '.history-header-actions r-button')).height).toBe(42);
    expect((await page.locator('#history-clear-all').boundingBox())!.height).toBe(42);
    await page.locator('#history-clear-all').click();
    await expect(page.locator('.confirm-dialog')).toHaveAttribute('heading', 'Delete everything');
    expect((await part(page, '.confirm-dialog', 'title')).text).toBe('Delete everything');
    const danger = page.locator('.confirm-ok-danger');
    await page.mouse.move(0, 0);
    const resting = await command(page, '.confirm-ok-danger');
    await danger.hover();
    const hovering = await command(page, '.confirm-ok-danger');
    expect(contrast(resting.color, resting.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(hovering.color, hovering.background)).toBeGreaterThanOrEqual(4.5);
    expect(hovering.background).not.toBe(resting.background);
    expect(hovering.color).toBe(resting.color);
    await page.mouse.down();
    const active = await command(page, '.confirm-ok-danger');
    expect(active.background).not.toBe(hovering.background);
    expect(contrast(active.color, active.background)).toBeGreaterThanOrEqual(4.5);
    await page.mouse.move(0, 0);
    await page.mouse.up();
    // No deletion: cancellation is a first-class exit even after press-drag away.
    await page.keyboard.press('Escape');
    await expect(page.locator('.confirm-dialog')).not.toHaveAttribute('open');
    expect(await page.locator('#history-clear-all').evaluate((el) => document.activeElement === el)).toBe(true);
    await page.waitForTimeout(350);
    // A restored focus target must still execute through the keyboard.
    await page.keyboard.press('Enter');
    await expect(page.locator('.confirm-dialog')).toHaveAttribute('open', 'true');
    for (let step = 0; step < 10 && !(await danger.evaluate((el) => document.activeElement === el)); step++)
      await page.keyboard.press('Tab');
    expect(await danger.evaluate((el) => document.activeElement === el)).toBe(true);
    expect((await command(page, '.confirm-ok-danger')).shadow).not.toBe('none');
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('.confirm-cancel')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('.confirm-dialog')).not.toHaveAttribute('open');
    await page.waitForTimeout(350);
    await page.locator('#history-clear-all').click();
    await page.locator('.confirm-ok-danger').evaluate((el) => el.setAttribute('disabled', ''));
    const disabled = await command(page, '.confirm-ok-danger');
    await page.locator('.confirm-ok-danger').hover();
    expect((await command(page, '.confirm-ok-danger')).background).toBe(disabled.background);
    await page.keyboard.press('Escape');
  });
}

test.describe('coarse pointers', () => {
  test.use({ hasTouch: true, viewport: { width: 320, height: 800 } });
  test('page and inline actions share 44px targets without clipping', async ({ page }) => {
    await observeComponents(page);
    for (const route of ['/', '/offline-document-editor', '/history?locale=en', '/embed-demo']) {
      await page.goto(route);
      for (const selector of route.startsWith('/history')
        ? ['.history-header-actions r-button', '#history-clear-all']
        : route === '/embed-demo'
          ? ['.actions r-button:first-child']
          : ['.cta r-button']) {
        const height =
          selector === '#history-clear-all'
            ? (await page.locator(selector).boundingBox())!.height
            : (await part(page, selector)).height;
        expect(height).toBeGreaterThanOrEqual(44);
      }
      if (route.startsWith('/history')) {
        const empty = await page.locator('.history-empty').boundingBox();
        const action = await page.locator('.history-empty-action').boundingBox();
        expect(Math.abs(action!.x + action!.width / 2 - (empty!.x + empty!.width / 2))).toBeLessThanOrEqual(1);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThan(2);
    }
  });
});
