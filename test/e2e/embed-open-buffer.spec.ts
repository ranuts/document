import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

// ---------------------------------------------------------------------------
// Embed open-buffer E2E: the full document-open pipeline.
//
// Regression coverage for issue #113: a host posts document:open-buffer with a
// base64 docx, the app converts it with x2t (WASM) and feeds the resulting
// Editor.bin to asc_openDocument. The bin MUST be sent verbatim as a string
// (x2t emits an ASCII container "DOCY;v5;<len>;<base64>") -- the SDK sniffs
// string bufs by literally checking the first characters against
// DOCY/XLSY/PPTY, with no base64 decoding. An earlier fix base64-wrapped the
// bin, which this sniff rejects, and the editor hung at "Loading document"
// forever with no error. Unit tests missed it because they asserted the wrong
// expected format, so this spec exercises the real editor end to end.
//
// x2t WASM init plus editor boot takes a while, hence the generous timeout.
// ---------------------------------------------------------------------------

const FIXTURE_BASE64 = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'minimal.docx')).toString(
  'base64',
);

test.describe('document:open-buffer full pipeline', () => {
  test('opens a base64 docx through x2t and reaches onDocumentReady', async ({ page }) => {
    test.setTimeout(120_000);

    await page.addInitScript(() => {
      const w = window as any;
      w.__events = [] as string[];
      w.__ascOpenBufHead = null;
      window.addEventListener(
        'message',
        (e: MessageEvent) => {
          const d = e.data as { type?: string; event?: string } | undefined;
          if (d && typeof d === 'object' && (d.type || d.event)) w.__events.push(d.type || d.event);
        },
        true,
      );
      // Capture the buf actually handed to asc_openDocument so a format
      // regression fails loudly instead of timing out.
      const hook = setInterval(() => {
        const ed = w.editor;
        if (ed && typeof ed.sendCommand === 'function' && !ed.__e2eHooked) {
          ed.__e2eHooked = true;
          const orig = ed.sendCommand.bind(ed);
          ed.sendCommand = (cmd: { command?: string; data?: { buf?: unknown } }) => {
            if (cmd?.command === 'asc_openDocument') {
              const buf = cmd.data?.buf;
              w.__ascOpenBufHead = typeof buf === 'string' ? buf.slice(0, 8) : Object.prototype.toString.call(buf);
              clearInterval(hook);
            }
            return orig(cmd);
          };
        }
      }, 50);
    });

    await page.goto('/?embed=1');

    await page.evaluate(
      ([b64]) => {
        window.postMessage(
          { type: 'document:open-buffer', id: 'e2e-open-buffer', payload: { fileName: 'minimal.docx', base64: b64 } },
          '*',
        );
      },
      [FIXTURE_BASE64],
    );

    // document:opened means the embed API accepted the file and created the
    // editor; onDocumentReady means the SDK actually parsed and rendered it.
    await page.waitForFunction(() => (window as any).__events.includes('document:opened'), null, { timeout: 90_000 });
    await page.waitForFunction(() => (window as any).__events.includes('onDocumentReady'), null, { timeout: 90_000 });

    // The buf must be the Editor.bin text container verbatim, not base64 of it.
    const bufHead = await page.evaluate(() => (window as any).__ascOpenBufHead as string | null);
    expect(bufHead).toBe('DOCY;v5;');
  });
});
