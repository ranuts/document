import { expect, test } from './lib/l0';

test('homepage is the static landing: hero present, no editor bundle', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');

  await expect(page.locator('#landing-hero')).toBeVisible();
  await expect(page.locator('#hero-open')).toBeVisible();
  // Route split: / never mounts the editor shell.
  await expect(page.locator('#iframe')).toHaveCount(0);
  await expect(page.locator('#fab-container')).toHaveCount(0);
  expect(page.url()).not.toContain('/editor');
  expect(pageErrors).toEqual([]);
});

test('/editor?new=docx mounts the editor shell; legacy /?new=docx redirects there', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/?new=docx');
  await page.waitForURL(/\/editor\?new=docx/);
  await expect(page.locator('#app')).toBeVisible();
  await expect(page.locator('#iframe')).toBeAttached();
  await expect(page.locator('#fab-container')).toBeAttached();
  await expect(page.locator('#control-panel-container')).toBeAttached();
  expect(pageErrors).toEqual([]);
});

test('bare /editor with nothing to open goes back to the landing', async ({ page }) => {
  await page.goto('/editor');
  await page.waitForURL((u) => u.pathname === '/');
  await expect(page.locator('#landing-hero')).toBeVisible();
});

test('manifest and service worker assets are reachable', async ({ request }) => {
  const manifest = await request.get('/manifest.json');
  expect(manifest.ok()).toBe(true);

  const serviceWorker = await request.get('/sw.js');
  expect(serviceWorker.ok()).toBe(true);
});
