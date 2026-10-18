import type { Page } from '@playwright/test';

/** Observe the app's exact clipboard payload without engine-specific OS grants. */
export async function captureClipboard(page: Page): Promise<() => Promise<string>> {
  await page.evaluate(() => {
    const root = window as Window & { __copiedText?: string };
    root.__copiedText = '';
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          root.__copiedText = text;
        },
      },
    });
  });
  return () => page.evaluate(() => (window as Window & { __copiedText?: string }).__copiedText || '');
}
