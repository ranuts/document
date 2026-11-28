import { expect, test } from './lib/l0';

// The model name is picked from the service's own list instead of being typed
// from memory; the pick is stored exactly as a typed name would be.
test('fetches the model list from an AI service and stores the picked model', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    localStorage.setItem('document-assistant-enabled', 'true');
    localStorage.setItem(`agent_endpoint_key_${encodeURIComponent('https://models.example/v1')}`, 'fixture-key');
    localStorage.setItem(
      'agent-writing-endpoint',
      JSON.stringify({
        version: 1,
        kind: 'openai-compatible',
        baseUrl: 'https://models.example/v1',
        model: 'typed-model',
        preference: 'remote-first',
        localWritingConsent: false,
      }),
    );
    const nativeFetch = window.fetch.bind(window);
    const seen: Array<{ url: string; auth: string | null }> = [];
    (window as unknown as { modelListRequests: typeof seen }).modelListRequests = seen;
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (!url.startsWith('https://models.example/')) return nativeFetch(input, init);
      const auth = new Headers(init?.headers).get('Authorization');
      seen.push({ url, auth });
      return Response.json({ data: [{ id: 'model-b' }, { id: 'model-a' }] });
    };
  });
  await page.goto('/editor?new=docx&locale=en');
  await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
  await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
  const panel = page.locator('.agent-runtime-panel');
  await expect(panel).toHaveAttribute('data-view', 'chat');
  await page.locator('.agent-panel-settings-toggle').click();
  await expect(panel).toHaveAttribute('data-view', 'settings');

  const typed = page.locator('.agent-panel-endpoint-model');
  const list = page.locator('.agent-panel-endpoint-model-list');
  await expect(typed).toBeVisible();
  await expect(list).toBeHidden();
  await page.locator('.agent-panel-endpoint-model-fetch').click();
  await expect(list).toBeVisible();
  await expect(typed).toBeHidden();
  expect(await page.evaluate(() => (window as unknown as { modelListRequests: unknown }).modelListRequests)).toEqual([
    { url: 'https://models.example/v1/models', auth: 'Bearer fixture-key' },
  ]);

  await list.click();
  const dropdown = page.locator('r-dropdown[role="listbox"]:visible');
  await expect(dropdown.getByText('model-a', { exact: true })).toBeVisible();
  await dropdown.getByText('model-b', { exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('agent-writing-endpoint') ?? '{}').model))
    .toBe('model-b');
});
