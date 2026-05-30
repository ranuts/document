import { expect, test } from '@playwright/test';

test('homepage loads without page errors', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');

  await expect(page.locator('#app')).toBeVisible();
  await expect(page.locator('#iframe')).toBeAttached();
  await expect(page.locator('#fab-container')).toBeAttached();
  await expect(page.locator('#control-panel-container')).toBeAttached();
  expect(pageErrors).toEqual([]);
});

test('manifest and service worker assets are reachable', async ({ request }) => {
  const manifest = await request.get('/manifest.json');
  expect(manifest.ok()).toBe(true);

  const serviceWorker = await request.get('/sw.js');
  expect(serviceWorker.ok()).toBe(true);
});
