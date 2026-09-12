import { expect, test } from './lib/l0';

/**
 * Where an open's memory is held, and for how long.
 *
 * x2t declares a 283 MB initial heap and measures ~340 MB once a document has
 * been through it. It used to be held in the editor frame, for the life of the
 * frame: x2t.js is an unwrapped classic script, so `wasmMemory` / `HEAPU8` are
 * properties of the frame's global and nothing drops them.
 * `X2TConverter.prototype.destroy` exists, is never called, and clears a JS
 * reference anyway.
 *
 * Guard 14 moved conversion into a worker, so the heap lives somewhere we can
 * terminate. What this pins is that arrangement, end to end:
 *
 *  - the editor frame never instantiates x2t at all -- no `Module` in it after
 *    an open and a save, which is the whole point;
 *  - the worker compiles the module straight off the network
 *    (`Module.instantiateWasm` + `instantiateStreaming`), so the 42 MB never
 *    exists as one buffer at the moment WebAssembly asks for the 283 MB heap.
 *    That moment is what fails on a browser short of memory (GitHub #144), and
 *    silently falling back to the buffered path would put it back with nothing
 *    else noticing;
 *  - the worker goes away once it has been idle, which is what hands the heap
 *    back for the rest of the editing session.
 *
 * The buffered fallback (engines without streaming instantiation) and the guard
 * that releases its buffer are unit-tested instead:
 * test/unit/onlyoffice-wasm-memory.test.ts.
 */
const WORKER_URL_PART = 'x2t.worker.js';

/** How long guard 14 leaves an idle worker before terminating it. */
const IDLE_TERMINATE_MS = 30_000;

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

/** Is there an x2t module anywhere in the page's frames? There must not be. */
const moduleInAnyFrame = () => {
  return Boolean(
    window.__ooFrames.find((win) => {
      const module = (win as unknown as { Module?: { calledRun?: boolean } }).Module;
      return module && 'calledRun' in module;
    }),
  );
};

test.describe('wasm memory held by an open document (real editor)', () => {
  test.describe.configure({ timeout: 240_000 });

  test('x2t runs in the worker, streamed, and is gone once it goes quiet', async ({ page }) => {
    await page.goto('/embed-demo.html');
    await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });
    await page.evaluate(openWorkbook, 'streamed.xlsx');
    await page.evaluate(async () => {
      await post('document:save', {});
    });

    const x2tWorker = () => page.workers().find((worker) => worker.url().includes(WORKER_URL_PART));
    await expect.poll(() => Boolean(x2tWorker()), { timeout: 60_000 }).toBe(true);

    const state = await x2tWorker()!.evaluate(() => {
      const module = (self as unknown as { Module?: Record<string, unknown> }).Module;
      const heap = module?.HEAPU8 as Uint8Array | undefined;
      return {
        streaming: typeof module?.instantiateWasm === 'function',
        buffered: Boolean(module?.wasmBinary),
        ran: Boolean(module?.calledRun),
        heapMb: heap ? Math.round(heap.buffer.byteLength / (1024 * 1024)) : 0,
      };
    });

    expect(state).toMatchObject({ streaming: true, buffered: false, ran: true });
    // The heap is the vendor's to declare (283 MB initial, growing with the
    // document). Bounded loosely, only to catch a vendor build that starts
    // asking for something wildly different -- measured 340 MB after an open.
    expect(state.heapMb).toBeGreaterThan(200);
    expect(state.heapMb).toBeLessThan(1024);

    // And the editor frame itself never paid for any of it.
    expect(await page.evaluate(moduleInAnyFrame), 'no x2t module in any frame').toBe(false);

    // Left alone, the worker is terminated and the heap goes back. This is the
    // difference the whole change exists to make: before it, the same 340 MB
    // stayed resident for as long as the document was open.
    await expect
      .poll(() => Boolean(x2tWorker()), { timeout: IDLE_TERMINATE_MS + 30_000, intervals: [2_000] })
      .toBe(false);
  });
});
