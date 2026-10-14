import { expect, test } from './lib/l0';

for (const ext of ['docx', 'pptx'] as const) {
  for (const phase of ['routing', 'answer'] as const) {
    test(`${ext}: stopping ${phase} lets the user ask again without reloading`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.addInitScript(() =>
        localStorage.setItem(
          'agent-writing-endpoint',
          JSON.stringify({
            version: 1,
            kind: 'loopback',
            baseUrl: 'http://localhost:11434',
            model: 'stop-test',
            preference: 'device-first',
            localWritingConsent: false,
          }),
        ),
      );
      let held = false;
      let release!: () => void;
      const hold = new Promise<void>((resolve) => {
        release = resolve;
      });
      let answers = 0;
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
          await route.fulfill({ json: { models: [{ name: 'stop-test' }] } });
          return;
        }
        const body = route.request().postDataJSON();
        const routing = !!body.format?.properties?.task;
        if (!held && ((phase === 'routing' && routing) || (phase === 'answer' && !routing))) {
          held = true;
          await hold;
          await route.fulfill({
            json: {
              done: true,
              message: {
                role: 'assistant',
                content: routing
                  ? JSON.stringify({ task: 'chat', language: 'en' })
                  : 'Cancelled answer must stay hidden',
              },
            },
          });
          return;
        }
        const content = routing ? JSON.stringify({ task: 'chat', language: 'en' }) : `Fresh answer ${++answers}`;
        await route.fulfill({ json: { done: true, message: { role: 'assistant', content } } });
      });
      try {
        await page.goto(`/editor?new=${ext}`);
        await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
        await page.waitForFunction(() => typeof window.__toggleAgentPanel === 'function');
        await page.evaluate(() => window.__toggleAgentPanel?.());
        await page.locator('.agent-enable-switch').click();
        const input = page.locator('.cui-input');
        const send = page.locator('.cui-send');
        await input.fill('Hello');
        await expect(send).toHaveAccessibleName('Reconnect');
        await send.click();
        await expect(send).toHaveAccessibleName('Send');
        await send.click();
        await expect.poll(() => held).toBe(true);
        await expect(send).toHaveAccessibleName('Stop');
        await input.fill('Continue');
        await send.click();
        await expect(send).toHaveAccessibleName('Send');
        await expect(input).toHaveValue('Continue');
        await expect(page.getByRole('log')).toContainText('Stopped.');
        release();
        for (let turn = 1; turn <= 2; turn++) {
          await input.fill(`Continue ${turn}`);
          await expect(send).toBeEnabled();
          await send.click();
          await expect(page.getByRole('log')).toContainText(`Fresh answer ${turn}`);
          await expect(send).toHaveAccessibleName('Send');
        }
        await expect(page.getByRole('log')).not.toContainText('Cancelled answer must stay hidden');
        await expect(page.locator('.cui-msg-error')).toHaveCount(0);
        expect(answers).toBe(2);
      } finally {
        release();
      }
    });
  }
}
