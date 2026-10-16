import { expect, test } from './lib/l0';

test('workspace pages share compact token geometry and a keyboard return path', async ({ page }, testInfo) => {
  test.setTimeout(90000);
  await page.addInitScript(() => {
    localStorage.setItem('document-assistant-enabled', 'true');
    localStorage.setItem('agent-local-preset', 'Qwen3-4B-q4f16_1-MLC');
  });
  await page.goto('/editor?new=docx&locale=en');
  await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
  await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
  await page.locator('.cui-input').fill('Keep this draft');
  await page.locator('.cui-input').evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(2, 6));
  await page.locator('.agent-sources-toggle').click();
  const source = page.locator('.agent-sources-view');
  const search = source.getByRole('searchbox', { name: 'Search sources', exact: true });
  await expect(search).toBeVisible();
  expect((await search.boundingBox())!.height).toBe(32);
  const section = source.getByRole('heading', { name: 'Local files', exact: true });
  expect(
    (await section.boundingBox())!.y - ((await search.boundingBox())!.y + (await search.boundingBox())!.height),
  ).toBeGreaterThanOrEqual(24);
  expect((await source.getByRole('button', { name: 'Back to conversation', exact: true }).boundingBox())!.height).toBe(
    32,
  );
  for (const width of [1280, 360, 320]) {
    await page.setViewportSize({ width, height: 800 });
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      for (const [open, view] of [
        ['.agent-sources-toggle', '.agent-sources-view'],
        ['.agent-panel-settings-toggle', '.agent-panel-settings'],
        ['.agent-history-toggle', '.agent-history-view'],
        ['.agent-workspace-toggle', '.agent-artifacts'],
      ] as const) {
        if (!(await page.locator(view).isVisible())) await page.locator(open).click();
        const current = page.locator(view);
        const header = current.locator('.agent-view-header');
        await expect(header).toBeVisible();
        expect(await header.locator('h2').evaluate((el) => getComputedStyle(el).fontSize)).toBe('20px');
        await expect(current.locator('.agent-view-back')).toHaveCount(1);
        if (view === '.agent-history-view') {
          expect((await current.locator('.agent-history-search-row').boundingBox())!.height).toBe(32);
        }
        if (view === '.agent-panel-settings') {
          expect((await current.locator('.agent-source-picker').boundingBox())!.height).toBe(32);
          for (const field of await current.locator('r-input:visible, r-select:visible').all()) {
            expect((await field.boundingBox())!.height).toBe(32);
          }
        }
        for (const summary of await current.locator('details > summary:visible').all()) {
          expect((await summary.boundingBox())!.height).toBe(32);
        }
        const back = header.getByRole('button', { name: 'Back to conversation', exact: true });
        expect((await back.boundingBox())!.height).toBe(32);
        expect(await current.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThan(2);
        await page
          .locator('.agent-runtime-panel')
          .screenshot({ path: testInfo.outputPath(`${view.slice(1)}-${width}-${scheme}.png`) });
        await back.focus();
        await back.press('Enter');
        await expect(page.locator('.agent-runtime-panel')).toHaveAttribute('data-view', 'chat');
        expect(
          await page.locator('.cui-root, .agent-runtime-panel').evaluateAll((els) => {
            const active = document.activeElement;
            return els.some((el) => !!active && el.contains(active) && active.closest('.cui-messages, .cui-input'));
          }),
        ).toBe(true);
        await expect(page.locator('.cui-input')).toHaveValue('Keep this draft');
        expect(
          await page.locator('.cui-input').evaluate((el: HTMLTextAreaElement) => [el.selectionStart, el.selectionEnd]),
        ).toEqual([2, 6]);
      }
    }
  }
  await page.goto('/editor?new=docx&locale=pt');
  await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
  await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
  await page.locator('.agent-sources-toggle').click();
  const translated = page.locator('.agent-sources-view');
  await expect(translated.locator('.agent-view-back')).toHaveAttribute('aria-label', /.+/);
  expect(await translated.locator('.agent-view-back').getAttribute('aria-label')).not.toBe('Back to conversation');
  expect(await translated.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThan(2);
  for (const button of await translated.locator('button:visible').all()) {
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(32);
    expect(await button.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThan(2);
  }
});

test('artifact commands distinguish disabled, ordinary and explicit save states', async ({ page }) => {
  test.setTimeout(90000);
  await page.addInitScript(() => {
    localStorage.setItem('document-assistant-enabled', 'true');
    localStorage.setItem('agent-local-preset', 'Qwen3-4B-q4f16_1-MLC');
  });
  await page.goto('/editor?new=docx&locale=en');
  await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
  await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
  await page.locator('.agent-workspace-toggle').click();
  await page.locator('.agent-artifacts [data-action=import]').click();
  const artifacts = page.locator('.agent-artifacts');
  await expect(artifacts.getByRole('button', { name: 'Back to artifacts', exact: true })).toBeVisible();
  await artifacts.getByRole('textbox', { name: 'Title', exact: true }).fill('Table');
  await artifacts
    .locator('textarea')
    .fill(JSON.stringify({ schemaVersion: 1, payload: { kind: 'table', columns: ['Name'], rows: [['A']] } }));
  await artifacts.locator('[data-action=saveNew]').click();
  await expect(artifacts.locator('.agent-artifact-status')).toHaveText('Saved on this device');
  const save = artifacts.locator('[data-action=saveVersion]');
  await expect(save).toBeDisabled();
  const disabled = await save.evaluate((el) => getComputedStyle(el).backgroundColor);
  await save.hover();
  expect(await save.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(disabled);
  await artifacts.getByRole('textbox', { name: 'Title', exact: true }).fill('Renamed table');
  await expect(save).toBeEnabled();
  expect(await save.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(disabled);
  const ordinary = artifacts.locator('[data-action=delete]');
  const idle = await ordinary.evaluate((el) => getComputedStyle(el).backgroundColor);
  await ordinary.hover();
  expect(await ordinary.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(idle);
  expect((await ordinary.boundingBox())!.height).toBe(32);
  const back = artifacts.getByRole('button', { name: 'Back to artifacts', exact: true });
  await back.click();
  await expect(artifacts.locator('[data-action=discardChanges]')).toBeVisible();
  await artifacts.locator('[data-action=cancel]').click();
  await expect(artifacts.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue('Renamed table');
});

test.describe('coarse pointer workspace', () => {
  test.use({ hasTouch: true, viewport: { width: 360, height: 800 } });
  test('keeps physical command targets while retaining compact visual hierarchy', async ({ page }) => {
    test.setTimeout(90000);
    await page.addInitScript(() => {
      localStorage.setItem('document-assistant-enabled', 'true');
      localStorage.setItem('agent-local-preset', 'Qwen3-4B-q4f16_1-MLC');
    });
    await page.goto('/editor?new=docx&locale=en');
    await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
    await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
    await page.locator('.agent-sources-toggle').click();
    const source = page.locator('.agent-sources-view');
    const back = source.locator('.agent-view-back');
    expect((await back.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect((await back.boundingBox())!.width).toBeGreaterThanOrEqual(44);
    expect(
      (await source.getByRole('searchbox', { name: 'Search sources', exact: true }).boundingBox())!.height,
    ).toBeGreaterThanOrEqual(44);
    for (const button of await source.locator('button:visible').all()) {
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    expect(await source.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThan(2);
    await back.click();
    await page.locator('.agent-panel-settings-toggle').click();
    expect((await page.locator('.agent-source-picker').boundingBox())!.height).toBeGreaterThanOrEqual(44);
    for (const summary of await page.locator('.agent-panel-settings details > summary:visible').all()) {
      expect((await summary.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
  });
});
