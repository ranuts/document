import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { expect, test } from '@playwright/test';

/**
 * Real-document regression matrix (roadmap direction zero).
 *
 * Synthetic minimal fixtures proved the pipeline works but hid every
 * real-world failure (image-save freeze, real-PPTX fatal error), so this
 * suite drives the editor with a local corpus of REAL documents. The corpus
 * stays on the tester's machine and is never committed:
 *
 *   CORPUS_DIR=~/Documents pnpm run test:e2e:corpus
 *   CORPUS_FILTER='EMP' ...   # optional regex on file paths
 *
 * Without CORPUS_DIR the whole suite is skipped, which keeps CI green.
 *
 * Per file: open -> fatal-dialog/asc_onError watch -> trusted-input edit ->
 * save -> output sanity. The OnlyOffice fatal dialog ("An error occurred
 * during the work with the document") and asc_onError events are hard
 * failures, not just crashes.
 */

declare function post(type: string, payload?: Record<string, unknown>): Promise<any>;

const CORPUS_DIR = process.env.CORPUS_DIR;
const FILTER = process.env.CORPUS_FILTER ? new RegExp(process.env.CORPUS_FILTER, 'i') : null;
const SUPPORTED = new Set(['.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt', '.csv']);
const MAX_BYTES = 60 * 1024 * 1024;

const SAVE_TARGET: Record<string, string> = {
  '.docx': 'DOCX',
  '.doc': 'DOCX',
  '.xlsx': 'XLSX',
  '.xls': 'XLSX',
  '.pptx': 'PPTX',
  '.ppt': 'PPTX',
  '.csv': 'CSV',
};

function collectCorpus(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string, depth: number) => {
    if (depth > 4) return;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      if (name === 'node_modules' || name === 'code' || name.startsWith('.')) continue;
      const p = join(dir, name);
      let st;
      try {
        st = statSync(p);
      } catch {
        continue;
      }
      if (st.isDirectory()) walk(p, depth + 1);
      else if (SUPPORTED.has(extname(name).toLowerCase()) && st.size > 0 && st.size <= MAX_BYTES) out.push(p);
    }
  };
  walk(root, 0);
  return out.filter((p) => !FILTER || FILTER.test(p)).sort();
}

type Row = {
  file: string;
  sizeKB: number;
  open: string;
  edit: string;
  save: string;
  ascErrors: unknown[];
  fatalDialog: string | null;
  ms: number;
};
const rows: Row[] = [];

const files = CORPUS_DIR ? collectCorpus(CORPUS_DIR) : [];

