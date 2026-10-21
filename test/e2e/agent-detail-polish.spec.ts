import { expect, test } from './lib/l0';

for (const variant of [
  { width: 1280, locale: 'en', coarse: false },
  { width: 320, locale: 'pt', coarse: true },
]) {
  test.describe(`${variant.width}px ${variant.locale} detail polish`, () => {
    test.use({ viewport: { width: variant.width, height: 900 }, hasTouch: variant.coarse });
    test('related helper copy and separate fields keep their own vertical rhythm', async ({ page }) => {
      await page.addInitScript(() => {
        localStorage.setItem('document-assistant-enabled', 'true');
        localStorage.setItem('agent-local-preset', 'Qwen3-4B-q4f16_1-MLC');
      });
      await page.goto(`/editor?new=docx&locale=${variant.locale}`);
      await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
      await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
      await page.locator('.agent-sources-nav').click();
      const helperGap = await page
        .locator('.agent-sources-view')
        .evaluate(
          (el) =>
            el.lastElementChild!.getBoundingClientRect().top -
            el.querySelector('.agent-source-attach')!.getBoundingClientRect().bottom,
        );
      expect(helperGap, 'Attach and its explanation form an 8px group').toBe(8);
      await page.locator('.agent-panel-settings-toggle').click();
      const gaps = await page.locator('.agent-panel-model-row').evaluate((el) => {
        const rect = (selector: string) => el.querySelector(selector)!.getBoundingClientRect();
        return {
          helper: rect('.agent-model-memory').top - rect('r-select').bottom,
          action: rect('.agent-model-actions').top - rect('.agent-model-memory').bottom,
        };
      });
      expect(gaps).toEqual({ helper: 8, action: 16 });
      await page.locator('.agent-preferences > summary').click();
      const fieldGaps = await page.locator('.agent-custom-sources').evaluate((el) => {
        const fields = [...el.querySelectorAll('.agent-settings-field')];
        return fields
          .slice(1)
          .map((field, i) => field.getBoundingClientRect().top - fields[i].getBoundingClientRect().bottom);
      });
      expect(fieldGaps).toEqual([16, 16]);
      expect(
        await page.locator('.agent-panel-settings').evaluate((el) => el.scrollWidth - el.clientWidth),
      ).toBeLessThanOrEqual(1);
    });
  });
}

test('keyboard source removal and long artifact deletion keep a visible focus destination', async ({ page }) => {
  test.setTimeout(90000);
  await page.addInitScript(() => localStorage.setItem('document-assistant-enabled', 'true'));
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/editor?new=docx&locale=en');
  await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
  await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
  await page.locator('.agent-sources-nav').click();
  for (const name of ['one.txt', 'two.txt']) {
    await page
      .locator('.agent-sources-view input[type=file]')
      .setInputFiles({ name, mimeType: 'text/plain', buffer: Buffer.from(name) });
    await expect(page.locator('.agent-source-preview summary').filter({ hasText: name })).toBeVisible();
  }
  await page.locator('.agent-source-remove').first().focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Remove: two.txt', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.agent-source-attach')).toBeFocused();
  await page.locator('.agent-workspace-toggle').click();
  await page.locator('[data-action=import]').click();
  await page.locator('.agent-artifact-import input').fill('Long draft');
  await page
    .locator('.agent-artifacts textarea')
    .fill(JSON.stringify({ schemaVersion: 1, payload: { kind: 'text', text: 'A long draft line\n'.repeat(150) } }));
  await page.locator('[data-action=saveNew]').click();
  const remove = page.locator('.agent-artifacts [data-action=delete]');
  await remove.focus();
  await page.keyboard.press('Enter');
  const cancel = page.locator('.agent-artifacts [data-action=cancel]');
  await expect(cancel).toBeFocused();
  const confirmationGap = await cancel.evaluate((el) => {
    const confirm = el.parentElement!.querySelector('[data-action=confirmDelete]')!.getBoundingClientRect();
    const cancel = el.getBoundingClientRect();
    return Math.abs(cancel.top - confirm.top) < 1 ? cancel.left - confirm.right : cancel.top - confirm.bottom;
  });
  expect(confirmationGap, 'confirmation actions keep an 8px separation').toBe(8);
  const bounds = await cancel.boundingBox();
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(700);
  await page.keyboard.press('Enter');
  await expect(remove).toBeFocused();
  await expect(page.locator('.agent-artifact-editor > textarea')).toHaveValue('A long draft line\n'.repeat(150));
});

test.describe('touch starter actions and attached-source labels', () => {
  test.use({ viewport: { width: 320, height: 900 }, hasTouch: true });
  test('uses physical targets and a shared first-line text center', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('document-assistant-enabled', 'true');
      localStorage.setItem('agent-local-preset', 'Qwen3-4B-q4f16_1-MLC');
    });
    await page.goto('/editor?new=docx&locale=pt');
    await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
    await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
    await page.locator('.agent-chat-toggle').click();
    await expect(page.locator('.agent-task-action')).toHaveCount(3);
    for (const action of await page.locator('.agent-task-action').all())
      expect.soft((await action.boundingBox())!.height, 'starter action target').toBeGreaterThanOrEqual(44);
    await page.locator('.agent-sources-nav').click();
    await page
      .locator('.agent-sources-view input[type=file]')
      .setInputFiles({ name: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from('Local excerpt') });
    const row = page.locator('.agent-source-row');
    await expect(row).toBeVisible();
    const centers = await row.evaluate((el) => {
      const center = (selector: string) => {
        const range = document.createRange();
        range.selectNodeContents(el.querySelector(selector)!);
        const firstLine = range.getClientRects()[0];
        return (firstLine.top + firstLine.bottom) / 2;
      };
      return { filename: center('summary'), remove: center('button') };
    });
    expect.soft(Math.abs(centers.filename - centers.remove), 'filename and Remove text centers').toBeLessThanOrEqual(1);
    await row.locator('summary').click();
    await expect(row.locator('pre')).toHaveText('Local excerpt');
    expect((await row.locator('summary').boundingBox())!.height).toBeGreaterThanOrEqual(44);
  });
});
