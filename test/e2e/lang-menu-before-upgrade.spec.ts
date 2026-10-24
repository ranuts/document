import { expect, test } from './lib/l0';

// The language menu is an <r-popover> whose seven links are written straight
// into the page. Until the element is defined (a deferred IIFE on the static
// pages, the Vite bundle on /history) the browser lays those links out in flow
// unless ranui.css (vendored as /ran-tokens.css) hides them; the header used to
// grow from 38px to ~300px and snap back. Withhold every script that could
// define it and check the menu stays a single trigger.
test.use({ serviceWorkers: 'block' });

for (const path of ['/', '/zh-CN/', '/help', '/history']) {
  test(`${path}: the language menu does not expand before r-popover is defined`, async ({ page }) => {
    await page.route('**/ranui-iife/*.iife.js', (route) => route.abort());
    await page.route('**/assets/*.js', (route) => route.abort());
    await page.goto(path, { waitUntil: 'load' });

    const menu = page.locator('.lang-menu').first();
    await expect(menu).toBeAttached();
    const state = await menu.evaluate((host) => ({
      defined: Boolean(customElements.get('r-popover')),
      height: host.getBoundingClientRect().height,
      listHeight: host.querySelector('.lang-list')?.getBoundingClientRect().height ?? 0,
    }));
    expect(state.defined).toBe(false);
    expect(state.listHeight).toBe(0);
    expect(state.height).toBeLessThan(48);
  });
}
