import { expect, test } from './lib/l0';

/**
 * A link that cannot be fetched has to say so in the reader's language, and
 * say what to do instead.
 *
 * `?file=` / `?src=` fetches the document from another origin. A site that
 * does not send `Access-Control-Allow-Origin` cannot be read by this one --
 * `fetch` rejects with a TypeError carrying no status, because the response
 * was never handed to the page. A dropped connection rejects identically and
 * the browser deliberately does not say which it was.
 *
 * This used to surface as `alert('Failed to open document: Failed to fetch')`:
 * a blocking browser modal, in English on a site that ships seven languages,
 * naming nothing the reader can act on. Now it is the app's own toast, and it
 * points at the way out that always works -- download the file and open it
 * from the device, which never leaves the browser.
 */
const UNREACHABLE = 'https://cors-refused.invalid/report.docx';

test.describe('a document link that cannot be fetched', () => {
  test.describe.configure({ timeout: 120_000 });

  test('is reported in a toast that says what to do, not in an alert', async ({ page, l0 }) => {
    l0.allowConsole(/Error opening document from URL|Failed to fetch|Failed to load resource|net::ERR/);

    // An alert would block the page; record any that appear instead of letting
    // Playwright's auto-dismiss hide the regression.
    const dialogs: string[] = [];
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.dismiss();
    });

    // ranui assigns window.message once, so wrap it as it lands rather than
    // hunting for whatever markup the toast renders (same approach as
    // open-retry.spec.ts).
    await page.addInitScript(() => {
      const seen: string[] = [];
      Object.defineProperty(window, '__ooToasts', { value: seen, configurable: true });
      let stored: unknown;
      Object.defineProperty(window, 'message', {
        configurable: true,
        get: () => stored,
        set(value: Record<string, unknown> | undefined) {
          if (value && typeof value === 'object') {
            for (const key of ['error', 'info', 'success', 'warning']) {
              const fn = value[key];
              if (typeof fn === 'function') {
                value[key] = (...args: unknown[]) => {
                  seen.push(String(args[0]));
                  return (fn as (...a: unknown[]) => unknown).apply(value, args);
                };
              }
            }
          }
          stored = value;
        },
      });
    });

    await page.goto(`/editor?src=${encodeURIComponent(UNREACHABLE)}`);

    await expect
      .poll(async () => ((await page.evaluate(() => (window as any).__ooToasts as string[])) ?? []).join('\n'), {
        timeout: 60_000,
      })
      .toMatch(/download it and open the file from your device/i);
    expect(dialogs, 'the failure must not be an alert()').toEqual([]);
  });
});
