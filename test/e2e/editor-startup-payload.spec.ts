import type { Page } from '@playwright/test';
import { expect, test } from './lib/l0';

// Code that only serves an optional, later interaction must not ride on the
// scripts a page fetches before it can run. Each probe is a string found only
// inside the module in question.
const AGENT_TOOLS = {
  owner: 'agent tool layer (lib/agent-plugin/tools.ts)',
  probe: 'replace_selection requires a nonempty string',
};
const PWA_INSTALL = { owner: '@khmyznikov/pwa-install', probe: 'pwa-bottom-sheet' };
// jschardet's charset table; ranuts keeps it out of str.ts since 0.5.1, and
// nothing in this app sniffs charsets statistically.
const JSCHARDET = { owner: 'jschardet', probe: 'windows-1255' };
// An error the save pipeline (lib/onlyoffice/save-stream.ts) raises: the
// history page lists and reopens records, it never saves through the editor.
const EDITOR_STACK = { owner: 'editor save pipeline', probe: 'Save conversion failed' };

/** Vite writes an entry and its whole static import graph into the HTML as the
 *  module script plus modulepreload links: that is the startup payload. */
async function startupScripts(page: Page): Promise<string[]> {
  const urls = await page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>(
        'script[type="module"][src], link[rel="modulepreload"]',
      ),
    ].map((node) => (node instanceof HTMLScriptElement ? node.src : node.href)),
  );
  expect(urls.length).toBeGreaterThan(0);
  return urls;
}

async function expectAbsent(page: Page, deferred: Array<{ owner: string; probe: string }>) {
  for (const url of await startupScripts(page)) {
    const body = await (await page.request.get(url)).text();
    for (const { owner, probe } of deferred) expect(body.includes(probe), `${owner} is in ${url}`).toBe(false);
  }
}

test('the editor startup scripts leave the agent tools, the PWA prompt and jschardet out', async ({ page }) => {
  await page.goto('/editor?new=docx');
  await expectAbsent(page, [AGENT_TOOLS, PWA_INSTALL, JSCHARDET]);
});

test('the history page startup scripts leave the editor stack and jschardet out', async ({ page }) => {
  await page.goto('/history');
  await expectAbsent(page, [EDITOR_STACK, JSCHARDET]);
});

test('the PWA install element is still defined and mounted after startup', async ({ page }) => {
  await page.goto('/editor?new=docx');
  await expect(page.locator('pwa-install#pwa-install')).toBeAttached({ timeout: 15_000 });
  await expect.poll(() => page.evaluate(() => Boolean(customElements.get('pwa-install')))).toBe(true);
});
