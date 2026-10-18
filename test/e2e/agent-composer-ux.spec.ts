import { captureClipboard } from './lib/clipboard';
import { mockApi } from './lib/mock-api';
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
    await mockApi(page, 'http://localhost:11434/api/**', async (route) => {
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
      await expect(input).toHaveValue('');
      await expect(page.locator('.agent-queue-text')).toHaveText('Next question');
      const log = page.getByRole('log');
      await log.focus();
      release();
      await expect(page.locator('.cui-send-stop')).toHaveCount(0);
      await expect(page.locator('.cui-msg-agent .cui-bubble').first()).toHaveText('Completed response');
      await expect(input).toHaveValue('');
      await expect(log).toBeFocused();
      await expect(page.locator('.agent-queue-entry')).toHaveCount(0);
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
      // Workspace navigation preserves the draft selection and detached reading position.
      await input.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(4, 17, 'backward'));
      await page.locator('.agent-sources-toggle').click();
      await expect(page.locator('.agent-runtime-panel')).toHaveAttribute('data-view', 'sources');
      await page.getByRole('button', { name: 'Back to conversation' }).click();
      await expect(input).toHaveValue(draft + draft);
      expect(
        await input.evaluate((el: HTMLTextAreaElement) => [el.selectionStart, el.selectionEnd, el.selectionDirection]),
      ).toEqual([4, 17, 'backward']);
      await expect.poll(() => log.evaluate((el) => el.scrollTop)).toBe(0);
      await expect(input).not.toBeFocused();
      await page.getByRole('button', { name: 'Close assistant', exact: true }).click();
      await expect(input).toBeHidden();
      await page.evaluate(() => window.__toggleAgentPanel?.());
      await expect(input).toBeVisible();
      await expect(input).toHaveValue(draft + draft);
      expect(
        await input.evaluate((el: HTMLTextAreaElement) => [el.selectionStart, el.selectionEnd, el.selectionDirection]),
      ).toEqual([4, 17, 'backward']);
      await expect.poll(() => log.evaluate((el) => el.scrollTop)).toBe(0);
      await expect(input).not.toBeFocused();
      await page.getByRole('button', { name: 'New conversation', exact: true }).click();
      await expect(input).toHaveValue('');
      await expect(page.locator('.cui-msg-agent')).toHaveCount(0);
      expect(await input.evaluate((el: HTMLTextAreaElement) => [el.selectionStart, el.selectionEnd])).toEqual([0, 0]);
      await page.getByRole('button', { name: 'Conversations', exact: true }).click();
      await page.locator('.agent-conversation-open').filter({ hasText: 'Hello' }).click();
      await expect(input).toHaveValue(draft + draft);
      expect(
        await input.evaluate((el: HTMLTextAreaElement) => [el.selectionStart, el.selectionEnd, el.selectionDirection]),
      ).toEqual([4, 17, 'backward']);
      await expect.poll(() => log.evaluate((el) => el.scrollTop)).toBe(0);
      await expect(input).not.toBeFocused();
      const copiedText = await captureClipboard(page);
      const copy = page.locator('.cui-copy').first();
      const width = (await copy.boundingBox())!.width;
      await copy.click();
      await expect(copy).toHaveAccessibleName('Copied');
      expect(await copiedText()).toBe('Completed response');
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
      // Native WebKit scrolling needs a key hold spanning an animation frame.
      await code.press('ArrowRight', { delay: 100 });
      await expect.poll(() => code.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
      const table = page.locator('.cui-msg-agent .cui-table');
      await table.focus();
      await table.press('ArrowRight', { delay: 100 });
      await expect.poll(() => table.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
      await page.screenshot({ path: testInfo.outputPath('chat-details.png') });
    } finally {
      release();
    }
  });
}

