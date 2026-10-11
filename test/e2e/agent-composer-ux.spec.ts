import { expect, test } from './lib/l0';
import { buildDocx, toBase64 } from './lib/ooxml';

// Controlled latency verifies editing and focus during a real panel request,
// independently of model quality. No request is queued or sent automatically.
for (const ext of ['docx', 'xlsx', 'pptx', 'pdf'] as const) {
  test(`${ext}: a pending response preserves an editable next draft and historical focus`, async ({ page }) => {
    test.setTimeout(120_000);
    let pdf: number[] | undefined;
    if (ext === 'pdf') {
      await page.goto('/embed-demo.html');
      await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });
      pdf = await page.evaluate(
        async (encoded) => {
          const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
          await post('document:open-buffer', { fileName: 'source.docx', buffer: bytes.buffer, readonly: false });
          const saved = await post('document:save', { targetExt: 'PDF' });
          return Array.from(new Uint8Array(await saved.file.arrayBuffer()));
        },
        toBase64(buildDocx('Synthetic document for focus regression.')),
      );
    }
    await page.addInitScript(() =>
      localStorage.setItem(
        'agent-writing-endpoint',
        JSON.stringify({
          version: 1,
          kind: 'loopback',
          baseUrl: 'http://localhost:11434',
          model: 'ux-test',
          preference: 'device-first',
          localWritingConsent: false,
        }),
      ),
    );
    let release!: () => void;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    let answers = 0;
    await page.route('http://localhost:11434/api/**', async (route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({
          status: 204,
          headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' },
        });
        return;
      }
      if (route.request().url().endsWith('/tags')) {
        await route.fulfill({ json: { models: [{ name: 'ux-test' }] } });
        return;
      }
      const request = route.request().postDataJSON();
      let content: string;
      if (request.format?.properties?.task) content = JSON.stringify({ task: 'chat', language: 'en' });
      else {
        answers++;
        if (answers === 1) await hold;
        content = 'Completed response';
      }
      await route.fulfill({ json: { done: true, message: { role: 'assistant', content } } });
    });
    try {
      if (pdf) {
        await page.goto('/');
        const chooser = page.waitForEvent('filechooser');
        await page.locator('#hero-open').click();
        await (await chooser).setFiles({ name: 'focus.pdf', mimeType: 'application/pdf', buffer: Buffer.from(pdf) });
        await page.waitForURL(/\/editor/);
      } else await page.goto(`/editor?new=${ext}`);
      await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
      await page.waitForFunction(() => typeof window.__toggleAgentPanel === 'function');
      await page.evaluate(() => window.__toggleAgentPanel?.());
      await page.locator('.agent-enable-switch').click();
      await page.locator('.agent-panel-endpoint-connect').click();
      await expect(page.locator('.agent-panel-endpoint-status')).toContainText('Connected');
      await page.locator('.agent-panel-settings-toggle').click();
      const input = page.locator('.cui-input');
      await input.fill('Hello');
      await input.press('Enter');
      await expect.poll(() => answers).toBe(1);
      await expect(input).toBeEnabled();
      await input.fill('Next question');
      await input.press('Enter');
      expect(answers).toBe(1);
      await expect(input).toHaveValue('Next question');
      const log = page.getByRole('log');
      await log.focus();
      release();
      await expect(page.locator('.cui-send-stop')).toHaveCount(0);
      await expect(page.locator('.cui-msg-agent .cui-bubble')).toHaveText('Completed response');
      await expect(input).toHaveValue('Next question');
      await expect(log).toBeFocused();
      expect(answers).toBe(1);
      await input.press('Enter');
      await expect.poll(() => answers).toBe(2);
      await expect(page.locator('.cui-msg-user')).toHaveCount(2);
    } finally {
      release();
    }
  });
}
