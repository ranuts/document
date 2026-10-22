import { mockApi } from './lib/mock-api';
import { expect, test } from './lib/l0';
import { buildDocx, toBase64 } from './lib/ooxml';

test.describe('first microphone permission', () => {
  // Keep the delayed SDK request observable rather than served by a worker cache.
  test.use({ serviceWorkers: 'block' });
  test('initial model discovery does not interrupt the first microphone permission request', async ({ page }) => {
    test.setTimeout(90_000);
    await page.addInitScript(() => {
      localStorage.setItem('document-assistant-enabled', 'true');
      const state = window as unknown as {
        SpeechRecognition: unknown;
        recognition: { onstart?: () => void; onend?: () => void; onresult?: (event: unknown) => void };
        speechAborts: number;
      };
      state.speechAborts = 0;
      state.SpeechRecognition = class {
        onstart?: () => void;
        onend?: () => void;
        onresult?: (event: unknown) => void;
        constructor() {
          state.recognition = this;
        }
        start() {}
        stop() {}
        abort() {
          state.speechAborts++;
        }
      };
    });
    let release!: () => void;
    const discovery = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/assets/lib-*.js', async (route) => {
      await discovery;
      await route.continue();
    });
    try {
      await page.goto('/editor?new=docx&locale=en');
      await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
      await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
      await page.locator('.agent-speech-mic').click();
      await expect(page.locator('.agent-speech')).toHaveAttribute('data-state', 'starting');
      release();
      await expect(page.locator('.agent-model-cache > summary')).toContainText('(0)');
      await expect(page.locator('.agent-runtime-panel')).toHaveAttribute('data-view', 'chat');
      await expect(page.locator('.agent-speech')).toHaveAttribute('data-state', 'starting');
      expect(await page.evaluate(() => (window as unknown as { speechAborts: number }).speechAborts)).toBe(0);
      await page.evaluate(() => {
        const recognition = (
          window as unknown as { recognition: { onstart: () => void; onresult: (event: unknown) => void } }
        ).recognition;
        recognition.onstart();
        recognition.onresult({ results: [{ isFinal: false, 0: { transcript: 'My first dictated request' } }] });
      });
      await expect(page.locator('.cui-input')).toHaveValue('My first dictated request');
      await page.locator('.agent-speech-mic').click();
      await page.evaluate(() => (window as unknown as { recognition: { onend: () => void } }).recognition.onend());
      await expect(page.locator('.agent-speech')).toHaveAttribute('data-state', 'idle');
      await page.locator('.agent-panel-settings-toggle').click();
      await expect(page.locator('.agent-runtime-panel')).toHaveAttribute('data-view', 'settings');
    } finally {
      release();
    }
  });
});

