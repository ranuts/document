import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { expect, test } from './lib/l0';
import { mockApi, originalApiUrl } from './lib/mock-api';

test('API fixtures preserve status, streaming and cancellation under the production service worker', async ({
  page,
  l0,
}) => {
  // The same-origin Request case intentionally triggers browser security diagnostics.
  l0.allowFrameError(/^\/127\.0\.0\.1:\d+\/\?url=http%3A%2F%2Flocalhost%3A11434%2Fapi%2Fchat\.$/);
  l0.allowConsole(
    /Security Error:.*may not load data from http:\/\/127\.0\.0\.1:\d+\/\?url=http%3A%2F%2Flocalhost%3A11434%2Fapi%2Fchat/,
  );
  l0.allowConsole(
    /^Fetch API cannot load http:\/\/127\.0\.0\.1:\d+\/\?url=http%3A%2F%2Flocalhost%3A11434%2Fapi%2Fchat\. Request mode is "same-origin" but the URL's origin is not same as the request origin http:\/\/127\.0\.0\.1:\d+\.$/,
  );
  const sw = await readFile('public/sw.js', 'utf8');
  const server = createServer((request, response) => {
    response.setHeader('content-type', request.url === '/sw.js' ? 'text/javascript' : 'text/html');
    response.end(request.url === '/sw.js' ? sw : '<!doctype html><title>API fixture regression</title>');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  let release!: () => void;
  const pending = new Promise<void>((resolve) => (release = resolve));
  try {
    await mockApi(page, 'http://localhost:11434/api/**', async (route) => {
      if (route.request().url().endsWith('/pending')) await pending;
      await route.fulfill({ status: 202, contentType: 'text/event-stream', body: 'data: fixture\n\n' });
    });
    const origin = `http://127.0.0.1:${address.port}`;
    const navigation = page.waitForRequest((request) => request.url() === `${origin}/`);
    await page.goto(origin);
    expect(originalApiUrl(page, (await navigation).url())).toBe(`${origin}/`);
    await page.evaluate(async () => {
      await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    const api = 'http://localhost:11434/api/chat';
    const events = Promise.all([
      page.waitForRequest((request) => originalApiUrl(page, request.url()) === api && request.method() === 'POST', {
        timeout: 5000,
      }),
      page.waitForResponse(
        (response) => originalApiUrl(page, response.url()) === api && response.request().method() === 'POST',
        { timeout: 5000 },
      ),
    ]);
    const received = await page.evaluate(async () => {
      const response = await fetch('http://localhost:11434/api/chat', { method: 'POST', body: '{}' });
      const chunk = await response.body!.getReader().read();
      return { status: response.status, text: new TextDecoder().decode(chunk.value) };
    });
    expect(received).toEqual({ status: 202, text: 'data: fixture\n\n' });
    const [request, response] = await events;
    expect(originalApiUrl(page, request.url())).toBe(api);
    expect(request.postData()).toBe('{}');
    expect(originalApiUrl(page, response.url())).toBe(api);
    expect(response.status()).toBe(202);
    expect(
      await page.evaluate(async () => {
        try {
          await fetch(new Request('http://localhost:11434/api/chat', { mode: 'same-origin' }));
          return 'completed';
        } catch (error) {
          return (error as Error).name;
        }
      }),
    ).toBe('TypeError');
    expect(
      await page.evaluate(async () => {
        const controller = new AbortController();
        const request = fetch('http://localhost:11434/api/pending', { signal: controller.signal });
        controller.abort();
        try {
          await request;
          return 'completed';
        } catch (error) {
          return (error as Error).name;
        }
      }),
    ).toBe('AbortError');
  } finally {
    release();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
