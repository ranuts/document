import { expect, test } from './lib/l0';
import { assertTitleRail, contentGeometry, frameLeft, selectionGeometry, textGeometry } from './lib/layout-geometry';

const variants = [
  { width: 1280, locale: 'en', coarse: false },
  { width: 1280, locale: 'pt', coarse: true },
  { width: 360, locale: 'en', coarse: false },
  { width: 320, locale: 'pt', coarse: true },
];

test('assistant onboarding copy returns to the same content rail as its header', async ({ page }) => {
  await page.goto('/editor?new=docx&locale=en');
  await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
  await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
  const onboarding = page.locator('.agent-onboarding');
  await expect(onboarding).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect((await textGeometry(onboarding.locator('header strong'))).textLeft).toBeCloseTo(16, 1);
  expect((await textGeometry(onboarding.locator('.agent-welcome h2'))).textLeft).toBeCloseTo(16, 1);
  expect((await textGeometry(onboarding.locator('.agent-welcome > p').first())).textLeft).toBeCloseTo(16, 1);
});

test('layout acceptance rejects text-only drift, expanded hover and displaced sibling rails', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('document-assistant-enabled', 'true'));
  await page.goto('/editor?new=docx&locale=en');
  await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
  await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
  const title = page.locator('.agent-runtime-panel .agent-panel-title');
  await expect(title).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const baseline = await assertTitleRail(title);
  // Total padding and the outer frame stay unchanged; only visible text moves.
  await title.evaluate((el) => (el.style.paddingInline = '16px 0'));
  expect((await textGeometry(title)).width).toBe(baseline.width);
  await expect(assertTitleRail(title)).rejects.toThrow();
  await title.evaluate((el) => el.removeAttribute('style'));
  await assertTitleRail(title);
  await title.evaluate((el) => (el.style.flex = '1'));
  await expect(assertTitleRail(title)).rejects.toThrow();
  await title.evaluate((el) => el.removeAttribute('style'));
  const settings = page.locator('.agent-panel-settings');
  if (!(await settings.isVisible())) await page.locator('.agent-panel-settings-toggle').click();
  await expect(settings).toBeVisible();
  expect((await contentGeometry(settings)).contentLeft).toBe(16);
  await settings.evaluate((el) => (el.style.paddingInlineStart = '24px'));
  await expect((async () => expect((await contentGeometry(settings)).contentLeft).toBe(16))()).rejects.toThrow();
  await settings.evaluate((el) => el.removeAttribute('style'));
  expect((await contentGeometry(settings)).contentLeft).toBe(16);
});

