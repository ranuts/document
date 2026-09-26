import { expect, test } from './lib/l0';

for (const system of ['light', 'dark'] as const) {
  for (const choice of ['system', 'light', 'dark'] as const) {
    test(`${system} system with ${choice} choice keeps theme metadata and icons consistent`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: system });
      await page.addInitScript((theme) => localStorage.setItem('ran-theme', theme), choice);
      await page.goto('/');
      const expected = choice === 'system' ? system : choice;
      await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute(
        'href',
        new RegExp(`document-${expected}\\.svg$`),
      );
      await expect(page.locator('link[rel="icon"][type="image/png"]')).toHaveAttribute(
        'href',
        new RegExp(`document-${expected}-32\\.png$`),
      );
      await expect(page.locator('meta[name="theme-color"]:not([media])')).toHaveAttribute(
        'content',
        expected === 'dark' ? '#000000' : '#ffffff',
      );
      await expect
        .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).colorScheme))
        .toBe(expected);
    });
  }
}

test('manual switches and subsequent system changes update presentation together', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/zh-CN/');
  const control = page.locator('r-theme-switch');
  // ranui uses a closed shadow root; exercise the control's public value API.
  await control.evaluate((element) => {
    (element as HTMLElement & { value: string }).value = 'dark';
  });
  await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute('href', /document-dark\.svg$/);
  await expect(page.locator('meta[name="theme-color"]:not([media])')).toHaveAttribute('content', '#000000');
  await control.evaluate((element) => {
    (element as HTMLElement & { value: string }).value = 'system';
  });
  await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute('href', /document-light\.svg$/);
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute('href', /document-dark\.svg$/);
});

for (const theme of ['light', 'dark'] as const) {
  test(`${theme} editor opens with matching shell and vendor theme`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ colorScheme: theme === 'light' ? 'dark' : 'light' });
    await page.addInitScript((choice) => localStorage.setItem('ran-theme', choice), theme);
    await page.goto('/editor?new=docx');
    await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute(
      'href',
      new RegExp(`document-${theme}\\.svg$`),
    );
    await expect
      .poll(
        async () => {
          const frame = page.frames().find((frame) => /documenteditor\/main\//.test(frame.url()));
          return frame?.evaluate(() => (window as any).Common?.UI?.Themes?.currentThemeId()) ?? null;
        },
        { timeout: 60_000 },
      )
      .toBe(theme === 'dark' ? 'theme-dark' : 'theme-classic-light');
  });
}

test('both theme variants are available in the offline core cache', async ({ page }) => {
  await page.goto('/');
  const cached = await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    return Promise.all(
      [
        '/theme-presentation.js',
        '/icons/document-light.svg',
        '/icons/document-dark.svg',
        '/icons/document-light-32.png',
        '/icons/document-dark-32.png',
      ].map(async (path) => Boolean(await caches.match(new URL(path, location.origin)))),
    );
  });
  expect(cached).toEqual([true, true, true, true, true]);
});
