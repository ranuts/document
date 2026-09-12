import { expect, test } from './lib/l0';

declare const XLSX: any;

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
 *
 * Two shapes of unusable input, because they fail in different places. Garbage
 * bytes are rejected by the signature sniff before anything is unpacked. A
 * truncated file is the one a user actually produces -- an upload that was
 * interrupted, a file copied off a full disk -- and it gets further in: the
 * local header says a real workbook, and only the central directory at the end
 * turns out not to be there. Whichever way it fails, the user must be told and
 * the editor must stay usable.
 */
test.describe('open failure surfacing (real editor)', () => {
  test.describe.configure({ timeout: 120_000 });

  const UNUSABLE = [
    {
      label: 'garbage bytes',
      name: 'junk.xlsx',
      // No signature at all: rejected before anything is unpacked.
      make: () => new TextEncoder().encode('this is not a workbook at all, just text').buffer,
    },
    {
      label: 'a workbook cut in half',
      name: 'truncated.xlsx',
      // A real xlsx with its second half missing, which is what an
      // interrupted upload leaves behind: the zip's local header is intact
      // and its central directory is gone.
      make: () => {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.aoa_to_sheet([
            ['k', 'v'],
            ['truncated', 1],
          ]),
          'S',
        );
        const whole = new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }));
        return whole.slice(0, Math.floor(whole.length / 2)).buffer;
      },
    },
  ] as const;

  for (const { label, name, make } of UNUSABLE) {
    test(`${label} named .xlsx raises asc_onError -82, ends the load mask and fails saves fast`, async ({
      page,
      l0,
    }) => {
      l0.expectAscError(-82);
      l0.allowFrameError(/Document conversion failed/);
      // Firefox additionally prints the bare rejected Error object as "Error".
      l0.allowConsole(
        /Document conversion failed|Conversion failed with code|open conversion failed|changesError|^Error$/,
      );

      await page.goto('/embed-demo.html');
      await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });

      await page.evaluate(
        async ({ fileName, source }) => {
          const buffer = new Function(`return (${source})()`)() as ArrayBuffer;
          await post('document:open-buffer', { fileName, buffer, readonly: false });
        },
        { fileName: name, source: make.toString() },
      );

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
  }
});
