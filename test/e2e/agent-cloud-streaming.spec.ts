import { expect, test } from './lib/l0';

for (const kind of ['openai-compatible', 'gemini', 'loopback'] as const) {
  test(`${kind}: renders an incremental answer before its network response completes`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.addInitScript((kind) => {
      localStorage.setItem('document-assistant-enabled', 'true');
      localStorage.setItem(
        `agent_endpoint_key_${encodeURIComponent(kind === 'openai-compatible' ? 'https://stream.example/v1' : kind)}`,
        'fixture-key',
      );
      localStorage.setItem(
        'agent-writing-endpoint',
        JSON.stringify({
          version: 1,
          kind,
          baseUrl:
            kind === 'loopback' ? 'http://localhost:11434' : kind === 'gemini' ? '' : 'https://stream.example/v1',
          model: 'stream-test',
          preference: 'remote-first',
          localWritingConsent: false,
        }),
      );
      const nativeFetch = window.fetch.bind(window);
      const encoder = new TextEncoder();
      window.fetch = async (input, init) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (
          !url.includes('localhost:11434/api/') &&
          !url.includes('stream.example/') &&
          !url.includes('generativelanguage.googleapis.com/')
        )
          return nativeFetch(input, init);
        if (url.endsWith('/tags')) return Response.json({ models: [{ name: 'stream-test' }] });
        const body = JSON.parse(String(init?.body ?? '{}'));
        const streaming = body.stream === true || url.includes(':streamGenerateContent');
        if (!streaming) {
          const content = JSON.stringify({ task: 'chat', language: 'en' });
          return Response.json(
            kind === 'loopback'
              ? { done: true, message: { content } }
              : kind === 'gemini'
                ? { candidates: [{ content: { parts: [{ text: content }] }, finishReason: 'STOP' }] }
                : { choices: [{ message: { content }, finish_reason: 'stop' }] },
          );
        }
        const state = window as unknown as { finishStream: () => void; streamFinished: boolean };
        state.streamFinished = false;
        const event = (text: string, done: boolean) =>
          kind === 'loopback'
            ? JSON.stringify({ done, ...(done ? { done_reason: 'stop' } : {}), message: { content: text } }) + '\n'
            : `data: ${JSON.stringify(
                kind === 'gemini'
                  ? { candidates: [{ content: { parts: [{ text }] }, ...(done ? { finishReason: 'STOP' } : {}) }] }
                  : { choices: [{ delta: { content: text }, finish_reason: done ? 'stop' : null }] },
              )}\n\n`;
        return new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode(event('First sentence. ', false)));
              state.finishStream = () => {
                state.streamFinished = true;
                controller.enqueue(encoder.encode(event('Finished.', true)));
                if (kind === 'openai-compatible') controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                controller.close();
              };
            },
          }),
          { headers: { 'Content-Type': kind === 'loopback' ? 'application/x-ndjson' : 'text/event-stream' } },
        );
      };
    }, kind);
    await page.goto('/editor?new=docx&locale=en');
    await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
    await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
    const input = page.locator('.cui-input');
    await input.fill('Hello');
    await page.locator('.cui-send').click();
    await expect(page.locator('.agent-panel-endpoint-status')).toContainText(
      kind === 'loopback' ? 'Connected' : 'Configured',
    );
    await expect(page.locator('.cui-send')).toHaveAccessibleName('Send');
    await page.locator('.cui-send').click();
    await expect(page.locator('.cui-streaming .cui-bubble')).toContainText('First sentence.');
    expect(await page.evaluate(() => (window as unknown as { streamFinished: boolean }).streamFinished)).toBe(false);
    await expect(page.locator('.cui-send-stop')).toBeVisible();
    await page.evaluate(() => (window as unknown as { finishStream: () => void }).finishStream());
    await expect(page.locator('.cui-streaming')).toHaveCount(0);
    await expect(page.locator('.cui-msg-agent')).toHaveCount(1);
    await expect(page.locator('.cui-msg-agent')).toContainText('First sentence. Finished.');
    await expect(page.locator('.cui-send-stop')).toHaveCount(0);
  });
}