test.describe('real-document corpus matrix', () => {
  test.skip(!CORPUS_DIR, 'CORPUS_DIR not set — corpus matrix is a local/nightly suite');
  test.describe.configure({ timeout: 300_000 });

  test.afterAll(() => {
    if (!rows.length) return;
    mkdirSync('test-results', { recursive: true });
    const report = 'test-results/corpus-report.json';
    writeFileSync(report, JSON.stringify(rows, null, 2));
    const bad = rows.filter(
      (r) =>
        r.open !== 'ok' || r.edit === 'fatal' || r.save.startsWith('fail') || r.ascErrors.length > 0 || r.fatalDialog,
    );
    console.log(`\nCORPUS SUMMARY: ${rows.length} files, ${bad.length} with findings -> ${report}`);
    for (const r of bad) {
      console.log(
        `  FINDING ${r.file}: open=${r.open} edit=${r.edit} save=${r.save} ascErrors=${JSON.stringify(r.ascErrors).slice(0, 120)} dialog=${r.fatalDialog}`,
      );
    }
  });

  for (const filePath of files) {
    const name = basename(filePath);
    const ext = extname(filePath).toLowerCase();

    test(`corpus: ${name}`, async ({ page }) => {
      const t0 = Date.now();
      const row: Row = {
        file: filePath,
        sizeKB: Math.round(statSync(filePath).size / 1024),
        open: 'pending',
        edit: 'skipped',
        save: 'skipped',
        ascErrors: [],
        fatalDialog: null,
        ms: 0,
      };
      rows.push(row);

      const bytes = readFileSync(filePath);
      await page.route('**/__corpus__/doc', (route) =>
        route.fulfill({ status: 200, contentType: 'application/octet-stream', body: bytes }),
      );

      await page.goto('/embed-demo.html');
      await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });

      // ---- open ----
      const opened = await page.evaluate(
        async ({ fileName }) => {
          const buf = await (await fetch('/__corpus__/doc')).arrayBuffer();
          try {
            await Promise.race([
              post('document:open-buffer', { fileName, buffer: buf, readonly: false }),
              new Promise<never>((_, rej) => setTimeout(() => rej(new Error('open timed out (120s)')), 120_000)),
            ]);
            return { ok: true };
          } catch (e) {
            return { ok: false, error: String((e as Error).message || e) };
          }
        },
        { fileName: name },
      );
      if (!opened.ok) {
        row.open = `fail: ${opened.error}`;
        row.ms = Date.now() - t0;
        expect(opened.ok, `open failed: ${opened.error}`).toBe(true);
        return;
      }

      // Register error listeners, then gate on the REAL load-complete signal:
      // document:opened only means the editor was constructed. The corpus's
      // first finding was a deck stuck on "Loading presentation" forever
      // while the embed promise had long resolved.
      const load = await page.evaluate(async () => {
        const w = window as any;
        w.__ascErrors = [];
        const visit = (win: Window): any => {
          try {
            const scope = win as any;
            const api = scope.Asc?.editor || scope.editor;
            if (api && typeof api.asc_registerCallback === 'function') return api;
          } catch {
            /* cross-origin */
          }
          for (let i = 0; i < win.frames.length; i++) {
            const f = visit(win.frames[i]);
            if (f) return f;
          }
          return null;
        };
        const t = Date.now();
        let api = visit(window);
        while (!api && Date.now() - t < 60_000) {
          await new Promise((r) => setTimeout(r, 500));
          api = visit(window);
        }
        if (!api) return { loaded: false, loadMs: Date.now() - t, reason: 'editor api never appeared' };
        w.__corpusApi = true;
        api.asc_registerCallback('asc_onError', (id: unknown, level: unknown) => {
          w.__ascErrors.push({ id: String(id), level: String(level) });
        });
        while (!api.isDocumentLoadComplete && Date.now() - t < 180_000) {
          await new Promise((r) => setTimeout(r, 1000));
        }
        if (!api.isDocumentLoadComplete)
          return { loaded: false, loadMs: Date.now() - t, reason: 'isDocumentLoadComplete still false after 180s' };
        await new Promise((r) => setTimeout(r, 4000));
        return { loaded: true, loadMs: Date.now() - t };
      });

      const findFatalDialog = () =>
        page.evaluate(() => {
          const visit = (win: Window): string | null => {
            try {
              for (const el of Array.from(win.document.querySelectorAll('.asc-window, .modal, [role="dialog"]'))) {
                const he = el as HTMLElement;
                if (
                  he.offsetParent !== null &&
                  /error occurred during the work|与文档工作|критическ/i.test(he.textContent || '')
                ) {
                  return (he.textContent || '').trim().slice(0, 160);
                }
              }
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
        });

      row.fatalDialog = await findFatalDialog();
      row.open = row.fatalDialog
        ? 'fatal-dialog-on-open'
        : load.loaded
          ? `ok (load ${Math.round(load.loadMs / 1000)}s)`
          : `fail: ${(load as { reason?: string }).reason}`;

      // ---- edit (trusted input; the real-PPTX fatal error fired on edit) ----
      if (!row.fatalDialog && load.loaded) {
        try {
          const editorFrame = page.frameLocator('iframe').frameLocator('iframe[name="frameEditor"]');
          const sdk = editorFrame.locator('#editor_sdk');
          await sdk.waitFor({ state: 'visible', timeout: 15_000 });
          if (ext === '.pptx' || ext === '.ppt') {
            await sdk.dblclick({ position: { x: 400, y: 300 }, timeout: 10_000 });
          } else {
            await sdk.click({ position: { x: 400, y: 300 }, timeout: 10_000 });
          }
          await page.keyboard.type('QA', { delay: 100 });
          await page.waitForTimeout(3000);
          row.fatalDialog = await findFatalDialog();
          row.edit = row.fatalDialog ? 'fatal' : 'ok';
        } catch (e) {
          row.edit = `inconclusive: ${String((e as Error).message).slice(0, 80)}`;
        }
      }

      // ---- save (direct editor API + file-stream listener; the embed
      //      post() helper caps at 45s which is too short for big decks
      //      and hides slow-vs-hung) ----
      if (!row.fatalDialog && load.loaded) {
        const targetCode = { DOCX: 65, XLSX: 257, PPTX: 129, CSV: 257 }[SAVE_TARGET[ext]] as number;
        const saved = await page.evaluate(
          async ({ code }) => {
            const started = Date.now();
            try {
              const appWin = window.frames[0] as Window;
              const streamPromise = new Promise<{ size: number; isZip: boolean }>((resolve) => {
                const onMsg = (e: MessageEvent) => {
                  const d = e.data;
                  if (d && d.type === 'onlyoffice-file-stream' && d.buffer instanceof ArrayBuffer) {
                    appWin.removeEventListener('message', onMsg);
                    const b = new Uint8Array(d.buffer);
                    resolve({ size: b.byteLength, isZip: b[0] === 0x50 && b[1] === 0x4b });
                  }
                };
                appWin.addEventListener('message', onMsg);
              });
              const visit = (win: Window): any => {
                try {
                  const scope = win as any;
                  const api = scope.Asc?.editor || scope.editor;
                  if (api && typeof api.asc_DownloadAs === 'function') return { api, win: win as any };
                } catch {
                  /* skip */
                }
                for (let i = 0; i < win.frames.length; i++) {
                  const f = visit(win.frames[i]);
                  if (f) return f;
                }
                return null;
              };
              const found = visit(window);
              if (!found) return { ok: false, ms: 0, error: 'no editor api for save' };
              found.api.asc_DownloadAs(new found.win.Asc.asc_CDownloadOptions(code));
              const out = await Promise.race([
                streamPromise,
                new Promise<never>((_, rej) => setTimeout(() => rej(new Error('save timed out (180s)')), 180_000)),
              ]);
              return { ok: true, ms: Date.now() - started, size: out.size, isZip: out.isZip };
            } catch (e) {
              return { ok: false, ms: Date.now() - started, error: String((e as Error).message || e) };
            }
          },
          { code: targetCode },
        );
        if (saved.ok) {
          row.save = saved.isZip
            ? `ok (${saved.ms}ms, ${Math.round((saved.size || 0) / 1024)}KB)`
            : 'fail: output not a zip container';
        } else {
          row.save = `fail: ${saved.error}`;
        }
        row.fatalDialog = row.fatalDialog || (await findFatalDialog());
      }

      row.ascErrors = await page.evaluate(() => (window as any).__ascErrors || []);
      row.ms = Date.now() - t0;

      expect(row.fatalDialog, `fatal document-error dialog appeared: ${row.fatalDialog}`).toBeNull();
      expect(row.ascErrors, `asc_onError fired: ${JSON.stringify(row.ascErrors)}`).toEqual([]);
      expect(row.open.startsWith('ok'), `open result: ${row.open}`).toBe(true);
      expect(row.save.startsWith('ok'), `save result: ${row.save}`).toBe(true);
    });
  }
});
