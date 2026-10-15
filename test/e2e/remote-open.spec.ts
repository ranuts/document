import { expect, test } from './lib/l0';

test('a failed startup URL is reported once without retrying it as a decoding failure', async ({ page, l0 }) => {
  l0.allowConsole(/^Error opening document from URL:/);
  let requests = 0;
  const decodeWarnings: string[] = [];
  page.on('console', (message) => {
    if (message.text().startsWith('Failed to decode URL')) decodeWarnings.push(message.text());
  });
  const reported = page.waitForEvent('console', (message) =>
    message.text().startsWith('Error opening document from URL:'),
  );
  await page.route('**/missing-startup.docx', async (route) => {
    requests++;
    await route.fulfill({ status: 404, body: 'missing' });
  });
  await page.goto('/editor?locale=en&file=' + encodeURIComponent('/missing-startup.docx'));
  expect((await reported).text()).toContain('404');
  await expect(page.locator('.loading-mask')).toHaveCount(0);
  expect(decodeWarnings).toEqual([]);
  expect(requests).toBe(1);
});

test('an embedded failed URL open returns an error for that request', async ({ page, l0 }) => {
  l0.allowConsole(/^Error opening document from URL:/);
  await page.route('**/missing-embed.docx', (route) => route.fulfill({ status: 404, body: 'missing' }));
  await page.goto('/embed-demo.html');
  await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });
  const result = await page.evaluate(async () => {
    try {
      await post('document:open-url', { url: location.origin + '/missing-embed.docx' });
      return { opened: true, error: '' };
    } catch (error) {
      return { opened: false, error: String(error) };
    }
  });
  expect(result.opened).toBe(false);
  expect(result.error).toContain('404');
});
