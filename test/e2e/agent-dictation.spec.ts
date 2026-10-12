import { expect, test } from './lib/l0';
import { buildDocx, toBase64 } from './lib/ooxml';

// Native editors and the real composer run. Browser speech events and an AI
// endpoint are controlled so permissions, cancellation and latency are repeatable.
for (const ext of ['docx', 'xlsx', 'pptx', 'pdf'] as const) {
  test(`${ext}: dictation stays in composer flow and explicit Send finalizes the transcript`, async ({ page }) => {
    test.setTimeout(120_000);
    let pdf: number[] | undefined;
    if (ext === 'pdf') {
      await page.goto('/embed-demo.html');
      await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });
      pdf = await page.evaluate(
        async (encoded) => {
          const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
          await post('document:open-buffer', { fileName: 'dictation.docx', buffer: bytes.buffer, readonly: false });
          const saved = await post('document:save', { targetExt: 'PDF' });
          return Array.from(new Uint8Array(await saved.file.arrayBuffer()));
        },
        toBase64(buildDocx('Synthetic dictation regression.')),
      );
    }
    await page.addInitScript(() => {
      localStorage.setItem('document-assistant-enabled', 'true');
      localStorage.setItem(
        'agent-writing-endpoint',
        JSON.stringify({
          version: 1,
          kind: 'loopback',
          baseUrl: 'http://localhost:11434',
          model: 'dictation-test',
          preference: 'device-first',
          localWritingConsent: false,
        }),
      );
      const state = window as unknown as { SpeechRecognition: unknown; recognition: unknown };
      state.SpeechRecognition = class {
        onstart?: () => void;
        onend?: () => void;
        onresult?: (event: unknown) => void;
        constructor() {
          state.recognition = this;
        }
        start() {
          this.onstart?.();
        }
        stop() {
          setTimeout(() => {
            this.onresult?.({ results: [{ isFinal: true, 0: { transcript: 'Hello from dictation' } }] });
            this.onend?.();
          }, 100);
        }
        abort() {}
      };
    });
    let messages = 0;
    await page.route('http://localhost:11434/api/**', async (route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({
          status: 204,
          headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' },
        });
        return;
      }
      if (route.request().url().endsWith('/tags')) {
        await route.fulfill({ json: { models: [{ name: 'dictation-test' }] } });
        return;
      }
      const request = route.request().postDataJSON();
      const content = request.format?.properties?.task ? JSON.stringify({ task: 'chat', language: 'en' }) : 'Hello!';
      if (!request.format?.properties?.task) messages++;
      await route.fulfill({ json: { done: true, message: { role: 'assistant', content } } });
    });
    if (pdf) {
      await page.goto('/');
      const chooser = page.waitForEvent('filechooser');
      await page.locator('#hero-open').click();
      await (await chooser).setFiles({ name: 'dictation.pdf', mimeType: 'application/pdf', buffer: Buffer.from(pdf) });
    } else await page.goto(`/editor?new=${ext}&locale=en`);
    await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
    await page.waitForFunction(() => typeof window.__toggleAgentPanel === 'function');
    await page.evaluate(() => window.__toggleAgentPanel?.());
    const input = page.locator('.cui-input');
    const send = page.locator('.cui-send');
    await input.fill('Connect first');
    await expect(send).toHaveAccessibleName('Reconnect');
    await send.click();
    await expect(send).toHaveAccessibleName('Send');
    await input.fill('');
    await page.locator('.agent-speech-mic').click();
    await expect(page.locator('.agent-speech-feedback')).toContainText('Listening');
    await page.evaluate(() => {
      const recognition = (window as unknown as { recognition: { onresult: (e: unknown) => void } }).recognition;
      recognition.onresult({ results: [{ isFinal: false, 0: { transcript: 'Hello' } }] });
    });
    await expect(input).toHaveValue('Hello');
    expect(messages).toBe(0);
    const layout = await page.locator('.agent-speech-feedback').evaluate((el) => {
      const box = el.getBoundingClientRect();
      const input = document.querySelector('.cui-input')!.getBoundingClientRect();
      const composer = el.closest('.cui-composer')!.getBoundingClientRect();
      return {
        position: getComputedStyle(el).position,
        afterInput: box.top >= input.bottom - 1,
        insideComposer: box.left >= composer.left && box.right <= composer.right,
      };
    });
    expect(layout).toEqual({ position: 'static', afterInput: true, insideComposer: true });
    await expect(send).toBeEnabled();
    await send.click();
    await expect(page.locator('.cui-msg-user')).toHaveText('Hello from dictation');
    await expect(page.locator('.cui-msg-agent')).toContainText('Hello!');
    expect(messages).toBe(1);
    await expect(input).toHaveValue('');
    await expect(page.locator('.agent-speech-feedback')).toBeHidden();
    await expect(page.locator('.agent-speech-mic')).toHaveAttribute('aria-pressed', 'false');
    await input.fill('Keep this draft');
    await page.locator('.agent-speech-mic').click();
    await page.locator('.agent-speech-cancel').click();
    await expect(input).toHaveValue('Keep this draft');
    expect(messages).toBe(1);
  });
}