test('populated conversation and source disclosures return to the content rail', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('document-assistant-enabled', 'true');
    localStorage.setItem('agent_history_default', JSON.stringify([{ role: 'user', content: 'Layout conversation' }]));
    const now = Date.now();
    localStorage.setItem(
      'agent_sessions_v1',
      JSON.stringify({ sessions: [{ id: 'default', title: 'Layout conversation', createdAt: now, updatedAt: now }] }),
    );
  });
  await page.goto('/editor?new=docx&locale=en');
  await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
  await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
  await page.locator('.agent-history-toggle').click();
  await page.locator('.agent-history-management > summary').click();
  await page.locator('.agent-history-import').click();
  const row = page.locator('.agent-conversation-title').filter({ hasText: 'Layout conversation' });
  await expect(row).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect((await textGeometry(row)).textLeft).toBeCloseTo(16, 1);
  expect(await frameLeft(page.locator('.agent-history-management > summary'))).toBeCloseTo(16, 1);
  await page.locator('.agent-panel-title').click();
  await page.locator('.agent-sources-toggle').click();
  const sources = page.locator('.agent-sources-view');
  await sources.locator('input[type="file"]').setInputFiles({
    name: 'layout-notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('A local reference excerpt.'),
  });
  const preview = sources.locator('.agent-source-preview');
  await expect(preview).toContainText('layout-notes.txt');
  expect(await frameLeft(preview)).toBeCloseTo(16, 1);
  await preview.locator('summary').click();
  await expect(preview.locator('pre')).toHaveText('A local reference excerpt.');
  expect((await textGeometry(preview.locator('pre'))).textLeft).toBeCloseTo(16, 1);
  const status = sources.locator('.agent-sources-status');
  if (await status.isVisible()) expect(await frameLeft(status)).toBeCloseTo(16, 1);
});

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
        const titleBox = await assertTitleRail(title);
        if (variant.width <= 360 || variant.coarse)
          expect(titleBox.width).toBeGreaterThanOrEqual(Math.min(titleBox.textWidth + 16, variant.width - 24));
        await title.hover();
        await expect(title).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
        await title.click();
        await expect(panel).toHaveAttribute('data-view', 'chat');
        const originalTitle = await title.textContent();
        await title.evaluate((el) => (el.textContent = 'A long translated assistant workspace title '.repeat(4)));
        await assertTitleRail(title);
        const actions = await panel.locator('.agent-panel-header button').evaluateAll((buttons) => {
          const bounds = buttons[0].closest('.agent-panel')!.getBoundingClientRect();
          return buttons.map((button) => {
            const rect = button.getBoundingClientRect();
            return {
              left: rect.left - bounds.left,
              right: rect.right - bounds.left,
              top: rect.top,
              bottom: rect.bottom,
              width: rect.width,
              height: rect.height,
              panelWidth: bounds.width,
            };
          });
        });
        for (const action of actions) {
          expect(action.left).toBeGreaterThanOrEqual(0);
          expect(action.right).toBeLessThanOrEqual(action.panelWidth);
          if (variant.coarse) {
            expect(action.width).toBeGreaterThanOrEqual(44);
            expect(action.height).toBeGreaterThanOrEqual(44);
          }
        }
        for (let index = 0; index < actions.length; index++) {
          for (const next of actions.slice(index + 1)) {
            const current = actions[index];
            const overlapX = Math.max(0, Math.min(current.right, next.right) - Math.max(current.left, next.left));
            const overlapY = Math.max(0, Math.min(current.bottom, next.bottom) - Math.max(current.top, next.top));
            expect(overlapX * overlapY, 'header hit areas must not overlap').toBe(0);
          }
        }
        await title.evaluate((el, text) => (el.textContent = text), originalTitle);
        await page.locator('.cui-input').fill('Preserve this draft while checking every view');

        for (const [toggle, selector, frame] of [
          ['.agent-panel-settings-toggle', '.agent-panel-settings', '.agent-source-picker'],
          ['.agent-history-toggle', '.agent-history-view', '.agent-history-search-row'],
          ['.agent-sources-nav', '.agent-sources-view', 'input[type="search"]'],
          ['.agent-workspace-toggle', '.agent-artifacts', ':scope > div:not(.agent-view-header)'],
        ]) {
          await panel.locator(toggle).click();
          const view = panel.locator(selector);
          await expect(view.locator('.agent-view-back')).toHaveCount(0);
          const geometry = await contentGeometry(view);
          expect(geometry.contentLeft, selector).toBeCloseTo(16, 1);
          expect(geometry.headingLeft, selector).toBeCloseTo(16, 1);
          expect(geometry.overflow, selector).toBeLessThanOrEqual(1);
          expect(await frameLeft(view.locator(frame).first()), selector).toBeCloseTo(16, 1);
          const firstContent = view
            .locator(
              selector === '.agent-sources-view'
                ? ':scope > .agent-entry-note'
                : selector === '.agent-artifacts'
                  ? ':scope > div:not(.agent-view-header) > :is(p, ul)'
                  : frame,
            )
            .first();
          const firstTop = await firstContent.evaluate((el) => el.getBoundingClientRect().top);
          expect(firstTop - geometry.headerBottom, `${selector} first content group`).toBe(16);
          const heading = view.locator('.agent-view-header h2');
          const originalHeading = await heading.textContent();
          await heading.evaluate(
            (el) => (el.textContent = 'A translated workspace heading with several lines '.repeat(3)),
          );
          expect((await contentGeometry(view)).overflow, `${selector} long heading`).toBeLessThanOrEqual(1);
          await heading.evaluate((el, text) => (el.textContent = text), originalHeading);
          if (selector === '.agent-panel-settings') {
            for (const control of await view.locator('r-select:visible').all()) {
              const selection = await selectionGeometry(control);
              expect(selection.inset).toBeCloseTo(13, 1);
              expect(selection.clipped).toBe(false);
              expect(selection.partInside).toBe(true);
            }
          }
          if (selector === '.agent-sources-view') {
            const gap = await view.evaluate((el) => {
              const excerpt = el.querySelector('.agent-entry-note')!.getBoundingClientRect();
              return el.querySelector('input[type="search"]')!.getBoundingClientRect().top - excerpt.bottom;
            });
            expect(gap, 'source intro and search form a separate group').toBe(16);
          }
          await panel.screenshot({ path: testInfo.outputPath(`${selector.slice(1)}-${theme}.png`) });
          const chatNavigation = panel.locator('.agent-chat-toggle');
          await page.keyboard.press('Tab');
          await chatNavigation.focus();
          expect(await chatNavigation.evaluate((el) => el.matches(':focus-visible'))).toBe(true);
          const focus = await chatNavigation.evaluate((el) => {
            const style = getComputedStyle(el);
            return { width: Number.parseFloat(style.outlineWidth), offset: Number.parseFloat(style.outlineOffset) };
          });
          expect(focus.width, `${selector} keyboard navigation outline`).toBeGreaterThanOrEqual(2);
          expect(focus.offset).toBeLessThanOrEqual(0);
          await chatNavigation.press('Enter');
          await expect(panel).toHaveAttribute('data-view', 'chat');
          await expect(page.locator('.cui-input')).toHaveValue('Preserve this draft while checking every view');
        }

        // Import and editor return states share the same header and content owner.
        await panel.locator('.agent-workspace-toggle').click();
        const artifacts = panel.locator('.agent-artifacts');
        const importing = artifacts.locator('[data-action="import"]');
        await expect(importing).toBeVisible();
        expect(await frameLeft(importing)).toBeCloseTo(16, 1);
        if (await artifacts.locator('.agent-artifacts-list > li').count()) {
          const gap = await importing.evaluate((el) => {
            const list = el.parentElement!.querySelector('.agent-artifacts-list')!;
            return el.getBoundingClientRect().top - list.getBoundingClientRect().bottom;
          });
          expect(gap, 'saved results and the import action form separate groups').toBe(16);
        }
        const emptyCopy = artifacts.locator(':scope > div:not(.agent-view-header) > p');
        if (await emptyCopy.count()) expect((await textGeometry(emptyCopy)).textLeft).toBeCloseTo(16, 1);
        await importing.click();
        const form = artifacts.locator('.agent-artifact-import');
        const input = form.locator('input');
        await expect(input).toBeVisible();
        for (const field of await form.locator('input, textarea, label > span').all())
          expect(await frameLeft(field)).toBeCloseTo(16, 1);
        expect((await contentGeometry(artifacts)).headingLeft).toBeCloseTo(16, 1);
        await expect(artifacts.locator('.agent-view-back span')).toBeVisible();
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
        expect((await contentGeometry(artifacts)).headingLeft).toBeCloseTo(16, 1);
        await panel.screenshot({ path: testInfo.outputPath(`artifact-editor-${theme}.png`) });
        await artifacts.locator('.agent-view-back').click();
        await expect(artifacts.locator('[data-action="import"]')).toBeVisible();
        await panel.locator('.agent-chat-toggle').click();
      }
    });
  });
}
