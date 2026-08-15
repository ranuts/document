import { expect, test } from '@playwright/test';

// TEMPORARY investigation harness for the image-save hang found on
// production (docs/explorations/2026-08-15-image-save-hang-and-verification-gap.md).
// Not a permanent guard yet -- once the root cause is fixed this becomes a
// proper regression test in embed-regression.spec.ts.

declare function post(type: string, payload?: Record<string, unknown>): Promise<any>;

test.describe('image save investigation', () => {
  test.describe.configure({ timeout: 180_000 });

  test('save a docx that contains a URL-inserted image', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', (m) => {
      const line = `[page ${m.type()}] ${m.text().slice(0, 220)}`;
      logs.push(line);
      // Stream immediately: if the main thread blocks, a summary printed at
      // the end of the test would never run.
      console.log(line);
    });
    page.on('pageerror', (e) => console.log(`[pageerror] ${String(e).slice(0, 300)}`));

    await page.goto('/embed-demo.html');
    await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });

    // Minimal docx (same builder as the embed-regression suite)
    await page.evaluate(async () => {
      const crcTable = (() => {
        const t = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
          let c = n;
          for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
          t[n] = c >>> 0;
        }
        return t;
      })();
      const crc32 = (b: Uint8Array) => {
        let c = 0xffffffff;
        for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 0xff] ^ (c >>> 8);
        return (c ^ 0xffffffff) >>> 0;
      };
      const enc = new TextEncoder();
      const makeZip = (entries: Array<{ name: string; text: string }>) => {
        const ch: number[] = [];
        const cen: number[] = [];
        const u16 = (a: number[], v: number) => a.push(v & 0xff, (v >> 8) & 0xff);
        const u32 = (a: number[], v: number) => a.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff);
        for (const { name, text } of entries) {
          const nb = enc.encode(name);
          const d = enc.encode(text);
          const crc = crc32(d);
          const off = ch.length;
          u32(ch, 0x04034b50);
          u16(ch, 20);
          u16(ch, 0);
          u16(ch, 0);
          u32(ch, 0);
          u32(ch, crc);
          u32(ch, d.length);
          u32(ch, d.length);
          u16(ch, nb.length);
          u16(ch, 0);
          ch.push(...nb, ...d);
          u32(cen, 0x02014b50);
          u16(cen, 20);
          u16(cen, 20);
          u16(cen, 0);
          u16(cen, 0);
          u32(cen, 0);
          u32(cen, crc);
          u32(cen, d.length);
          u32(cen, d.length);
          u16(cen, nb.length);
          u16(cen, 0);
          u16(cen, 0);
          u16(cen, 0);
          u16(cen, 0);
          u32(cen, 0);
          u32(cen, off);
          cen.push(...nb);
        }
        const co = ch.length;
        ch.push(...cen);
        u32(ch, 0x06054b50);
        u16(ch, 0);
        u16(ch, 0);
        u16(ch, entries.length);
        u16(ch, entries.length);
        u32(ch, cen.length);
        u32(ch, co);
        u16(ch, 0);
        return new Uint8Array(ch);
      };
      const docx = makeZip([
        {
          name: '[Content_Types].xml',
          text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
        },
        {
          name: '_rels/.rels',
          text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
        },
        {
          name: 'word/document.xml',
          text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>image save repro</w:t></w:r></w:p></w:body></w:document>',
        },
      ]);
      await post('document:open-buffer', { fileName: 'imgsave.docx', buffer: docx.buffer, readonly: false });
    });

    // Insert an image by URL, pointing at an asset the preview server serves.
    const inserted = await page.evaluate(async () => {
      const findApi = (): any => {
        const visit = (win: Window): any => {
          try {
            const scope = win as any;
            const api = scope.Asc?.editor || scope.editor;
            if (api && typeof api.AddImageUrlAction === 'function') return api;
          } catch {
            /* cross-origin */
          }
          for (let i = 0; i < win.frames.length; i++) {
            const found = visit(win.frames[i]);
            if (found) return found;
          }
          return null;
        };
        return visit(window);
      };
      const start = Date.now();
      let api = findApi();
      while (!api && Date.now() - start < 60_000) {
        await new Promise((r) => setTimeout(r, 500));
        api = findApi();
      }
      if (!api) return { ok: false, reason: 'editor api not found' };
      while (!api.isDocumentLoadComplete && Date.now() - start < 60_000) {
        await new Promise((r) => setTimeout(r, 500));
      }
      console.log('MARK 1: doc loaded, inserting image');
      api.AddImageUrlAction(`${location.origin}/img/64.png`);
      await new Promise((r) => setTimeout(r, 8000));
      console.log('MARK 2: image insert settled');
      return { ok: true };
    });
    expect(inserted.ok).toBe(true);

    // Instrument every stage of the save pipeline inside the editor iframe,
    // so the streamed console output shows the last stage reached before the
    // main thread blocks.
    const buttonStates = await page.evaluate(() => {
      const findEditorWin = (): any => {
        const visit = (win: Window): any => {
          try {
            const scope = win as any;
            if (scope.AscCommon && scope.AscCommon.x2t) return win;
          } catch {
            /* cross-origin */
          }
          for (let i = 0; i < win.frames.length; i++) {
            const found = visit(win.frames[i]);
            if (found) return found;
          }
          return null;
        };
        return visit(window);
      };
      const ed = findEditorWin();
      if (!ed) return { instrumented: false };
      const x2t = ed.AscCommon.x2t;
      const proto = Object.getPrototypeOf(x2t);
      for (const name of ['convertFromBin', 'writeMediaFiles', 'fetchFonts', 'executeConversion', '_convertDocument']) {
        const orig = proto[name];
        if (typeof orig !== 'function' || orig.__wrapped) continue;
        proto[name] = function (...args: any[]) {
          try {
            const extra =
              name === 'convertFromBin' || name === '_convertDocument'
                ? ' medias=' + JSON.stringify(Object.keys(args[0]?.medias || {}))
                : name === 'writeMediaFiles'
                  ? ' files=' + JSON.stringify(Object.keys(args[0] || {}))
                  : '';
            console.log('X2T STAGE: ' + name + extra);
          } catch {
            console.log('X2T STAGE: ' + name);
          }
          const out = orig.apply(this, args);
          if (out && typeof out.then === 'function') {
            out.then(
              () => console.log('X2T STAGE DONE: ' + name),
              (e: any) => console.log('X2T STAGE FAIL: ' + name + ' ' + String(e?.message || e)),
            );
          } else {
            console.log('X2T STAGE SYNC-DONE: ' + name);
          }
          return out;
        };
        proto[name].__wrapped = true;
      }
      // Also mark entry into the SDK-side serialization
      const api = ed.Asc?.editor || ed.editor;
      const dl = api._downloadAsFromLocal;
      if (typeof dl === 'function' && !(dl as any).__wrapped) {
        api._downloadAsFromLocal = function (...args: any[]) {
          console.log('X2T STAGE: _downloadAsFromLocal (SDK serialization starts)');
          const out = dl.apply(this, args);
          console.log('X2T STAGE SYNC-DONE: _downloadAsFromLocal');
          return out;
        };
        (api._downloadAsFromLocal as any).__wrapped = true;
      }
      // Save-button lifecycle (user question): is the toolbar Save enabled
      // now that the document contains an unsaved image insert?
      const btn = ed.document.querySelector('#id-toolbar-btn-save, [data-hint-title="S"], .btn-save');
      const saveBtnDisabled = btn ? btn.classList.contains('disabled') || (btn as any).disabled : 'button not found';
      return { instrumented: true, saveBtnDisabled: String(saveBtnDisabled) };
    });
    console.log('INSTRUMENTED:', JSON.stringify(buttonStates));

    await page.evaluate(() => {
      const w = window as any;
      w.__saveState = { started: Date.now(), done: null };
      console.log('MARK 3: about to call document:save');
      post('document:save', { targetExt: 'DOCX' })
        .then((r: any) => {
          w.__saveState.done = { ok: true, name: r.file.name, size: r.file.size, ms: Date.now() - w.__saveState.started };
          console.log('MARK 4: save resolved ' + JSON.stringify(w.__saveState.done));
        })
        .catch((e: any) => {
          w.__saveState.done = { ok: false, error: String(e?.message || e), ms: Date.now() - w.__saveState.started };
          console.log('MARK 4: save rejected ' + JSON.stringify(w.__saveState.done));
        });
    });

    // Probe every 5s with an independent short evaluate.
    let threadAliveCount = 0;
    let threadBlockedCount = 0;
    let finalState: any = null;
    for (let i = 0; i < 20; i++) {
      try {
        finalState = await page.evaluate(() => (window as any).__saveState?.done ?? 'pending', { timeout: 4000 } as any);
        threadAliveCount++;
        if (finalState && finalState !== 'pending') break;
      } catch {
        threadBlockedCount++;
        console.log(`PROBE ${i}: main thread BLOCKED (evaluate timed out)`);
      }
      await new Promise((r) => setTimeout(r, 5000));
    }

    console.log('DIAGNOSIS:', JSON.stringify({ threadAliveCount, threadBlockedCount, finalState }));
    console.log('PAGE LOGS (last 40):\n' + logs.slice(-40).join('\n'));
    expect(true).toBe(true);
  });
});
