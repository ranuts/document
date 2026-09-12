import { buildDocx, buildPptx, toBase64 } from './lib/ooxml';
import { expect, test } from './lib/l0';

/**
 * Format parity for behaviors that were only pinned on xlsx (matrix section
 * A): PDF export and readonly open must hold for the word and presentation
 * editors too -- each is a different vendor app with its own save glue.
 *
 * csv gets the readonly pair on its own below. It is the format where the
 * question is not "does the app honour it" but "does it survive the
 * conversion": the editor cannot open a CSV, so the page turns it into a
 * workbook first, and the readonly flag has to make it across that seam and
 * back out again on the way to a CSV.
 */
const DOCS = [
  { label: 'docx', name: 'parity.docx', b64: () => toBase64(buildDocx('parity docx')) },
  { label: 'pptx', name: 'parity.pptx', b64: () => toBase64(buildPptx('parity pptx')) },
] as const;

test.describe('format parity: docx / pptx / csv (real editor)', () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async ({ page }) => {
    await page.goto('/embed-demo.html');
    await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });
  });

  for (const doc of DOCS) {
    test(`${doc.label}: exports to PDF`, async ({ page }) => {
      const result = await page.evaluate(
        async ({ name, b64 }) => {
          const bin = atob(b64);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          await post('document:open-buffer', { fileName: name, buffer: bytes.buffer, readonly: false });
          const saved = await post('document:save', { targetExt: 'PDF' });
          const out = new Uint8Array(await saved.file.arrayBuffer());
          return {
            name: saved.file.name as string,
            magic: new TextDecoder().decode(out.slice(0, 5)),
            size: out.byteLength,
          };
        },
        { name: doc.name, b64: doc.b64() },
      );
      expect(result.name).toBe(doc.name.replace(/\.[a-z]+$/, '.pdf'));
      expect(result.magic).toBe('%PDF-');
      expect(result.size).toBeGreaterThan(500);
    });

    test(`${doc.label}: readonly open reports readonly and refuses to save`, async ({ page }) => {
      const result = await page.evaluate(
        async ({ name, b64 }) => {
          const bin = atob(b64);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          const opened = await post('document:open-buffer', { fileName: name, buffer: bytes.buffer, readonly: true });
          const state = await post('document:get-state', {});
          let saveError = '';
          try {
            await post('document:save', {});
          } catch (e) {
            saveError = String((e as Error).message || e);
          }
          return { opened, state, saveError };
        },
        { name: doc.name, b64: doc.b64() },
      );
      expect(result.opened.readonly).toBe(true);
      expect(result.state).toEqual({ readonly: true, hasDocument: true });
      expect(result.saveError).not.toBe('');
    });
  }

  const CSV_NAME = 'parity.csv';
  const CSV_SOURCE = 'k,v\nx,1\n中文,2';
  const csvB64 = (): string => {
    const utf8 = new TextEncoder().encode(CSV_SOURCE);
    let raw = '';
    for (const byte of utf8) raw += String.fromCharCode(byte);
    return btoa(raw);
  };

  test('csv: readonly open reports readonly and refuses to save', async ({ page }) => {
    const result = await page.evaluate(
      async ({ name, b64, source }) => {
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const opened = await post('document:open-buffer', { fileName: name, buffer: bytes.buffer, readonly: true });
        const state = await post('document:get-state', {});
        let saveError = '';
        try {
          await post('document:save', {});
        } catch (e) {
          saveError = String((e as Error).message || e);
        }
        return { opened, state, saveError, source };
      },
      { name: CSV_NAME, b64: csvB64(), source: CSV_SOURCE },
    );
    expect(result.opened.readonly).toBe(true);
    expect(result.state).toEqual({ readonly: true, hasDocument: true });
    expect(result.saveError).not.toBe('');
  });

  test('csv: runtime readonly toggle locks and unlocks, and the unlocked save is still a CSV', async ({ page }) => {
    const result = await page.evaluate(
      async ({ name, b64 }) => {
        const restriction = (): number | null => {
          // Off the window rather than out of the walk: 0 is a real answer.
          const win = window.__ooFrames.find((w) => {
            const api = (w as any).Asc?.editor;
            return typeof api?.asc_setRestriction === 'function' && typeof api.restrictions === 'number';
          }) as any;
          return win ? win.Asc.editor.restrictions : null;
        };
        const waitFor = async (expected: number) => {
          const start = Date.now();
          while (restriction() !== expected) {
            if (Date.now() - start > 30_000)
              throw new Error(`restriction did not become ${expected}, got ${restriction()}`);
            await new Promise((r) => setTimeout(r, 200));
          }
        };
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        await post('document:open-buffer', { fileName: name, buffer: bytes.buffer, readonly: false });
        await waitFor(0);
        await post('document:set-readonly', { readonly: true });
        await waitFor(128);
        let lockedSaveError = '';
        try {
          await post('document:save', {});
        } catch (e) {
          lockedSaveError = String((e as Error).message || e);
        }
        await post('document:set-readonly', { readonly: false });
        await waitFor(0);
        const saved = await post('document:save', {});
        const out = new Uint8Array(await saved.file.arrayBuffer());
        return {
          lockedSaveError,
          name: saved.file.name as string,
          text: new TextDecoder('utf-8').decode(out).trim(),
        };
      },
      { name: CSV_NAME, b64: csvB64() },
    );
    expect(result.lockedSaveError).not.toBe('');
    // Still a CSV on the way out, not the workbook it was opened as.
    expect(result.name).toBe(CSV_NAME);
    expect(result.text).toBe(CSV_SOURCE);
  });

  for (const doc of DOCS) {
    test(`${doc.label}: runtime readonly toggle locks and unlocks the live editor`, async ({ page }) => {
      const result = await page.evaluate(
        async ({ name, b64 }) => {
          const readRestriction = (): number | null => {
            // Read the value off the window rather than returning it from the
            // walk: 0 is a legitimate restriction.
            const visit = (): number | null => {
              const win = window.__ooFrames.find((w) => {
                const api = (w as any).Asc?.editor;
                return typeof api?.asc_setRestriction === 'function' && typeof api.restrictions === 'number';
              }) as any;
              return win ? win.Asc.editor.restrictions : null;
            };
            return visit();
          };
          const waitFor = async (expected: number) => {
            const start = Date.now();
            while (readRestriction() !== expected) {
              if (Date.now() - start > 30_000)
                throw new Error(`restriction did not become ${expected}, got ${readRestriction()}`);
              await new Promise((r) => setTimeout(r, 200));
            }
          };
          const bin = atob(b64);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          await post('document:open-buffer', { fileName: name, buffer: bytes.buffer, readonly: false });
          await waitFor(0);
          await post('document:set-readonly', { readonly: true });
          await waitFor(128);
          let lockedSaveError = '';
          try {
            await post('document:save', {});
          } catch (e) {
            lockedSaveError = String((e as Error).message || e);
          }
          await post('document:set-readonly', { readonly: false });
          await waitFor(0);
          const saved = await post('document:save', {});
          const out = new Uint8Array(await saved.file.arrayBuffer());
          return { lockedSaveError, name: saved.file.name as string, magic: Array.from(out.slice(0, 2)) };
        },
        { name: doc.name, b64: doc.b64() },
      );
      expect(result.lockedSaveError).not.toBe('');
      expect(result.name).toBe(doc.name);
      expect(result.magic).toEqual([0x50, 0x4b]);
    });
  }
});
