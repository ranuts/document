import { expect, test } from './lib/l0';

// Code that only serves an optional, later interaction must not ride on the
// scripts every editor load fetches before it can run. Each probe is a string
// found only inside the module in question: an error message thrown in
// lib/agent-plugin/tools.ts, and an element the PWA library defines for itself.
const DEFERRED = [
  { owner: 'agent tool layer (lib/agent-plugin/tools.ts)', probe: 'replace_selection requires a nonempty string' },
  { owner: '@khmyznikov/pwa-install', probe: 'pwa-bottom-sheet' },
];

test('the editor startup scripts leave the agent tools and the PWA prompt out', async ({ page }) => {
  await page.goto('/editor?new=docx');
  // Vite writes the entry and its whole static import graph into the HTML as
  // the module script plus modulepreload links: that is the startup payload.
  const urls = await page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>(
        'script[type="module"][src], link[rel="modulepreload"]',
      ),
    ].map((node) => (node instanceof HTMLScriptElement ? node.src : node.href)),
  );
  expect(urls.length).toBeGreaterThan(0);
  for (const url of urls) {
    const body = await (await page.request.get(url)).text();
    for (const { owner, probe } of DEFERRED) expect(body.includes(probe), `${owner} is in ${url}`).toBe(false);
  }
});

test('the PWA install element is still defined and mounted after startup', async ({ page }) => {
  await page.goto('/editor?new=docx');
  await expect(page.locator('pwa-install#pwa-install')).toBeAttached({ timeout: 15_000 });
  await expect.poll(() => page.evaluate(() => Boolean(customElements.get('pwa-install')))).toBe(true);
});
