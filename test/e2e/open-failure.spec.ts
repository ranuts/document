import { buildEncryptedOoxml } from './lib/cfb';
import { buildXlsx, toBase64 } from './lib/ooxml';
import { expect, test } from './lib/l0';

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
 * Four shapes of unusable input, because they fail in different places.
 * Garbage bytes are rejected before anything is unpacked. A truncated file --
 * an upload that was interrupted, a file copied off a full disk -- gets
 * further: the local header says a real workbook, and only the central
 * directory at the end turns out not to be there. An encrypted workbook is not
 * a zip at all: Office wraps the whole package in the pre-2007 OLE2 container,
 * and nothing outside the file says so. The fourth is handed to a different
 * vendor app altogether: the pdf editor reaches the same visible outcome by a
 * different route, reporting through asc_onError alone without the frame
 * rejection the other three produce. All four are files a user will genuinely
 * hand us, and whichever way each fails, the user must be told and the editor
 * must stay usable.
 */
test.describe('open failure surfacing (real editor)', () => {
  test.describe.configure({ timeout: 120_000 });

  const UNUSABLE = [
    {
      label: 'garbage bytes',
      name: 'junk.xlsx',
      // No signature at all: rejected before anything is unpacked.
      bytes: () => new TextEncoder().encode('this is not a workbook at all, just text'),
    },
    {
      label: 'a workbook cut in half',
      name: 'truncated.xlsx',
      // What an interrupted upload leaves behind: the zip's local header is
      // intact and its central directory is gone.
      bytes: () => {
        const whole = buildXlsx({
          rows: [
            ['k', 'v'],
            ['truncated', 1],
          ],
        });
        return whole.slice(0, Math.floor(whole.length / 2));
      },
    },
    {
      label: 'a password-protected workbook',
      name: 'locked.xlsx',
      // Still named .xlsx, still handed over by a user who expects it to
      // open. We have no key and never ask for one, so this must fail the
      // same visible way rather than stall.
      bytes: () => buildEncryptedOoxml(),
    },
    {
      label: 'a PDF that is only a header',
      name: 'junk.pdf',
      // Routed to the pdf editor instead, which is a separate vendor app with
      // its own load mask and its own error path -- worth its own case
      // because none of the guarding above runs in it.
      bytes: () => new TextEncoder().encode('%PDF-1.4 and then nothing that parses at all'),
      // It reports through asc_onError only; no rejection escapes the frame.
      frameRejection: false,
    },
  ] as const;

  for (const { label, name, bytes, ...rest } of UNUSABLE) {
    const frameRejection = (rest as { frameRejection?: boolean }).frameRejection !== false;
    test(`${label} raises asc_onError -82, ends the load mask and fails saves fast`, async ({ page, l0 }) => {
      l0.expectAscError(-82);
      if (frameRejection) l0.allowFrameError(/Document conversion failed/);
      // Firefox additionally prints the bare rejected Error object as "Error".
      l0.allowConsole(
        /Document conversion failed|Conversion failed with code|open conversion failed|changesError|^Error$/,
      );

      await page.goto('/embed-demo.html');
      await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });

      await page.evaluate(
        async ({ fileName, b64 }) => {
          const bin = atob(b64);
          const buffer = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) buffer[i] = bin.charCodeAt(i);
          await post('document:open-buffer', { fileName, buffer: buffer.buffer, readonly: false });
        },
        { fileName: name, b64: toBase64(bytes()) },
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

      // The fixture saw the SDK error, and the frame rejection where the app
      // produces one.
      expect((await l0.ascErrors()).map((e) => e.id)).toContain('-82');
      expect((await l0.frameErrors()).some((e) => /Document conversion failed/.test(e.message))).toBe(frameRejection);
    });
  }
});
