import { expect, test } from './lib/l0';

declare function post(type: string, payload?: Record<string, unknown>): Promise<any>;

/**
 * Open-conversion failure must be visible and must not wedge the editor.
 *
 * Before installOpenFailureGuard (lib/onlyoffice-editor.ts) a payload the
 * vendor's x2t cannot import left the editor on "Loading spreadsheet"
 * forever: the failure was an unhandled rejection inside the editor frame,
 * no asc_onError fired, no dialog, and document:save waited out its 60 s
 * timeout. Corpus campaign defect #3.
 *
 * This is also the L0 fixture's self-test: it proves the fixture observes
 * asc_onError and frame rejections (a silently broken hook would make every
 * other suite look cleaner than it is).
 */
test.describe('open failure surfacing (real editor)', () => {
  test.describe.configure({ timeout: 120_000 });

  test('garbage bytes named .xlsx raise asc_onError -82, end the load mask and fail saves fast', async ({
    page,
    l0,
  }) => {
    l0.expectAscError(-82);
    l0.allowFrameError(/Document conversion failed/);
    l0.allowConsole(/Document conversion failed|Conversion failed with code|open conversion failed|changesError/);

    await page.goto('/embed-demo.html');
    await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });

    await page.evaluate(async () => {
      const junk = new TextEncoder().encode('this is not a workbook at all, just text').buffer;
      await post('document:open-buffer', { fileName: 'junk.xlsx', buffer: junk, readonly: false });
    });

    // The SDK error path ran: the vendor's own open-error dialog is up ...
    const editorFrame = page.frameLocator('iframe').frameLocator('iframe[name="frameEditor"]');
    await expect(
      editorFrame.locator('.asc-window.modal.alert', { hasText: /error has occurred while opening/i }).first(),
    ).toBeVisible({ timeout: 60_000 });
    // ... and the "Loading spreadsheet" mask is gone instead of spinning forever.
    await expect(editorFrame.locator('.asc-loadmask')).toHaveCount(0, { timeout: 15_000 });

    // Saves reject immediately with the open failure, not after a 60 s wait.
    const save = await page.evaluate(async () => {
      const started = Date.now();
      try {
        await post('document:save', {});
        return { rejected: false, ms: Date.now() - started, error: '' };
      } catch (e) {
        return { rejected: true, ms: Date.now() - started, error: String((e as Error).message || e) };
      }
    });
    expect(save.rejected).toBe(true);
    expect(save.error).toMatch(/failed to open/i);
    expect(save.ms).toBeLessThan(10_000);

    // The fixture saw the SDK error and the frame rejection.
    expect((await l0.ascErrors()).map((e) => e.id)).toContain('-82');
    expect((await l0.frameErrors()).some((e) => /Document conversion failed/.test(e.message))).toBe(true);
  });
});
