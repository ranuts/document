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
// ranui's select; only the assistant renders one, and it imports the element itself.
const RANUI_SELECT = { owner: 'ranui select', probe: 'ran-select-dropdown-option' };
// Two message tables the page does not speak: only English and the active
// locale belong at startup (packages/shared/src/i18n.ts awaits the latter).
const OTHER_LOCALES = [
  { owner: 'ja message table', probe: 'ドキュメントを開く / 編集' },
  { owner: 'de message table', probe: 'Dokument öffnen / bearbeiten' },
];

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

test('the editor startup scripts leave optional modules and other locales out', async ({ page }) => {
  await page.goto('/editor?new=docx');
  await expectAbsent(page, [AGENT_TOOLS, PWA_INSTALL, JSCHARDET, RANUI_SELECT, ...OTHER_LOCALES]);
});

test('the history page startup scripts leave the editor stack, jschardet and other locales out', async ({ page }) => {
  await page.goto('/history');
  await expectAbsent(page, [EDITOR_STACK, JSCHARDET, ...OTHER_LOCALES]);
});

test('a page opened in another language renders that language without reloading', async ({ page }) => {
  await page.goto('/history?locale=de');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  // Rendered once, at startup: a table that arrived late would leave it English.
  await expect(page.locator('h1.history-title')).toHaveText('Gespeicherte Dokumente');
});

test('the PWA install element is still defined and mounted after startup', async ({ page }) => {
  await page.goto('/editor?new=docx');
  await expect(page.locator('pwa-install#pwa-install')).toBeAttached({ timeout: 15_000 });
  await expect.poll(() => page.evaluate(() => Boolean(customElements.get('pwa-install')))).toBe(true);
});

test('the select element is defined once the assistant opens, without being in startup', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => localStorage.setItem('document-assistant-enabled', 'true'));
  await page.goto('/editor?new=docx&locale=en');
  await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
  expect(await page.evaluate(() => Boolean(customElements.get('r-select')))).toBe(false);
  await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
  await page.locator('.agent-panel-settings-toggle').click();
  await expect.poll(() => page.evaluate(() => Boolean(customElements.get('r-select')))).toBe(true);
  await expect(page.locator('.agent-panel-settings r-select:visible').first()).toBeVisible();
});
