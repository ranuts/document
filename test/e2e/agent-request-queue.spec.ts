import { mockApi } from './lib/mock-api';
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
    await mockApi(page, 'http://localhost:11434/api/**', async (route) => {
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
      expect(body.stream).toBe(true);
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
      expect(sendSize?.width).toBe(32);
      expect(sendSize?.height).toBe(32);
      expect(sendSize?.width).toBe(stopSize?.width);
      expect(sendSize?.height).toBe(stopSize?.height);
      expect(sendSize!.y).toBe(stopSize!.y);
      const toolbarBounds = await page.locator('.agent-speech-mic').boundingBox();
      expect(toolbarBounds!.height).toBe(32);
      expect(toolbarBounds!.y).toBe(sendSize!.y);
      expect(await page.locator('.cui-composer').evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThan(2);
      const language = page.locator('.agent-speech-language');
      const languageMetrics = () =>
        language.evaluate((el) => {
          const root = el.shadowRoot ?? (el as HTMLElement & { _shadowDom: ShadowRoot })._shadowDom;
          const label = root.querySelector('[part="selection-item"]')!;
          const range = document.createRange();
          range.selectNodeContents(label);
          return {
            width: label.getBoundingClientRect().width,
            textWidth: range.getBoundingClientRect().width,
            text: label.textContent,
            scroll: label.scrollWidth,
            client: label.clientWidth,
          };
        });
      const english = await languageMetrics();
      expect(english.text).toBe('English');
      expect(english.width).toBeGreaterThanOrEqual(english.textWidth);
      // Longer locale names may truncate; the label must retain a readable lane.
      await language.evaluate((el) => {
        (el as HTMLElement & { value: string }).value = 'pt-BR';
      });
      const longer = await languageMetrics();
      expect(longer.text).toBe('Português');
      expect(longer.width).toBeGreaterThanOrEqual(32);
      expect(longer.scroll).toBeGreaterThan(longer.client);
      await language.evaluate((el) => {
        (el as HTMLElement & { value: string }).value = 'en-US';
      });
      await expect(page.locator('.agent-panel-title')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await expect(page.locator('.cui-progress')).toHaveCSS('border-top-width', '0px');
      await expect(page.locator('.cui-progress')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await expect(page.locator('.agent-queue-toggle')).toHaveAttribute('aria-expanded', 'false');
      await expect(page.locator('.agent-queue-list')).toBeHidden();
      await page
        .locator('.agent-runtime-panel')
        .screenshot({ path: testInfo.outputPath(`queue-${ext}-collapsed.png`) });
      await page
        .locator('.cui-footer')
        .screenshot({ path: testInfo.outputPath(`queue-${ext}-320-composer-light.png`) });
      await page.locator('.agent-queue-toggle').click();
      await page.locator('.agent-queue-more').first().click();
      // Public disabled state is also used while a queued request prepares.
      // Keep the real queue DOM and verify its rendered feedback in both themes.
      for (const scheme of ['light', 'dark']) {
        await page.evaluate((theme) => document.documentElement.setAttribute('data-ran-theme', theme), scheme);
        for (const control of [
          page.locator('.agent-queue-edit').first(),
          page.locator('.agent-queue-remove').first(),
        ]) {
          await control.evaluate((el: HTMLButtonElement) => (el.disabled = true));
          await page.mouse.move(0, 0);
          const rest = await control.evaluate((el) => ({
            background: getComputedStyle(el).backgroundColor,
            color: getComputedStyle(el).color,
          }));
          await control.hover();
          expect(
            await control.evaluate((el) => ({
              background: getComputedStyle(el).backgroundColor,
              color: getComputedStyle(el).color,
            })),
          ).toEqual(rest);
          await control.evaluate((el: HTMLButtonElement) => (el.disabled = false));
        }
      }
      await page.evaluate(() => document.documentElement.setAttribute('data-ran-theme', 'light'));

      await page
        .locator('.agent-runtime-panel')
        .screenshot({ path: testInfo.outputPath(`queue-${ext}-320-light-actions.png`) });
      await page.locator('.agent-queue-remove').first().press('Escape');
      await page.evaluate(() => document.documentElement.setAttribute('data-ran-theme', 'dark'));
      await expect
        .poll(() => page.locator('.cui-composer').evaluate((el) => el.scrollWidth - el.clientWidth))
        .toBeLessThan(2);
      await page.locator('.agent-runtime-panel').screenshot({ path: testInfo.outputPath(`queue-${ext}-320-dark.png`) });
      await page.locator('.cui-footer').screenshot({ path: testInfo.outputPath(`queue-${ext}-320-composer-dark.png`) });
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