for (const width of [320, 360, 1280]) {
  test(`composer stays compact and grows with multiline drafts at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('document-assistant-enabled', 'true');
      localStorage.setItem(
        'agent-writing-endpoint',
        JSON.stringify({
          version: 1,
          kind: 'loopback',
          baseUrl: 'http://localhost:11434',
          model: 'density-test',
          preference: 'device-first',
          localWritingConsent: false,
        }),
      );
    });
    await mockApi(page, 'http://localhost:11434/api/**', (route) =>
      route.fulfill({ json: { models: [{ name: 'density-test' }] } }),
    );
    await page.goto('/editor?new=docx&locale=en');
    await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
    await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
    const input = page.locator('.cui-input');
    const composer = page.locator('.cui-composer');
    await expect(input).toBeVisible();
    const send = page.locator('.cui-send');
    await input.fill('A draft before reconnecting');
    await expect(send).toHaveAccessibleName('Reconnect');
    // Preparation stays a readable text action rather than a clipped icon square.
    expect((await send.boundingBox())!.width).toBeGreaterThan(32);
    expect(await send.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThan(2);
    await send.click();
    await expect(send).toHaveAccessibleName('Send');
    await expect(input).toHaveValue('A draft before reconnecting');
    await input.fill('');
    await expect(send).toBeDisabled();
    const controls = [send, page.locator('.agent-sources-toggle'), page.locator('.agent-speech-mic')];
    const bounds = await Promise.all(controls.map((control) => control.boundingBox()));
    for (const box of bounds) expect(box!.height).toBe(32);
    expect(bounds[0]!.width).toBe(32);
    const centers = bounds.map((box) => box!.y + box!.height / 2);
    expect(Math.max(...centers) - Math.min(...centers)).toBeLessThanOrEqual(1);
    await expect(page.locator('.agent-sources-toggle')).toHaveCSS('font-size', '12px');
    await expect(page.locator('.agent-speech-language')).toHaveCSS('--ran-select-font-size', '12px');
    await expect(composer).toHaveCSS('padding', '12px');
    if (width === 1280) expect((await page.locator('.agent-runtime-panel').boundingBox())!.width).toBe(432);
    const empty = (await composer.boundingBox())!.height;
    await page.locator('.agent-runtime-panel').screenshot({ path: testInfo.outputPath(`composer-empty-${width}.png`) });
    expect(empty).toBeLessThan(115);
    await input.focus();
    const focus = await composer.evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        border: style.borderTopWidth,
        color: style.borderTopColor,
        shadow: style.boxShadow,
      };
    });
    expect(focus.border).toBe('1px');
    expect(focus.shadow).toBe('none');
    // Resolve the semantic token through a temporary inherited color, including dark mode.
    const neutral = await composer.evaluate((el) => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--ran-color-text-secondary)';
      el.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    });
    expect(focus.color).toBe(neutral);
    await input.fill(Array.from({ length: 12 }, (_, i) => `第 ${i + 1} 行：保持原文的事实和数字。`).join('\n'));
    expect((await input.boundingBox())!.height).toBeGreaterThan(80);
    expect((await input.boundingBox())!.height).toBeLessThanOrEqual(160);
    expect((await composer.boundingBox())!.height).toBeGreaterThan(empty + 40);
    await page
      .locator('.agent-runtime-panel')
      .screenshot({ path: testInfo.outputPath(`composer-multiline-${width}.png`) });
    await input.fill('Short draft');
    await expect(send).toBeEnabled();
    await page.locator('.agent-runtime-panel').screenshot({ path: testInfo.outputPath(`composer-short-${width}.png`) });
    await composer.screenshot({ path: testInfo.outputPath(`composer-only-${width}.png`) });
    await page.evaluate(() => document.documentElement.setAttribute('data-ran-theme', 'dark'));
    await expect(composer).toHaveCSS('box-shadow', 'none');
    await page.keyboard.press('Tab');
    await page.locator('.agent-sources-toggle').focus();
    expect(await page.locator('.agent-sources-toggle').evaluate((el) => getComputedStyle(el).outlineWidth)).toBe('2px');
    await page.locator('.agent-runtime-panel').screenshot({ path: testInfo.outputPath(`composer-dark-${width}.png`) });
    await expect.poll(async () => (await composer.boundingBox())!.height).toBeLessThanOrEqual(empty + 1);
    await input.fill('');
    await expect.poll(async () => (await composer.boundingBox())!.height).toBeLessThanOrEqual(empty + 1);
    expect(await composer.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThan(2);
    await page
      .locator('.agent-runtime-panel')
      .screenshot({ path: testInfo.outputPath(`composer-compact-${width}.png`) });
  });
}

test.describe('coarse pointer composer', () => {
  test.use({ hasTouch: true });
  test('retains a 44-pixel execution target on touch hardware', async ({ page }) => {
    test.setTimeout(90000);
    await page.addInitScript(() => {
      Object.assign(window, {
        SpeechRecognition: class {
          onstart?: () => void;
          onend?: () => void;
          start() {
            queueMicrotask(() => this.onstart?.());
          }
          stop() {
            this.onend?.();
          }
          abort() {
            this.onend?.();
          }
        },
      });
    });
    await page.setViewportSize({ width: 360, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('document-assistant-enabled', 'true');
      localStorage.setItem('agent-local-preset', 'Qwen3-4B-q4f16_1-MLC');
    });
    await page.goto('/editor?new=docx&locale=en');
    await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
    await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
    const send = page.locator('.cui-send');
    await expect(send).toBeVisible();
    expect((await send.boundingBox())!.width).toBe(44);
    expect((await send.boundingBox())!.height).toBe(44);
    for (const width of [360, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const selector of ['.agent-speech-mic', '.agent-speech-privacy button', '.agent-sources-toggle']) {
        expect((await page.locator(selector).boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      expect(await page.locator('.agent-speech-cancel').boundingBox()).toBeNull();
      await page.locator('.agent-speech-mic').click();
      await expect(page.locator('.agent-speech')).toHaveAttribute('data-state', 'listening');
      expect((await page.locator('.agent-speech-cancel').boundingBox())!.height).toBe(44);
      expect(await page.locator('.cui-composer').evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThan(2);
      await page.locator('.agent-speech-cancel').click();
      await expect(page.locator('.agent-speech')).toHaveAttribute('data-state', 'idle');
      expect(await page.locator('.agent-speech-cancel').boundingBox()).toBeNull();
      expect(await page.locator('.cui-composer').evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThan(2);
    }
  });
});
