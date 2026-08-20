import { expect, test } from './lib/l0';

test('homepage is the static landing: hero present, no editor bundle', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');

  await expect(page.locator('#landing-hero')).toBeVisible();
  await expect(page.locator('#hero-open')).toBeVisible();
  // Route split: / never mounts the editor shell, so nothing the editor
  // bundle builds is on the page.
  await expect(page.locator('#iframe')).toHaveCount(0);
  await expect(page.locator('#control-panel-container')).toHaveCount(0);
  expect(page.url()).not.toContain('/editor');
  expect(pageErrors).toEqual([]);
});

test('/editor?new=docx mounts the editor shell; legacy /?new=docx redirects there', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/?new=docx');
  await page.waitForURL(/\/editor\?new=docx/);
  await expect(page.locator('#app')).toBeVisible();
  // The #iframe placeholder is replaced by the DocsAPI iframe (name=frameEditor,
  // no id) as soon as the editor mounts, so accept either state.
  await expect(page.locator('#iframe, iframe[name="frameEditor"]').first()).toBeAttached();
  await expect(page.locator('#control-panel-container')).toBeAttached();
  // The bottom-right "Menu" FAB and its first-run guide bubble were removed on
  // 2026-08-20; nothing should bring them back.
  await expect(page.locator('#fab-container')).toHaveCount(0);
  await expect(page.locator('#menu-guide')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test('the editor page fits the viewport and renders in the ranui typeface', async ({ page }) => {
  // Two properties nothing else here asserted on, and both were broken.
  //
  // The typeface came from Tailwind's preflight (`html { font-family }`) and
  // went with it when the framework was dropped (2026-08-20): ran-tokens.css
  // only DECLARES --ran-font-family, and the rule that applies it lives in
  // home.css, which /editor never loads. The page fell back to Times.
  //
  // The fit was broken long before that, by a body-level `visibility: hidden`
  // file input that still takes up 25px after a 100%-height #app. Asserted on
  // the document rather than on the input so it also catches the next thing
  // that overflows -- an inline editor iframe would, if the vendor ever stopped
  // setting `vertical-align: top` on its own frame (preflight's
  // `iframe { display: block }` used to make that irrelevant).
  await page.setViewportSize({ width: 1280, height: 700 });
  await page.goto('/editor?new=docx');
  await expect(page.locator('#app')).toBeVisible();
  await expect(page.locator('iframe[name="frameEditor"]')).toBeAttached();

  const layout = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
    // Which family the page ASKS for, not whether the face loaded: a page with
    // none of its own falls back to the UA serif, and the agent panel then
    // mixes it with the Geist its ranui components resolve internally.
    fontFamily: getComputedStyle(document.body).fontFamily,
  }));

  expect(layout.scrollHeight).toBe(layout.clientHeight);
  expect(layout.fontFamily).toMatch(/Geist/);
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
