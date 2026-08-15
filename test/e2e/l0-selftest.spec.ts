import { expect, test } from './lib/l0';

declare function post(type: string, payload?: Record<string, unknown>): Promise<any>;

/**
 * Proves the L0 fixture actually observes SDK errors: a garbage payload
 * with an .xlsx name must make the editor raise asc_onError, and the
 * fixture must see it. Without this test a silently broken hook would
 * make every other suite look cleaner than it is.
 */
test.describe('L0 fixture self-test', () => {
  test.describe.configure({ timeout: 120_000 });

  test('captures asc_onError from the editor frame', async ({ page, l0 }) => {
    await page.goto('/embed-demo.html');
    await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });
    await page.evaluate(async () => {
      const junk = new TextEncoder().encode('this is not a workbook at all, just text').buffer;
      try {
        await post('document:open-buffer', { fileName: 'junk.xlsx', buffer: junk, readonly: false });
      } catch {
        /* the embed reply may reject or resolve; the SDK error is what matters */
      }
    });
    await expect.poll(() => l0.ascErrors(), { timeout: 60_000 }).not.toEqual([]);
    const errors = await l0.ascErrors();
    console.log('L0 self-test observed:', JSON.stringify(errors));
    // Declare the exact ids so assertClean passes; anything else is a defect.
    for (const e of errors) l0.expectAscError(e.id);
    l0.allowConsole(/./); // conversion failure logs are expected here
  });
});
