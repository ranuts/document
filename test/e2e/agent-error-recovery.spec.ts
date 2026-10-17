import { expect, test } from './lib/l0';

test('explains Gemini rate limiting and restores the request without exposing its error body', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    localStorage.setItem('document-assistant-enabled', 'true');
    localStorage.setItem('agent_endpoint_key_gemini', 'test-key');
    localStorage.setItem(
      'agent-writing-endpoint',
      JSON.stringify({
        version: 1,
        kind: 'gemini',
        baseUrl: '',
        model: 'recovery-test',
        preference: 'remote-first',
        localWritingConsent: false,
      }),
    );
  });
  let requests = 0;
  await page.route('https://generativelanguage.googleapis.com/**', async (route) => {
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,x-goog-api-key',
    };
    if (route.request().method() === 'OPTIONS') await route.fulfill({ status: 204, headers });
    else {
      requests++;
      await route.fulfill({ status: 429, headers, body: 'private-provider-response secret-token' });
    }
  });
  await page.goto('/editor?new=docx&locale=en');
  await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
  await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
  const input = page.locator('.cui-input');
  const send = page.locator('.cui-send');
  await input.fill('Hello');
  await send.click();
  await expect(page.locator('.agent-panel-endpoint-status')).toContainText('Configured');
  await expect(send).toHaveAccessibleName('Send');
  await send.click();
  const error = page.locator('.cui-msg-error');
  await expect(error).toContainText('The AI service is receiving too many requests');
  await expect(error).not.toContainText('private-provider-response');
  await expect(error).not.toContainText('secret-token');
  await expect(page.locator('.cui-send-stop')).toHaveCount(0);
  await error.getByRole('button', { name: 'Restore request' }).click();
  await expect(input).toHaveValue('Hello');
  await expect(input).toBeFocused();
  expect(requests).toBe(1);
});

test('explains a service failure without private details and restores the original request without resending', async ({
  page,
  l0,
}, testInfo) => {
  test.setTimeout(90_000);
  l0.allowConsole(/Failed to load resource: the server responded with a status of 503/);
  await page.addInitScript(() => {
    localStorage.setItem('document-assistant-enabled', 'true');
    localStorage.setItem(
      'agent-writing-endpoint',
      JSON.stringify({
        version: 1,
        kind: 'loopback',
        baseUrl: 'http://localhost:11434',
        model: 'recovery-test',
        preference: 'device-first',
        localWritingConsent: false,
      }),
    );
  });
  let requests = 0;
  await page.route('http://localhost:11434/api/**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' },
      });
    } else if (route.request().url().endsWith('/tags')) {
      await route.fulfill({ json: { models: [{ name: 'recovery-test' }] } });
    } else {
      requests++;
      await route.fulfill({ status: 503, body: 'private-provider-response secret-token' });
    }
  });
  await page.goto('/editor?new=docx&locale=en');
  await page.waitForFunction(() => Boolean(window.__ooFrames.readyEditor()));
  await page.frameLocator('iframe[name="frameEditor"]').locator('.agent-sidebar-entry').click();
  const input = page.locator('.cui-input');
  const send = page.locator('.cui-send');
  await input.fill('Hello');
  await send.click();
  await expect(page.locator('.agent-panel-endpoint-status')).toContainText('Connected');
  await expect(send).toHaveAccessibleName('Send');
  await send.click();
  const error = page.locator('.cui-msg-error');
  await expect(error).toContainText('The AI service is temporarily unavailable');
  await expect(error).not.toContainText('private-provider-response');
  await expect(error).not.toContainText('secret-token');
  await expect(page.locator('.cui-send-stop')).toHaveCount(0);
  await error.getByRole('button', { name: 'Restore request' }).click();
  await expect(input).toHaveValue('Hello');
  await expect(input).toBeFocused();
  expect(requests).toBe(1);
  await page.locator('.agent-runtime-panel').screenshot({ path: testInfo.outputPath('service-error-recovery.png') });
});
