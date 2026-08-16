import { buildDocx, buildPptx, toBase64 } from './lib/ooxml';
import { expect, test } from './lib/l0';

declare function post(type: string, payload?: Record<string, unknown>): Promise<any>;

/**
 * Format parity for behaviors that were only pinned on xlsx (matrix section
 * A): PDF export and readonly open must hold for the word and presentation
 * editors too -- each is a different vendor app with its own save glue.
 */
const DOCS = [
  { label: 'docx', name: 'parity.docx', b64: () => toBase64(buildDocx('parity docx')) },
  { label: 'pptx', name: 'parity.pptx', b64: () => toBase64(buildPptx('parity pptx')) },
] as const;

test.describe('format parity: docx / pptx (real editor)', () => {
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

  for (const doc of DOCS) {
    test(`${doc.label}: runtime readonly toggle locks and unlocks the live editor`, async ({ page }) => {
      const result = await page.evaluate(
        async ({ name, b64 }) => {
          const readRestriction = (): number | null => {
            const visit = (win: Window): number | null => {
              try {
                const api = (win as any).Asc?.editor;
                if (api && typeof api.asc_setRestriction === 'function' && typeof api.restrictions === 'number') {
                  return api.restrictions;
                }
              } catch {
                /* cross-origin */
              }
              for (let i = 0; i < win.frames.length; i++) {
                const found = visit(win.frames[i]);
                if (found !== null) return found;
              }
              return null;
            };
            return visit(window);
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
