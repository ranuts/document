import { expect, test } from './lib/l0';
import { buildDocx, toBase64 } from './lib/ooxml';

// Controlled latency verifies editing and focus during a real panel request,
// independently of model quality. No request is queued or sent automatically.
for (const ext of ['docx', 'xlsx', 'pptx', 'pdf'] as const) {
  test(`${ext}: a pending response preserves an editable next draft and historical focus`, async ({
    page,
  }, testInfo) => {
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
        content =
          answers === 1
            ? 'Completed response'
            : [
                '# Result',
                ...Array.from(
                  { length: 24 },
                  (_, index) => `Paragraph ${index + 1}: A readable answer in a narrow document sidebar.`,
                ),
                '- First point\n- Second point',
                '```txt\n' + 'long_code_value_'.repeat(30) + '\n```',
                '| First | Second | Third | Fourth | Fifth | Sixth | Seventh | Eighth |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n| 10 | 20 | 30 | 40 | 50 | 60 | 70 | 80 |',
              ].join('\n\n');
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
      await expect(page.locator('.agent-runtime-panel')).toHaveAttribute('data-view', 'chat');
      const input = page.locator('.cui-input');
      const send = page.locator('.cui-send');
      await input.fill('Hello');
      await expect(send).toHaveAccessibleName('Reconnect');
      await expect(send).toBeEnabled();
      await expect(page.locator('.agent-prepare-action')).toBeHidden();
      await send.click();
      await expect(page.locator('.agent-panel-endpoint-status')).toContainText('Connected');
      await expect(input).toHaveValue('Hello');
      await expect(page.locator('.cui-msg-user')).toHaveCount(0);
      expect(answers).toBe(0);
      await expect(send).toHaveAccessibleName('Send');
      await send.click();
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
      await expect(page.locator('.cui-send-stop')).toHaveCount(0);
      await expect(page.locator('.cui-msg-agent')).toHaveCount(2);
      // Prose remains unframed; its heading has a real typographic level rather
      // than the same size as body text. Draft identity comes from host metadata.
      await expect(page.locator('.cui-result-header')).toHaveCount(0);
      const typeHierarchy = await page
        .locator('.cui-msg-agent')
        .last()
        .evaluate((row) => ({
          heading: Number.parseFloat(getComputedStyle(row.querySelector('h2')!).fontSize),
          body: Number.parseFloat(getComputedStyle(row.querySelector('p')!).fontSize),
        }));
      expect(typeHierarchy.heading - typeHierarchy.body).toBeGreaterThanOrEqual(2);
      const resize = page.getByRole('separator', { name: 'Resize AI panel' });
      const draft = 'Keep this next draft editable while I resize the sidebar. '.repeat(8);
      await resize.press('Home');
      await input.fill(draft);
      await expect.poll(() => input.evaluate((el) => el.clientHeight)).toBe(160);
      expect(await input.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
      await expect.poll(() => log.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight)).toBeLessThan(3);
      const narrowHeight = await input.evaluate((el) => el.clientHeight);
      await resize.press('End');
      await expect.poll(() => input.evaluate((el) => el.clientHeight)).toBeLessThan(narrowHeight);
      await expect(input).toHaveValue(draft);
      await expect.poll(() => log.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight)).toBeLessThan(3);
      await log.evaluate((el) => {
        el.scrollTop = 0;
      });
      await resize.press('Home');
      await expect.poll(() => log.evaluate((el) => el.scrollTop)).toBe(0);
      await input.fill(draft + draft);
      await expect.poll(() => log.evaluate((el) => el.scrollTop)).toBe(0);
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
      const copy = page.locator('.cui-copy').first();
      const width = (await copy.boundingBox())!.width;
      await copy.click();
      await expect(copy).toHaveAccessibleName('Copied');
      await expect(page.locator('.cui-feedback')).toHaveText('Copied');
      expect((await copy.boundingBox())!.width).toBe(width);
      await expect(copy).toHaveAccessibleName('Copy');
      await expect(page.locator('.cui-msg-agent pre')).toHaveAttribute('tabindex', '0');
      await expect(page.locator('.cui-msg-agent .cui-table')).toHaveAttribute('tabindex', '0');
      await expect
        .poll(() => page.locator('.agent-runtime-panel').evaluate((el) => el.scrollWidth - el.clientWidth))
        .toBeLessThan(2);
      expect(answers).toBe(2);
      await page.getByRole('button', { name: 'Scroll to latest' }).click();
      await expect.poll(() => log.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight)).toBeLessThan(3);
      const code = page.locator('.cui-msg-agent pre');
      await code.focus();
      await code.press('ArrowRight');
      await expect.poll(() => code.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
      const table = page.locator('.cui-msg-agent .cui-table');
      await table.focus();
      await table.press('ArrowRight');
      await expect.poll(() => table.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
      await page.screenshot({ path: testInfo.outputPath('chat-details.png') });
    } finally {
      release();
    }
  });
}
