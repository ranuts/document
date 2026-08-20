import { expect, test } from './lib/l0';

declare function post(type: string, payload?: Record<string, unknown>): Promise<any>;

/**
 * What an open costs in memory, held down where it is cheap to hold down.
 *
 * x2t declares a 283 MB initial heap (see lib/onlyoffice/wasm-memory.ts). On
 * top of that, our x2t_helper patch used to inflate the 9.4 MB `x2t.wasm.gz`
 * into a 40.2 MB ArrayBuffer and hand emscripten the bytes -- so at the moment
 * WebAssembly asked the browser for the heap, the renderer was also holding
 * that buffer and compiling 40 MB of code. That moment is exactly the one that
 * fails on a browser short of memory (GitHub #144).
 *
 * The module is now compiled straight off the network
 * (`Module.instantiateWasm` + `instantiateStreaming` over a
 * `DecompressionStream`), so the inflated copy never exists at all. What this
 * pins is that the streaming path is the one actually taken -- silently
 * falling back to the buffered path would put the 40 MB back into the peak and
 * nothing else would notice.
 *
 * The buffered fallback (engines without streaming instantiation) and the
 * guard that releases its buffer afterwards are unit-tested instead:
 * test/unit/onlyoffice-wasm-memory.test.ts.
 */
const openWorkbook = async (fileName: string) => {
  const XLSX = (window as unknown as { XLSX: any }).XLSX;
  const sheet = XLSX.utils.aoa_to_sheet([
    ['wasm', 'memory'],
    [1, 2],
  ]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Sheet1');
  const written = XLSX.write(book, { bookType: 'xlsx', type: 'array' });
  const buffer: ArrayBuffer = written instanceof ArrayBuffer ? written : written.buffer;
  await post('document:open-buffer', { fileName, buffer, readonly: false });
};

test.describe('wasm memory held by an open document (real editor)', () => {
  test.describe.configure({ timeout: 180_000 });

  test('the x2t module is compiled off the network, so the inflated 40 MB never exists', async ({ page }) => {
    await page.goto('/embed-demo.html');
    await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });
    await page.evaluate(openWorkbook, 'streamed.xlsx');

    const state = await expect
      .poll(
        async () =>
          await page.evaluate(() => {
            const find = (
              win: Window,
            ): { streaming: boolean; buffered: boolean; ran: boolean; heapMb: number } | null => {
              try {
                const module = (
                  win as unknown as {
                    Module?: {
                      wasmBinary?: unknown;
                      instantiateWasm?: unknown;
                      calledRun?: boolean;
                      HEAPU8?: Uint8Array;
                    };
                  }
                ).Module;
                if (module && 'calledRun' in module) {
                  return {
                    streaming: typeof module.instantiateWasm === 'function',
                    buffered: Boolean(module.wasmBinary),
                    ran: Boolean(module.calledRun),
                    heapMb: module.HEAPU8 ? Math.round(module.HEAPU8.buffer.byteLength / (1024 * 1024)) : 0,
                  };
                }
              } catch {
                /* cross-origin */
              }
              for (let i = 0; i < win.frames.length; i++) {
                const found = find(win.frames[i]);
                if (found) return found;
              }
              return null;
            };
            return find(window);
          }),
        { timeout: 120_000 },
      )
      .toMatchObject({ streaming: true, buffered: false, ran: true })
      .then(() =>
        page.evaluate(() => {
          const find = (win: Window): number => {
            try {
              const module = (win as unknown as { Module?: { HEAPU8?: Uint8Array } }).Module;
              if (module?.HEAPU8) return Math.round(module.HEAPU8.buffer.byteLength / (1024 * 1024));
            } catch {
              /* cross-origin */
            }
            for (let i = 0; i < win.frames.length; i++) {
              const found = find(win.frames[i]);
              if (found) return found;
            }
            return 0;
          };
          return find(window);
        }),
      );

    // The heap itself is the vendor's to declare (283 MB initial, growing with
    // the document). Bounded loosely, only to catch a vendor build that starts
    // asking for something wildly different -- measured 340 MB after an open,
    // 408 MB after saving a 20k-row workbook or exporting one to PDF.
    expect(state).toBeGreaterThan(200);
    expect(state).toBeLessThan(1024);
  });
});
