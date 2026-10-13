import { expect, test } from './lib/l0';

test('the first visit defers inference assets and explicit preparation keeps them available offline', async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  await page.goto('/');
  const lists = await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    const source = await (await fetch('/sw.js', { cache: 'no-store' })).text();
    const parse = (name: string): string[] => JSON.parse(new RegExp(`const ${name} = (\\[.*?\\]);`).exec(source)![1]);
    return { core: parse('APP_ASSETS_TO_CACHE'), assistant: parse('ASSISTANT_ASSETS_TO_CACHE') };
  });
  expect(lists.core.length).toBeGreaterThan(0);
  expect(lists.assistant.some((path) => path.endsWith('.wasm'))).toBe(true);
  expect(lists.core.some((path) => path.endsWith('.wasm') || /webllm/.test(path))).toBe(false);
  const cached = await page.evaluate(async (assets) => {
    const names = (await caches.keys()).filter((name) => name.startsWith('document-editor-core-'));
    const cache = await caches.open(names[0]);
    return Promise.all(assets.map(async (path) => Boolean(await cache.match(path))));
  }, lists.assistant);
  expect(cached.every((present) => !present)).toBe(true);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  const prepare = () =>
    page.evaluate(
      () =>
        new Promise<boolean>((resolve, reject) => {
          const channel = new MessageChannel();
          const timer = setTimeout(() => reject(new Error('Assistant cache preparation timed out')), 60_000);
          channel.port1.onmessage = (event) => {
            clearTimeout(timer);
            channel.port1.close();
            resolve(event.data.type === 'ASSISTANT_PREPARED' && event.data.ok === true);
          };
          navigator.serviceWorker.controller!.postMessage({ type: 'PREPARE_ASSISTANT' }, [channel.port2]);
        }),
    );
  await page.goto('/editor?new=docx');
  await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()), undefined, { timeout: 60_000 });
  expect(await prepare()).toBe(true);
  await context.setOffline(true);
  expect(await prepare()).toBe(true);
  const available = await page.evaluate(
    async (assets) => Promise.all(assets.map(async (path) => (await fetch(path)).ok)),
    lists.assistant,
  );
  expect(available.every(Boolean)).toBe(true);
  await page.goto('/editor?new=docx');
  await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()), undefined, { timeout: 60_000 });
  await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
  await page.locator('.agent-onboarding .agent-enable-switch').click();
  await expect(page.locator('.agent-runtime-panel')).toBeVisible();
});

test('a remembered opt-in on Home migrates prepared runtime before the worker is ready', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => localStorage.setItem('document-assistant-enabled', 'true'));
  await page.goto('/');
  const present = await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    const source = await (await fetch('/sw.js', { cache: 'no-store' })).text();
    const optional: string[] = JSON.parse(/const ASSISTANT_ASSETS_TO_CACHE = (\[.*?\]);/.exec(source)![1]);
    return {
      count: optional.length,
      cached: await Promise.all(optional.map(async (path) => Boolean(await caches.match(path)))),
    };
  });
  expect(present.count).toBeGreaterThan(0);
  expect(present.cached.every(Boolean)).toBe(true);
});
