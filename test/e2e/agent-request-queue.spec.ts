import { expect, test } from './lib/l0';

for (const ext of ['docx', 'pptx'] as const) {
  test(`${ext}: queues drafts, pauses older work on Stop and promotes Send now in a real editor`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    await page.addInitScript(() => {
      localStorage.setItem('document-assistant-enabled', 'true');
      localStorage.setItem(
        'agent-writing-endpoint',
        JSON.stringify({
          version: 1,
          kind: 'loopback',
          baseUrl: 'http://localhost:11434',
          model: 'queue-test',
          preference: 'device-first',
          localWritingConsent: false,
        }),
      );
    });
    const calls: string[] = [];
    const releases = new Map<string, () => void>();
    await page.route('http://localhost:11434/api/**', async (route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        });
        return;
      }
      if (route.request().url().endsWith('/tags')) {
        await route.fulfill({ json: { models: [{ name: 'queue-test' }] } });
        return;
      }
      const body = route.request().postDataJSON();
      if (body.format?.properties?.task) {
        await route.fulfill({
          json: {
            done: true,
            message: { role: 'assistant', content: JSON.stringify({ task: 'chat', language: 'en' }) },
          },
        });
        return;
      }
      const text = String(body.messages.at(-1).content).split('User request:\n').at(-1)!;
      calls.push(text);
      await new Promise<void>((resolve) => releases.set(text, resolve));
      expect(body.stream).toBe(false);
      await route.fulfill({
        json: { done: true, message: { role: 'assistant', content: `Answer to ${text}` } },
      });
    });
    try {
      await page.goto(`/editor?new=${ext}&locale=en`);
      await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
      await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
      const input = page.locator('.cui-input');
      const send = page.locator('.cui-send');
      await input.fill('Hello');
      await send.click();
      await expect(page.locator('.agent-panel-endpoint-status')).toContainText('Connected');
      await expect(send).toHaveAccessibleName('Send');
      await send.click();
      await expect.poll(() => calls).toEqual(['Hello']);
      await input.fill('Hi');
      await input.press('Enter');
      await input.fill('Hey');
      await send.click();
      await expect(page.locator('.agent-queue-text')).toHaveText(['Hi', 'Hey']);
      await expect(page.locator('.cui-msg-user')).toHaveCount(1);
      await expect(input).toHaveValue('');
      await expect(input).toBeFocused();
      await page.getByRole('separator', { name: 'Resize AI panel' }).press('Home');
      await expect(page.locator('.agent-request-queue')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await expect(page.locator('.agent-request-queue')).toHaveCSS('border-top-width', '0px');
      const stop = page.locator('.cui-send-stop');
      const sendSize = await send.boundingBox();
      const stopSize = await stop.boundingBox();
      expect(sendSize?.width).toBe(stopSize?.width);
      expect(sendSize?.height).toBe(stopSize?.height);
      await expect(page.locator('.agent-panel-title')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await expect(page.locator('.cui-progress')).toHaveCSS('border-top-width', '0px');
      await expect(page.locator('.cui-progress')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await page.locator('.agent-queue-more').first().click();
      await page
        .locator('.agent-runtime-panel')
        .screenshot({ path: testInfo.outputPath(`queue-${ext}-320-light-actions.png`) });
      await page.locator('.agent-queue-remove').first().press('Escape');
      await page.evaluate(() => document.documentElement.setAttribute('data-ran-theme', 'dark'));
      await expect
        .poll(() => page.locator('.cui-composer').evaluate((el) => el.scrollWidth - el.clientWidth))
        .toBeLessThan(2);
      await page.locator('.agent-runtime-panel').screenshot({ path: testInfo.outputPath(`queue-${ext}-320-dark.png`) });
      if (ext === 'docx') {
        await page.evaluate(() => {
          const win = window.__ooFrames.readyEditor() as unknown as {
            Asc: { editor: { pluginMethod_InputText(text: string): void; asc_EditSelectAll(): void } };
          };
          win.Asc.editor.pluginMethod_InputText('A sensitive later document selection');
          win.Asc.editor.asc_EditSelectAll();
        });
        await expect(page.locator('.agent-quoted-text')).toHaveText('A sensitive later document selection');
      }
      releases.get('Hello')!();
      await expect(page.getByRole('log')).toContainText('Answer to Hello');
      await expect.poll(() => calls).toEqual(['Hello', 'Hi']);
      await expect(page.locator('.cui-msg-user')).toHaveCount(2);
      await page.locator('.cui-send-stop').click();
      await expect(page.locator('.cui-send-stop')).toHaveCount(0);
      await input.fill('Hello there');
      await input.press('Enter');
      await expect(page.locator('.agent-queue-text')).toHaveText(['Hey', 'Hello there']);
      expect(calls).toEqual(['Hello', 'Hi']);
      await page.locator('.agent-queue-resume').click();
      await expect.poll(() => calls).toEqual(['Hello', 'Hi', 'Hey']);
      await page.locator('.agent-queue-more').click();
      await expect(page.locator('.agent-queue-more')).toHaveAttribute('aria-expanded', 'true');
      await page.locator('.agent-queue-send-now').press('Escape');
      await expect(page.locator('.agent-queue-more')).toBeFocused();
      await page.locator('.agent-queue-more').click();
      await page.locator('.agent-queue-send-now').click();
      await expect.poll(() => calls).toEqual(['Hello', 'Hi', 'Hey', 'Hello there']);
      releases.get('Hello there')!();
      await expect(page.locator('.cui-send-stop')).toHaveCount(0);
      await expect(page.getByRole('log')).toContainText('Answer to Hello there');
      await expect(page.getByRole('log')).not.toContainText('Answer to Hi');
      await expect(page.getByRole('log')).not.toContainText('Answer to Hey');
      await expect(page.locator('.agent-queue-entry')).toHaveCount(0);
      await expect(page.locator('.cui-msg-user')).toHaveCount(4);
      await expect(page.locator('.cui-msg-error')).toHaveCount(0);
    } finally {
      for (const release of releases.values()) release();
    }
  });
}
