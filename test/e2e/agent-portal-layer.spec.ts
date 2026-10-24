import { expect, test } from './lib/l0';

// ranui opens select lists and popovers as body-level <r-dropdown> portals. The
// assistant panel sits at z-index 10000, so each portal opened from inside it
// must be the topmost element where it is drawn, or the panel swallows clicks.
test('a select opened inside the assistant panel draws above the panel', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => localStorage.setItem('document-assistant-enabled', 'true'));
  await page.goto('/editor?new=docx&locale=en');
  await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
  await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
  // Model discovery decides whether the panel lands in chat or settings; wait
  // for it, then make sure the settings view (with its source select) is shown.
  const panel = page.locator('.agent-runtime-panel');
  await expect(page.locator('.agent-model-cache > summary')).toContainText('(0)');
  if ((await panel.getAttribute('data-view')) !== 'settings')
    await page.locator('.agent-panel-settings-toggle').click();
  await expect(panel).toHaveAttribute('data-view', 'settings');

  await page.locator('.agent-panel-settings r-select:visible').first().click();
  const list = page.locator('r-dropdown[role="listbox"]:visible');
  await expect(list).toHaveCount(1);
  const topmost = await list.evaluate((portal) => {
    const box = portal.getBoundingClientRect();
    const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return hit === portal || portal.contains(hit);
  });
  expect(topmost).toBe(true);
});
