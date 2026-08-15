import { expect, test } from './lib/l0';

/**
 * Regression suite driving the real editor (OnlyOffice Personal vendor)
 * through the embed postMessage API via embed-demo.html -- the exact
 * scenarios that were verified manually during the v9 migration and its
 * issue sweep (docs/explorations/2026-08-11-v9-vendor-swap-*.md and
 * 2026-08-12-v9-pure-ui-and-issue-regression-sweep.md).
 *
 * The demo page provides two globals the tests lean on:
 *   - post(type, payload): sends an embed-API message to the editor iframe
 *     and resolves with the reply payload (45 s internal timeout);
 *   - XLSX (SheetJS): used to build and parse workbook fixtures in-page, so
 *     no binary fixture files need to live in the repo.
 */

declare const XLSX: any;
declare function post(type: string, payload?: Record<string, unknown>): Promise<any>;

test.describe('embed regression (real editor)', () => {
  // Each test boots the real editor iframe and loads the ~9 MB x2t WASM for
  // the save round-trip -- far heavier than the smoke tests sharing this
  // suite, so give them their own generous timeout.
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async ({ page }) => {
    await page.goto('/embed-demo.html');
    await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });
  });

  test('opens a multi-sheet workbook from a buffer and saves it back intact (#113, #31)', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([
          ['alpha', 1],
          ['beta', 2],
        ]),
        'First',
      );
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['gamma', 3]]), 'Second');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['delta', 4]]), 'Third');
      const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

      await post('document:open-buffer', {
        fileName: 'multi-sheet.xlsx',
        buffer: new Uint8Array(data).buffer,
        readonly: false,
      });
      const saved = await post('document:save', {});

      const parsed = XLSX.read(new Uint8Array(await saved.file.arrayBuffer()), { type: 'array' });
      const sheets: Record<string, string> = {};
      for (const name of parsed.SheetNames) {
        sheets[name] = XLSX.utils.sheet_to_csv(parsed.Sheets[name]).trim();
      }
      return { fileName: saved.file.name as string, sheets };
    });

    expect(result.fileName).toBe('multi-sheet.xlsx');
    expect(Object.keys(result.sheets)).toEqual(['First', 'Second', 'Third']);
    expect(result.sheets['First']).toBe('alpha,1\nbeta,2');
    expect(result.sheets['Second']).toBe('gamma,3');
    expect(result.sheets['Third']).toBe('delta,4');
  });

  test('exports a spreadsheet as PDF through the canvas render pipeline (#28)', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['pdf export test', 42]]), 'Sheet1');
      const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

      await post('document:open-buffer', {
        fileName: 'pdf-source.xlsx',
        buffer: new Uint8Array(data).buffer,
        readonly: false,
      });
      const saved = await post('document:save', { targetExt: 'PDF' });

      const bytes = new Uint8Array(await saved.file.arrayBuffer());
      const magic = new TextDecoder().decode(bytes.slice(0, 5));
      return { fileName: saved.file.name as string, size: bytes.byteLength, magic };
    });

    expect(result.fileName).toBe('pdf-source.pdf');
    expect(result.magic).toBe('%PDF-');
    expect(result.size).toBeGreaterThan(500);
  });

  test('opens a CSV and saves it back as CSV with the data intact (#13, #33)', async ({ page }) => {
    const original = 'name,score\nalice,90\nbob,85';
    const result = await page.evaluate(async (csvText) => {
      await post('document:open-buffer', {
        fileName: 'roundtrip.csv',
        buffer: new TextEncoder().encode(csvText).buffer,
        mimeType: 'text/csv',
        readonly: false,
      });
      const saved = await post('document:save', { targetExt: 'CSV' });
      return { fileName: saved.file.name as string, type: saved.file.type as string, text: await saved.file.text() };
    }, original);

    expect(result.fileName).toBe('roundtrip.csv');
    expect(result.type).toBe('text/csv');
    expect(result.text.trim()).toBe(original);
  });

  test('readonly open reports readonly state and refuses to save (#25, #87)', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['view only']]), 'Sheet1');
      const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

      const opened = await post('document:open-buffer', {
        fileName: 'readonly.xlsx',
        buffer: new Uint8Array(data).buffer,
        readonly: true,
      });
      const state = await post('document:get-state', {});
      let saveError = '';
      try {
        await post('document:save', {});
      } catch (error) {
        saveError = String((error as Error).message || error);
      }
      return { opened, state, saveError };
    });

    expect(result.opened.readonly).toBe(true);
    expect(result.state).toEqual({ readonly: true, hasDocument: true });
    expect(result.saveError).not.toBe('');
  });

  test('runtime readonly toggle locks and unlocks the live editor without a rebuild', async ({ page }) => {
    const result = await page.evaluate(async () => {
      // Read the restriction value off the live SDK instance inside the
      // (same-origin, nested) editor iframe: 0 = none, 128 = view. This
      // asserts the lock actually reached the editor, not just the
      // embed-api readonly flag.
      const readRestriction = (): number | null => {
        type SdkApi = { restrictions?: unknown; asc_setRestriction?: unknown };
        const visit = (win: Window): number | null => {
          try {
            // The vendor build has no asc_getRestriction getter, but the
            // backing `restrictions` property is not name-mangled.
            const scope = win as unknown as { Asc?: { editor?: SdkApi }; editor?: SdkApi };
            const api = scope.Asc?.editor || scope.editor;
            if (api && typeof api.asc_setRestriction === 'function' && typeof api.restrictions === 'number') {
              return api.restrictions;
            }
          } catch {
            // cross-origin frame -- skip
          }
          for (let i = 0; i < win.frames.length; i++) {
            const found = visit(win.frames[i]);
            if (found !== null) return found;
          }
          return null;
        };
        return visit(window);
      };
      const waitForRestriction = async (expected: number, timeoutMs = 30_000) => {
        const start = Date.now();
        while (readRestriction() !== expected) {
          if (Date.now() - start > timeoutMs) {
            throw new Error(`restriction did not become ${expected}, got ${readRestriction()}`);
          }
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      };

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['toggle', 1]]), 'Sheet1');
      const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

      await post('document:open-buffer', {
        fileName: 'toggle.xlsx',
        buffer: new Uint8Array(data).buffer,
        readonly: false,
      });
      await waitForRestriction(0);

      await post('document:set-readonly', { readonly: true });
      await waitForRestriction(128);
      let lockedSaveError = '';
      try {
        await post('document:save', {});
      } catch (error) {
        lockedSaveError = String((error as Error).message || error);
      }

      await post('document:set-readonly', { readonly: false });
      await waitForRestriction(0);
      const saved = await post('document:save', {});
      const parsed = XLSX.read(new Uint8Array(await saved.file.arrayBuffer()), { type: 'array' });
      const text = XLSX.utils.sheet_to_csv(parsed.Sheets[parsed.SheetNames[0]]).trim();

      return { lockedSaveError, savedFileName: saved.file.name as string, text };
    });

    expect(result.lockedSaveError).not.toBe('');
    expect(result.savedFileName).toBe('toggle.xlsx');
    expect(result.text).toBe('toggle,1');
  });

  test('opens a docx from a buffer and saves it back as docx (#113)', async ({ page }) => {
    const result = await page.evaluate(async () => {
      // Hand-build a minimal OOXML docx (stored zip, no compression) so no
      // binary fixture needs to live in the repo. Mirrors the shape that
      // triggered #113: document:open-buffer with real docx bytes.
      const crcTable = (() => {
        const table = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
          let c = n;
          for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
          table[n] = c >>> 0;
        }
        return table;
      })();
      const crc32 = (bytes: Uint8Array) => {
        let c = 0xffffffff;
        for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
        return (c ^ 0xffffffff) >>> 0;
      };
      const encoder = new TextEncoder();
      const makeZip = (entries: Array<{ name: string; text: string }>) => {
        const chunks: number[] = [];
        const central: number[] = [];
        const pushU16 = (arr: number[], v: number) => arr.push(v & 0xff, (v >> 8) & 0xff);
        const pushU32 = (arr: number[], v: number) =>
          arr.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff);
        for (const { name, text } of entries) {
          const nameBytes = encoder.encode(name);
          const data = encoder.encode(text);
          const crc = crc32(data);
          const offset = chunks.length;
          pushU32(chunks, 0x04034b50);
          pushU16(chunks, 20); // version needed
          pushU16(chunks, 0); // flags
          pushU16(chunks, 0); // method: stored
          pushU32(chunks, 0); // dos time+date
          pushU32(chunks, crc);
          pushU32(chunks, data.length);
          pushU32(chunks, data.length);
          pushU16(chunks, nameBytes.length);
          pushU16(chunks, 0); // extra length
          chunks.push(...nameBytes, ...data);

          pushU32(central, 0x02014b50);
          pushU16(central, 20); // version made by
          pushU16(central, 20);
          pushU16(central, 0);
          pushU16(central, 0);
          pushU32(central, 0);
          pushU32(central, crc);
          pushU32(central, data.length);
          pushU32(central, data.length);
          pushU16(central, nameBytes.length);
          pushU16(central, 0);
          pushU16(central, 0); // comment length
          pushU16(central, 0); // disk number
          pushU16(central, 0); // internal attrs
          pushU32(central, 0); // external attrs
          pushU32(central, offset);
          central.push(...nameBytes);
        }
        const centralOffset = chunks.length;
        chunks.push(...central);
        pushU32(chunks, 0x06054b50);
        pushU16(chunks, 0);
        pushU16(chunks, 0);
        pushU16(chunks, entries.length);
        pushU16(chunks, entries.length);
        pushU32(chunks, central.length);
        pushU32(chunks, centralOffset);
        pushU16(chunks, 0);
        return new Uint8Array(chunks);
      };

      const docx = makeZip([
        {
          name: '[Content_Types].xml',
          text:
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
            '<Default Extension="xml" ContentType="application/xml"/>' +
            '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
            '</Types>',
        },
        {
          name: '_rels/.rels',
          text:
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
            '</Relationships>',
        },
        {
          name: 'word/document.xml',
          text:
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
            '<w:body><w:p><w:r><w:t>hello from e2e</w:t></w:r></w:p></w:body></w:document>',
        },
      ]);

      const opened = await post('document:open-buffer', {
        fileName: 'buffer-open.docx',
        buffer: docx.buffer,
        readonly: false,
      });
      const state = await post('document:get-state', {});
      const saved = await post('document:save', { targetExt: 'DOCX' });
      const bytes = new Uint8Array(await saved.file.arrayBuffer());
      return {
        opened,
        state,
        savedFileName: saved.file.name as string,
        magic: Array.from(bytes.slice(0, 4)),
        size: bytes.byteLength,
      };
    });

    expect(result.opened.readonly).toBe(false);
    expect(result.state).toEqual({ readonly: false, hasDocument: true });
    expect(result.savedFileName).toBe('buffer-open.docx');
    expect(result.magic).toEqual([0x50, 0x4b, 0x03, 0x04]); // PK zip container
    expect(result.size).toBeGreaterThan(500);
  });

  test('saves a docx after inserting an image by URL, with the image bytes in the output', async ({ page }) => {
    // Guards the serverless image pipeline (prepareEditorIframe patch 4).
    // Without it the SDK serializes the raw external URL into the DOCY and
    // x2t.wasm blocks the main thread forever (the save never returns and
    // the whole tab freezes) -- see
    // docs/explorations/2026-08-15-image-save-hang-and-verification-gap.md.
    const result = await page.evaluate(async () => {
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
          text:
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
            '<Default Extension="xml" ContentType="application/xml"/>' +
            '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
            '</Types>',
        },
        {
          name: '_rels/.rels',
          text:
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
            '</Relationships>',
        },
        {
          name: 'word/document.xml',
          text:
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
            '<w:body><w:p><w:r><w:t>image save</w:t></w:r></w:p></w:body></w:document>',
        },
      ]);
      await post('document:open-buffer', { fileName: 'imgsave.docx', buffer: docx.buffer, readonly: false });

      // Locate the editor API and insert an image by URL (the flow that
      // used to freeze the tab on save).
      const findApi = (): any => {
        const visit = (win: Window): any => {
          try {
            const scope = win as any;
            const api = scope.Asc?.editor || scope.editor;
            if (api && typeof api.AddImageUrlAction === 'function') return api;
          } catch {
            /* cross-origin frame */
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
      while ((!api || !api.isDocumentLoadComplete) && Date.now() - start < 60_000) {
        await new Promise((r) => setTimeout(r, 500));
        api = api || findApi();
      }
      api.AddImageUrlAction(`${location.origin}/img/64.png`);
      await new Promise((r) => setTimeout(r, 6000));

      const saved = await Promise.race([
        post('document:save', { targetExt: 'DOCX' }),
        new Promise<never>((_, rej) =>
          setTimeout(
            () => rej(new Error('image save timed out (the historical symptom was a permanent hang)')),
            60_000,
          ),
        ),
      ]);
      const bytes = new Uint8Array(await (saved as any).file.arrayBuffer());
      const dec = new TextDecoder();
      const mediaEntries: Array<{ name: string; size: number }> = [];
      for (let i = 0; i < bytes.length - 4; i++) {
        if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x01 && bytes[i + 3] === 0x02) {
          const nameLen = bytes[i + 28] | (bytes[i + 29] << 8);
          const size = bytes[i + 24] | (bytes[i + 25] << 8) | (bytes[i + 26] << 16) | (bytes[i + 27] << 24);
          const name = dec.decode(bytes.slice(i + 46, i + 46 + nameLen));
          if (/media\//i.test(name)) mediaEntries.push({ name, size });
        }
      }
      return {
        savedName: (saved as any).file.name as string,
        isZip: bytes[0] === 0x50 && bytes[1] === 0x4b,
        mediaEntries,
      };
    });

    expect(result.isZip).toBe(true);
    expect(result.savedName).toBe('imgsave.docx');
    expect(result.mediaEntries.length).toBeGreaterThan(0);
    expect(result.mediaEntries[0].size).toBeGreaterThan(100);
  });

  test('a keyboard edit lights the toolbar Save button and Ctrl+S produces the file stream', async ({ page }) => {
    // Guards the serverless save semantics (prepareEditorIframe patch 5).
    // Without them the SDK's coauthoring autosave loop "commits" every edit
    // to a nonexistent server within 2s, isDocumentCanSave flips back to
    // false, and the Save button + Ctrl+S stay permanently disabled -- the
    // user simply cannot save (the "why is Save always grey" report).
    const result = await page.evaluate(async () => {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['save', 'button']]), 'Sheet1');
      const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      await post('document:open-buffer', { fileName: 'savebtn.xlsx', buffer: new Uint8Array(data).buffer, readonly: false });

      const findEditorWin = (): any => {
        const visit = (win: Window): any => {
          try {
            const scope = win as any;
            if (scope.Asc?.editor && 'isDocumentLoadComplete' in scope.Asc.editor) return win;
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
      let ed = findEditorWin();
      while ((!ed || !ed.Asc.editor.isDocumentLoadComplete) && Date.now() - start < 60_000) {
        await new Promise((r) => setTimeout(r, 500));
        ed = ed || findEditorWin();
      }
      const api = ed.Asc.editor;
      const btn = ed.document.querySelector('#id-toolbar-btn-save') as HTMLElement;
      const initiallyDisabled = btn.classList.contains('disabled');

      // Watch for the save stream on every window in the chain (the vendor
      // posts it up the parent chain; where it lands depends on
      // OO_FILE_STREAM_ONLY placement).
      (window as any).__stream = null;
      for (const w of [window, window.frames[0], ed]) {
        w.addEventListener('message', (e: MessageEvent) => {
          const d = e.data;
          if (d && d.type === 'onlyoffice-file-stream' && d.buffer instanceof ArrayBuffer) {
            (window as any).__stream = { bytes: d.buffer.byteLength };
          }
        });
      }
      (ed.document.getElementById('area_id') as HTMLElement | null)?.focus();
      return { initiallyDisabled, focused: ed.document.activeElement?.id, gap: api.autoSaveGap };
    });
    expect(result.initiallyDisabled).toBe(true);
    expect(result.gap).toBe(0);

    // Real trusted keyboard input into a cell, then wait past the old
    // autosave gap (2s) to prove the enabled state sticks.
    await page.keyboard.press('ArrowDown');
    await page.keyboard.type('QA');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3500);

    const afterEdit = await page.evaluate(() => {
      const visit = (win: Window): any => {
        try {
          const scope = win as any;
          if (scope.Asc?.editor && 'isDocumentLoadComplete' in scope.Asc.editor) return win;
        } catch {
          /* skip */
        }
        for (let i = 0; i < win.frames.length; i++) {
          const f = visit(win.frames[i]);
          if (f) return f;
        }
        return null;
      };
      const ed = visit(window);
      return {
        canSave: ed.Asc.editor.isDocumentCanSave,
        btnDisabled: (ed.document.querySelector('#id-toolbar-btn-save') as HTMLElement).classList.contains('disabled'),
      };
    });
    expect(afterEdit.canSave, 'isDocumentCanSave should stay true after an edit').toBe(true);
    expect(afterEdit.btnDisabled, 'toolbar Save button should be enabled after an edit').toBe(false);

    // Trigger the save the way the toolbar/shortcut does (asc_Save with no
    // autosave flag), inside the editor frame; the patched path routes it
    // to asc_DownloadAs and the file stream must appear.
    await page.evaluate(() => {
      const visit = (win: Window): any => {
        try {
          const scope = win as any;
          if (scope.Asc?.editor && 'isDocumentLoadComplete' in scope.Asc.editor) return win;
        } catch {
          /* skip */
        }
        for (let i = 0; i < win.frames.length; i++) {
          const f = visit(win.frames[i]);
          if (f) return f;
        }
        return null;
      };
      visit(window).Asc.editor.asc_Save();
    });
    await expect.poll(() => page.evaluate(() => (window as any).__stream), { timeout: 60_000 }).toBeTruthy();
    const stream = await page.evaluate(() => (window as any).__stream);
    expect(stream.bytes).toBeGreaterThan(500);
  });

  test('opens a PDF through the vendor pdf editor', async ({ page }) => {
    await page.evaluate(async () => {
      // Build a minimal but structurally valid single-page PDF, computing the
      // xref offsets for real so strict parsers accept it.
      const head = '%PDF-1.4\n';
      const objects = [
        '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n',
        '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n',
        '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n',
      ];
      let body = head;
      const offsets: number[] = [];
      for (const obj of objects) {
        offsets.push(body.length);
        body += obj;
      }
      const xrefOffset = body.length;
      const pad = (n: number) => String(n).padStart(10, '0');
      body +=
        `xref\n0 4\n0000000000 65535 f \n` +
        offsets.map((o) => `${pad(o)} 00000 n \n`).join('') +
        `trailer<</Size 4/Root 1 0 R>>\nstartxref\n${xrefOffset}\n%%EOF`;
      const pdf = new TextEncoder().encode(body);

      await post('document:open-buffer', {
        fileName: 'mini.pdf',
        buffer: pdf.buffer,
        readonly: false,
      });
    });

    // The api layer routes fileType pdf to the pdfeditor app: assert the
    // editor iframe actually mounted it (not a silent fallback to word).
    await expect
      .poll(() => page.frames().some((frame) => frame.url().includes('/pdfeditor/')), { timeout: 30_000 })
      .toBe(true);

    const state = await page.evaluate(async () => post('document:get-state', {}));
    expect(state).toEqual({ readonly: false, hasDocument: true });
  });
});
