import { expect, test } from './lib/l0';

async function assetLists(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    const source = await (await fetch('/sw.js', { cache: 'no-store' })).text();
    return {
      core: JSON.parse(/const APP_ASSETS_TO_CACHE = (\[.*?\]);/.exec(source)![1]) as string[],
      capabilities: JSON.parse(/const ASSISTANT_CAPABILITY_ASSETS = (\{.*?\});/.exec(source)![1]) as Record<
        string,
        string[]
      >,
    };
  });
}

test('prepares only the requested runtime and keeps it available offline', async ({ page, context }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  const lists = await assetLists(page);
  expect(lists.core.length).toBeGreaterThan(0);
  expect(lists.capabilities.cpu.some((path) => path.endsWith('.wasm'))).toBe(true);
  expect(lists.core.some((path) => path.endsWith('.wasm') || /webllm/.test(path))).toBe(false);
  const cached = await page.evaluate(
    async (assets) => Promise.all(assets.map(async (path) => Boolean(await caches.match(path)))),
    Object.values(lists.capabilities).flat(),
  );
  expect(cached.every((present) => !present)).toBe(true);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  const prepare = () =>
    page.evaluate(
      () =>
        new Promise<boolean>((resolve, reject) => {
          const channel = new MessageChannel();
          const timer = setTimeout(() => reject(new Error('CPU preparation timed out')), 60_000);
          channel.port1.onmessage = (event) => {
            clearTimeout(timer);
            channel.port1.close();
            resolve(event.data.type === 'ASSISTANT_PREPARED' && event.data.ok === true);
          };
          navigator.serviceWorker.controller!.postMessage({ type: 'PREPARE_ASSISTANT', capability: 'cpu' }, [
            channel.port2,
          ]);
        }),
    );
  // Prepare the editor once online before testing its offline reuse. Home
  // precaches the shell; editor-specific SDK chunks are cached on first use.
  await page.goto('/editor?new=docx');
  await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()), undefined, { timeout: 60_000 });
  expect(await prepare()).toBe(true);
  const unrelated = await page.evaluate(
    async (assets) => Promise.all(assets.map(async (path) => Boolean(await caches.match(path)))),
    [...lists.capabilities.webgpu, ...lists.capabilities.pdf, ...lists.capabilities['cpu-compat']],
  );
  expect(unrelated.every((present) => !present)).toBe(true);
  await context.setOffline(true);
  expect(await prepare()).toBe(true);
  const available = await page.evaluate(
    async (assets) => Promise.all(assets.map(async (path) => (await fetch(path)).ok)),
    lists.capabilities.cpu,
  );
  expect(available.every(Boolean)).toBe(true);
  await page.goto('/editor?new=docx');
  await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()), undefined, { timeout: 60_000 });
  await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
  await page.locator('.agent-onboarding .agent-enable-switch').click();
  await expect(page.locator('.agent-runtime-panel')).toBeVisible();
});

test('a remembered opt-in on Home and a cloud-only panel download no local inference or PDF assets', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    localStorage.setItem('document-assistant-enabled', 'true');
    localStorage.setItem(
      'agent-writing-endpoint',
      JSON.stringify({
        version: 1,
        kind: 'openai-compatible',
        baseUrl: 'https://stream.example/v1',
        model: 'gpt-4.1-mini',
        preference: 'remote-first',
        localWritingConsent: false,
      }),
    );
  });
  await page.goto('/');
  const lists = await assetLists(page);
  const optional = Object.values(lists.capabilities).flat();
  expect(optional.length).toBeGreaterThan(0);
  const requests: string[] = [];
  page.on('request', (request) => requests.push(new URL(request.url()).pathname));
  await page.goto('/editor?new=docx');
  await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()), undefined, { timeout: 60_000 });
  await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
  await expect(page.locator('.agent-runtime-panel')).toBeVisible();
  expect(requests.filter((path) => optional.includes(path))).toEqual([]);
  const cached = await page.evaluate(
    async (assets) => Promise.all(assets.map(async (path) => Boolean(await caches.match(path)))),
    optional,
  );
  expect(cached.every((present) => !present)).toBe(true);
});

test('a new deployment restores the union of prepared capabilities from older worker caches', async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  // Seed persisted outgoing-worker metadata before this browser registers the new build.
  await page.goto('/manifest.json');
  await page.evaluate(async () => {
    for (const [build, capability] of [
      ['old-a', 'cpu'],
      ['old-b', 'pdf'],
    ]) {
      const cache = await caches.open(`document-editor-core-${build}`);
      await cache.put(
        `/__document-assistant-prepared__/${capability}`,
        new Response('1', { headers: { 'X-Document-Assistant-Prepared': '1' } }),
      );
    }
  });
  await page.goto('/');
  const lists = await assetLists(page);
  const checked = await page.evaluate(
    async ({ cpu, pdf, webgpu }) => ({
      restored: await Promise.all([...cpu, ...pdf].map(async (path) => Boolean(await caches.match(path)))),
      unrelated: await Promise.all(webgpu.map(async (path) => Boolean(await caches.match(path)))),
    }),
    lists.capabilities as { cpu: string[]; pdf: string[]; webgpu: string[] },
  );
  expect(checked.restored.every(Boolean)).toBe(true);
  expect(checked.unrelated.every((present) => !present)).toBe(true);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  const available = await page.evaluate(
    async (assets) => Promise.all(assets.map(async (path) => (await fetch(path)).ok)),
    [...lists.capabilities.cpu, ...lists.capabilities.pdf],
  );
  expect(available.every(Boolean)).toBe(true);
});
