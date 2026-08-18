import { expect, test } from './lib/l0';

declare function post(type: string, payload?: Record<string, unknown>): Promise<any>;

/**
 * Environment-class open failures must be retried, not reported (GitHub #144:
 * the same .docx opens in a freshly started browser and fails with
 * "code -82" in the one that has been running all day).
 *
 * The vendor's open path awaits AscCommon.x2t.convertToBin with no catch, and
 * everything it touches on the way -- the font system, the x2t module, the
 * image pipeline -- is initialised concurrently with the document load. When
 * one of those is not up yet the conversion rejects with a TypeError that
 * x2t_helper rewraps as "Document conversion failed: ...", which reaches the
 * user as -82 ("the file is corrupted or unsupported") even though the file is
 * fine. lib/onlyoffice-editor.ts classifies such a rejection as environment
 * (classifyOpenFailure) and rebuilds the editor once with the same bytes.
 *
 * The fault is injected at exactly the point the real race breaks: the first
 * convertToBin call of the session rejects with the boot-state TypeError, the
 * retried open runs for real.
 */
const FAULT_KEY = '__oo_x2t_open_fault__';

test.describe('open retry after an environment failure (real editor)', () => {
  test.describe.configure({ timeout: 180_000 });

  test('a boot-state conversion failure is retried and the document opens', async ({ page, l0 }) => {
    // The injected rejection travels the same route as the real one.
    l0.allowFrameError(/Document conversion failed/);
    l0.allowConsole(/Document conversion failed|open conversion failed|retrying the open|fetchFonts called before/);

    await page.addInitScript(
      ([key]) => {
        // Arm once, in the top frame only: the editor iframe is torn down and
        // rebuilt by the retry, and re-arming there would fault forever.
        if (window.top === window) sessionStorage.setItem(key, 'armed');

        type X2T = {
          convertToBin?: (...args: unknown[]) => unknown;
          __faultPatched?: boolean;
        };
        const patch = (): boolean => {
          const x2t = (window as unknown as { AscCommon?: { x2t?: X2T } }).AscCommon?.x2t;
          if (!x2t || typeof x2t.convertToBin !== 'function' || x2t.__faultPatched) return false;
          const original = x2t.convertToBin.bind(x2t);
          x2t.__faultPatched = true;
          x2t.convertToBin = (...args: unknown[]) => {
            if (sessionStorage.getItem(key) === 'armed') {
              sessionStorage.setItem(key, 'fired');
              // Verbatim shape of the real failure: the vendor's fetchFonts
              // dereferencing g_font_loader.fontFiles[index].Id too early.
              return Promise.reject(
                new Error("Document conversion failed: TypeError: Cannot read properties of undefined (reading 'Id')"),
              );
            }
            return original(...args);
          };
          return true;
        };
        if (!patch()) {
          const timer = setInterval(() => {
            if (patch()) clearInterval(timer);
          }, 10);
          setTimeout(() => clearInterval(timer), 120_000);
        }
      },
      [FAULT_KEY],
    );

    // The app's own trace of the recovery, asserted below: a test that opened
    // the document without ever going through the retry would otherwise look
    // exactly the same.
    const appLog: string[] = [];
    page.on('console', (msg) => appLog.push(msg.text()));

    await page.goto('/embed-demo.html');
    await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });

    const result = await page.evaluate(async () => {
      const XLSX = (window as unknown as { XLSX: any }).XLSX;
      const sheet = XLSX.utils.aoa_to_sheet([
        ['retry', 'after', 'fault'],
        [1, 2, 3],
      ]);
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, 'Sheet1');
      // SheetJS answers with an ArrayBuffer in some builds and a Uint8Array
      // in others; the embed API wants the ArrayBuffer.
      const written = XLSX.write(book, { bookType: 'xlsx', type: 'array' });
      const buffer: ArrayBuffer = written instanceof ArrayBuffer ? written : written.buffer;
      await post('document:open-buffer', {
        fileName: 'retry-after-fault.xlsx',
        buffer,
        readonly: false,
      });

      // The real signal: the rebuilt editor finished loading the document.
      const findApi = (win: Window): any => {
        try {
          const api = (win as any).Asc?.editor;
          if (api && 'isDocumentLoadComplete' in api) return api;
        } catch {
          /* cross-origin */
        }
        for (let i = 0; i < win.frames.length; i++) {
          const found = findApi(win.frames[i]);
          if (found) return found;
        }
        return null;
      };
      const deadline = Date.now() + 120_000;
      let loaded = false;
      while (Date.now() < deadline) {
        if (findApi(window)?.isDocumentLoadComplete) {
          loaded = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      return { loaded, fault: sessionStorage.getItem('__oo_x2t_open_fault__') };
    });

    // The fault really fired (a test that silently stopped injecting would
    // otherwise pass forever) and the retry opened the document anyway.
    expect(result.fault).toBe('fired');
    expect(result.loaded).toBe(true);
    expect(appLog.some((line) => /open conversion failed/.test(line))).toBe(true);
    expect(appLog.some((line) => /retrying the open once after an environment failure/.test(line))).toBe(true);

    // No open-error dialog and no -82 reached the user.
    const editorFrame = page.frameLocator('iframe').frameLocator('iframe[name="frameEditor"]');
    await expect(editorFrame.locator('.asc-window.modal.alert')).toHaveCount(0);
    expect((await l0.ascErrors()).map((e) => e.id)).not.toContain('-82');

    // The recovered document is a working editor, not a husk: it still saves.
    const saved = await page.evaluate(async () => {
      const saved = await post('document:save', { targetExt: 'XLSX' });
      return { name: saved.file.name as string, size: saved.file.size as number };
    });
    expect(saved.name).toBe('retry-after-fault.xlsx');
    expect(saved.size).toBeGreaterThan(0);
  });

  test('waiting for the font system costs a fraction of a second, not seconds', async ({ page }) => {
    // awaitFontSystem orders the conversion behind the font system instead of
    // letting it walk a half-built one. What that ordering costs is measured
    // here rather than assumed: a warm local run waits ~200 ms (four poll
    // intervals), a cold one waits zero because the fonts are ready about a
    // second before the x2t module even loads. The bound is what matters --
    // an environment where fonts systematically lose the race would add
    // seconds to every open, and this test is how that shows up.
    await page.goto('/embed-demo.html');
    await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });

    const waited = await page.evaluate(async () => {
      const XLSX = (window as unknown as { XLSX: any }).XLSX;
      const sheet = XLSX.utils.aoa_to_sheet([
        ['font', 'wait'],
        [1, 2],
      ]);
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, 'Sheet1');
      const written = XLSX.write(book, { bookType: 'xlsx', type: 'array' });
      const buffer: ArrayBuffer = written instanceof ArrayBuffer ? written : written.buffer;
      await post('document:open-buffer', { fileName: 'font-wait.xlsx', buffer, readonly: false });

      const findFrame = (win: Window): Window | null => {
        try {
          const api = (win as any).Asc?.editor;
          if (api && 'isDocumentLoadComplete' in api) return win;
        } catch {
          /* cross-origin */
        }
        for (let i = 0; i < win.frames.length; i++) {
          const found = findFrame(win.frames[i]);
          if (found) return found;
        }
        return null;
      };
      const deadline = Date.now() + 120_000;
      while (Date.now() < deadline) {
        const frame = findFrame(window) as (Window & { __ooFontWaitMs?: number; Asc?: any }) | null;
        if (frame?.Asc?.editor?.isDocumentLoadComplete) return frame.__ooFontWaitMs ?? null;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      return null;
    });

    // null would mean fetchFonts never ran at all, which is itself a change
    // worth failing on: the conversion is supposed to go through the guard.
    expect(waited).not.toBeNull();
    expect(waited).toBeLessThan(2_000);
  });
});