// Native editors and the real composer run. Browser speech events and an AI
// endpoint are controlled so permissions, cancellation and latency are repeatable.
for (const ext of ['docx', 'xlsx', 'pptx', 'pdf'] as const) {
  test(`${ext}: dictation stays in composer flow and explicit Send finalizes the transcript`, async ({
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
        onerror?: (event: { error: string }) => void;
        onresult?: (event: unknown) => void;
        constructor() {
          state.recognition = this;
        }
        start() {}
        stop() {}
        abort() {}
      };
    });
    let messages = 0;
    let holdNextAnswer = false;
    let releaseAnswer: (() => void) | undefined;
    await mockApi(page, 'http://localhost:11434/api/**', async (route) => {
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
      if (!request.format?.properties?.task) {
        messages++;
        if (holdNextAnswer) {
          holdNextAnswer = false;
          await new Promise<void>((resolve) => {
            releaseAnswer = resolve;
          });
        }
      }
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
    const composer = page.locator('.cui-composer');
    const idle = await composer.boundingBox();
    const messagesBox = await page.locator('.cui-messages').boundingBox();
    await page.locator('.agent-speech-mic').click();
    await expect(page.locator('.agent-speech')).toHaveAttribute('data-state', 'starting');
    expect(await composer.boundingBox()).toEqual(idle);
    await page.evaluate(() => {
      (window as unknown as { recognition: { onstart: () => void } }).recognition.onstart();
    });
    await expect(page.locator('.agent-speech-feedback')).toContainText('Listening');
    if (ext === 'docx') {
      await expect(page.locator('r-popover.agent-speech-privacy')).toHaveAttribute('open', '');
      await page.waitForTimeout(3200);
      await expect(page.locator('r-popover.agent-speech-privacy')).not.toHaveAttribute('open');
      await expect(page.locator('.agent-speech')).toHaveAttribute('data-state', 'listening');
    }
    const listening = await composer.boundingBox();
    expect(listening!.height).toBeCloseTo(idle!.height, 0);
    expect(listening!.y).toBeCloseTo(idle!.y, 0);
    expect((await page.locator('.cui-messages').boundingBox())!.height).toBeCloseTo(messagesBox!.height, 0);
    await page.evaluate(() => {
      const recognition = (window as unknown as { recognition: { onresult: (e: unknown) => void } }).recognition;
      recognition.onresult({ results: [{ isFinal: false, 0: { transcript: 'Hello' } }] });
    });
    await expect(input).toHaveValue('Hello');
    expect(messages).toBe(0);
    if (ext === 'docx') await page.screenshot({ path: testInfo.outputPath('speech-listening.png') });
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
    const beforeFinish = await composer.boundingBox();
    await page.locator('.agent-speech-mic').click();
    await expect(page.locator('.agent-speech')).toHaveAttribute('data-state', 'finishing');
    const finishing = await composer.boundingBox();
    expect(finishing!.height).toBeCloseTo(beforeFinish!.height, 0);
    expect(finishing!.y).toBeCloseTo(beforeFinish!.y, 0);
    await send.click();
    await page.evaluate(() => {
      const recognition = (window as unknown as { recognition: { onresult: (e: unknown) => void; onend: () => void } })
        .recognition;
      recognition.onresult({ results: [{ isFinal: true, 0: { transcript: 'Hello from dictation' } }] });
      recognition.onend();
    });
    await expect(page.locator('.cui-msg-user')).toHaveText('Hello from dictation');
    await expect(page.locator('.cui-msg-agent')).toContainText('Hello!');
    expect(messages).toBe(1);
    await expect(input).toHaveValue('');
    await expect(page.locator('.agent-speech-feedback')).toBeHidden();
    await expect(page.locator('.agent-speech-mic')).toHaveAttribute('aria-pressed', 'false');
    const longDraft = Array.from({ length: 12 }, (_, i) => `Keep draft line ${i + 1}`).join('\n');
    await input.fill(longDraft);
    const disclosure = page.locator('.agent-speech-privacy');
    const privacyToggle = disclosure.locator('button');
    const beforePrivacy = await composer.boundingBox();
    await privacyToggle.focus();
    await privacyToggle.press('Enter');
    await expect(disclosure).toHaveAttribute('open', '');
    expect(await composer.boundingBox()).toEqual(beforePrivacy);
    if (ext === 'docx') {
      await page.waitForTimeout(3200);
      await expect(disclosure).toHaveAttribute('open', '');
    }
    await privacyToggle.press('Escape');
    await expect(disclosure).not.toHaveAttribute('open');
    await expect(privacyToggle).toBeFocused();
    if (ext === 'docx') {
      await privacyToggle.press('Enter');
      await input.focus();
      await page.locator('.agent-speech-hint').hover();
      await page.waitForTimeout(3200);
      await expect(disclosure).toHaveAttribute('open', '');
      await page.mouse.move(0, 0);
      await page.waitForTimeout(3200);
      await expect(disclosure).not.toHaveAttribute('open');
      expect(await composer.boundingBox()).toEqual(beforePrivacy);
    }
    await page.locator('.agent-speech-mic').click();
    await page.locator('.agent-speech-cancel').click();
    await expect(input).toHaveValue(longDraft);
    await expect(page.locator('.agent-speech-mic')).toBeFocused();
    expect(await composer.boundingBox()).toEqual(beforePrivacy);
    if (ext === 'docx') await page.screenshot({ path: testInfo.outputPath('speech-idle-long-draft.png') });
    expect(messages).toBe(1);
    if (ext === 'docx') {
      await page.locator('.agent-panel-resizer').press('Home');
      await expect(page.locator('.agent-panel-resizer')).toHaveAttribute('aria-valuenow', '320');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const compact = await composer.boundingBox();
      await page.locator('.agent-speech-mic').click();
      expect(await composer.boundingBox()).toEqual(compact);
      const controls = await page.locator('.agent-speech').evaluate((el) => ({
        overflow: el.scrollWidth > el.clientWidth,
        animation: getComputedStyle(el.querySelector('.agent-speech-mic')!, '::before').animationName,
      }));
      expect(controls).toEqual({ overflow: false, animation: 'none' });
      await page.evaluate(() => {
        (window as unknown as { recognition: { onstart: () => void } }).recognition.onstart();
      });
      expect(await composer.boundingBox()).toEqual(compact);
      const liveStatus = page.locator('.agent-speech-feedback [role="status"]');
      await expect(liveStatus).toHaveText('Listening…');
      await expect(page.locator('.agent-sources-toggle')).toBeHidden();
      expect(await liveStatus.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
      await expect(page.locator('.agent-speech-language')).toBeHidden();
      await page.screenshot({ path: testInfo.outputPath('speech-compact.png') });
      await page.evaluate(() => {
        (window as unknown as { recognition: { onerror: (event: { error: string }) => void } }).recognition.onerror({
          error: 'not-allowed',
        });
      });
      await expect(liveStatus).toContainText('Microphone permission denied');
      const errorWidth = await liveStatus.evaluate((el) => el.clientWidth);
      expect(errorWidth).toBeGreaterThan(100);
      await expect(disclosure).not.toHaveAttribute('open', { timeout: 4500 });
      await expect(liveStatus).toContainText('Microphone permission denied');
      await privacyToggle.click();
      await expect(page.locator('.agent-speech-notice')).toContainText('Microphone permission denied');
      await expect(page.locator('.agent-speech-hint')).toContainText('browser');
      // The anchored disclosure can cover the center of a tall draft. Click
      // the visible text inset to exercise an actual outside click.
      await input.click({ position: { x: 8, y: 8 } });
      await expect(disclosure).not.toHaveAttribute('open');
      await expect(input).toBeFocused();
      await page.locator('.agent-speech-mic').click();
      await page.locator('.agent-speech-cancel').click();
      await expect(input).toHaveValue(longDraft);
      await expect(page.locator('.agent-speech-language')).toBeHidden();
      await privacyToggle.click();
      await expect(page.locator('.agent-speech-language')).toBeVisible();
      await expect(page.locator('.agent-speech-language')).not.toHaveAttribute('disabled');
      await privacyToggle.press('Escape');
      expect(await composer.boundingBox()).toEqual(compact);
      holdNextAnswer = true;
      await input.fill('Hello');
      await send.click();
      await expect.poll(() => messages).toBe(2);
      await expect.poll(() => typeof releaseAnswer).toBe('function');
      try {
        await page.locator('.agent-speech-mic').click();
        await expect(page.locator('.agent-speech')).toHaveAttribute('data-state', 'starting');
        await page.evaluate(() => {
          const recognition = (
            window as unknown as { recognition: { onstart(): void; onresult(event: unknown): void } }
          ).recognition;
          recognition.onstart();
          recognition.onresult({ results: [{ isFinal: false, 0: { transcript: 'Hi' } }] });
        });
        await expect(input).toHaveValue('Hi');
        expect(messages).toBe(2);
        await send.click();
        await expect(page.locator('.agent-speech')).toHaveAttribute('data-state', 'finishing');
        await page.evaluate(() => {
          const recognition = (window as unknown as { recognition: { onresult(event: unknown): void; onend(): void } })
            .recognition;
          recognition.onresult({ results: [{ isFinal: true, 0: { transcript: 'Hi' } }] });
          recognition.onend();
        });
        await expect(page.locator('.agent-queue-text')).toHaveText('Hi');
        await expect(input).toHaveValue('');
        await expect(input).toBeFocused();
        expect(messages).toBe(2);
        releaseAnswer!();
        await expect.poll(() => messages).toBe(3);
        await expect(page.locator('.cui-msg-user')).toHaveText(['Hello from dictation', 'Hello', 'Hi']);
        await expect(page.locator('.cui-msg-agent')).toHaveCount(3);
        await expect(page.locator('.agent-queue-entry')).toHaveCount(0);
      } finally {
        releaseAnswer?.();
      }
    }
    await expect(page.locator('.cui-send-stop')).toHaveCount(0);
    await input.fill('Original conversation draft');
    await page.locator('.agent-panel-clear').click();
    await expect(input).toHaveValue('');
    await input.fill('New conversation draft');
    await page.locator('.agent-speech-mic').click();
    await page.evaluate(() => {
      const recognition = (window as unknown as { recognition: { onstart(): void; onresult(event: unknown): void } })
        .recognition;
      recognition.onstart();
      recognition.onresult({ results: [{ isFinal: false, 0: { transcript: 'Dictated continuation' } }] });
    });
    await expect(input).toHaveValue('New conversation draft Dictated continuation');
    await page.locator('.agent-panel-title').click();
    await expect(input).toHaveValue('Original conversation draft');
    await expect(page.locator('.agent-speech')).toHaveAttribute('data-state', 'idle');
    await expect(page.locator('.cui-msg-user').first()).toHaveText('Hello from dictation');
    await page.evaluate(() => {
      const recognition = (window as unknown as { recognition: { onresult(event: unknown): void; onend(): void } })
        .recognition;
      recognition.onresult({ results: [{ isFinal: true, 0: { transcript: 'Obsolete speech' } }] });
      recognition.onend();
    });
    await expect(input).toHaveValue('Original conversation draft');
    await page.locator('.agent-history-toggle').click();
    await page.locator('.agent-conversation-open').filter({ hasText: 'New conversation' }).click();
    await expect(input).toHaveValue('New conversation draft Dictated continuation');
  });
}
