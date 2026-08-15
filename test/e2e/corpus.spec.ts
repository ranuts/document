import { readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { expect, test } from './lib/l0';

/**
 * Real-document regression matrix (roadmap direction zero).
 *
 * Synthetic minimal fixtures proved the pipeline works but hid every
 * real-world failure (image-save freeze, real-PPTX fatal error), so this
 * suite drives the editor with a local corpus of REAL documents. The corpus
 * stays on the tester's machine and is never committed:
 *
 *   CORPUS_DIR=~/Documents pnpm run test:e2e:corpus
 *   CORPUS_FILTER='EMP' ...   # optional include regex on file paths
 *   CORPUS_EXCLUDE='password|encrypt' ...   # optional exclude regex
 *   CORPUS_LIMIT=300 ...      # optional cap (logged, never silent)
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
// Public corpora carry files that are expected to fail (password-protected,
// deliberately corrupt); exclude by path regex so findings stay meaningful.
const EXCLUDE = process.env.CORPUS_EXCLUDE ? new RegExp(process.env.CORPUS_EXCLUDE, 'i') : null;
// Optional cap for large public corpora (nightly CI). Never silent: the
// truncation is logged and recorded in the report.
const LIMIT = process.env.CORPUS_LIMIT ? Number(process.env.CORPUS_LIMIT) : Infinity;
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
  return out.filter((p) => (!FILTER || FILTER.test(p)) && !(EXCLUDE && EXCLUDE.test(p))).sort();
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

const allFiles = CORPUS_DIR ? collectCorpus(CORPUS_DIR) : [];
const files = allFiles.slice(0, LIMIT);
if (allFiles.length > files.length) {
  console.log(
    `CORPUS: CORPUS_LIMIT=${LIMIT} keeps ${files.length} of ${allFiles.length} files (${allFiles.length - files.length} dropped)`,
  );
}

test.describe('real-document corpus matrix', () => {
  test.skip(!CORPUS_DIR, 'CORPUS_DIR not set — corpus matrix is a local/nightly suite');
  test.describe.configure({ timeout: 300_000 });

  test.afterAll(() => {
    if (!rows.length) return;
    mkdirSync('test-results', { recursive: true });
    // One file per worker: with fullyParallel each worker process holds its
    // own `rows`, and a shared filename would leave only the last writer.
    // bin/corpus-report.mjs merges them.
    const report = `test-results/corpus-report-${test.info().workerIndex}.json`;
    writeFileSync(
      report,
      JSON.stringify({ corpusDir: CORPUS_DIR, total: allFiles.length, kept: files.length, rows }, null, 2),
    );
    const bad = rows.filter(
      (r) =>
        !r.open.startsWith('ok') ||
        r.edit === 'fatal' ||
        r.save.startsWith('fail') ||
        r.ascErrors.length > 0 ||
        r.fatalDialog,
    );
    console.log(`\nCORPUS SUMMARY: ${rows.length} files, ${bad.length} with findings -> ${report}`);
    for (const r of bad) {
      console.log(
        `  FINDING ${r.file}: open=${r.open} edit=${r.edit} save=${r.save} ascErrors=${JSON.stringify(r.ascErrors).slice(0, 120)} dialog=${r.fatalDialog}`,
      );
    }
  });

  for (const [index, filePath] of files.entries()) {
    const name = basename(filePath);
    const ext = extname(filePath).toLowerCase();

    // Index prefix keeps titles unique when the same filename exists in
    // several corpus folders.
    test(`corpus #${index}: ${name}`, async ({ page }) => {
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

      await page.goto('/embed-demo.html');
      await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });

      // ---- open ----
      // Hand the real File to the demo page's own <input type=file> and open
      // it through document:open-file: no network hop, real filename, no
      // 60 MB base64 round trip. The first harness served the bytes over
      // page.route(), which the app's service worker silently bypassed once
      // it controlled the page: the route never fired, vite preview answered
      // with the SPA index.html and x2t was fed 20 KB of HTML (abort on the
      // stubbed HTML importer). That, not the documents, produced the
      // "25/25 fail" and the filename red herring of campaign day 1.
      await page.setInputFiles('#fileInput', filePath);
      const opened = await page.evaluate(async () => {
        const input = document.getElementById('fileInput') as HTMLInputElement;
        const file = input.files && input.files[0];
        if (!file) return { ok: false, error: 'file input is empty' };
        try {
          await Promise.race([
            post('document:open-file', { file, readonly: false }),
            new Promise<never>((_, rej) => setTimeout(() => rej(new Error('open timed out (120s)')), 120_000)),
          ]);
          return { ok: true };
        } catch (e) {
          return { ok: false, error: String((e as Error).message || e) };
        }
      });
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
        // Only the innermost SDK instance (Asc.editor inside the editor
        // frame) carries isDocumentLoadComplete; the app-level `window.editor`
        // one frame up is the DocEditor wrapper and must not be mistaken for
        // it.
        const visit = (win: Window): any => {
          try {
            const scope = win as any;
            const api = scope.Asc?.editor;
            if (api && typeof api.asc_registerCallback === 'function' && 'isDocumentLoadComplete' in api) return api;
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
        // Both flags: an asc_DownloadAs fired before isLoadFullApi is
        // silently dropped by the SDK (the app's triggerPersonalDownloadAs
        // gates on the same pair) -- the first corpus save run timed out
        // on every large deck for exactly that reason.
        while (!(api.isDocumentLoadComplete && api.isLoadFullApi) && Date.now() - t < 180_000) {
          await new Promise((r) => setTimeout(r, 1000));
        }
        if (!(api.isDocumentLoadComplete && api.isLoadFullApi))
          return {
            loaded: false,
            loadMs: Date.now() - t,
            reason: `not ready after 180s (isDocumentLoadComplete=${String(api.isDocumentLoadComplete)}, isLoadFullApi=${String(api.isLoadFullApi)}, docLoadStarted=${String(api.isDocumentLoadStarted ?? 'n/a')})`,
          };
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
              // x2t_helper posts the stream to both window.parent (the app)
              // and window.top (this demo page). Listen here, in our own
              // realm: a listener attached to the app window from this
              // evaluate() would compare the app-realm ArrayBuffer against
              // this realm's constructor and never match -- which silently
              // turned every successful save into a 180 s timeout in the
              // second corpus run.
              const isArrayBuffer = (v: unknown) => Object.prototype.toString.call(v) === '[object ArrayBuffer]';
              const streamPromise = new Promise<{ size: number; isZip: boolean }>((resolve) => {
                const onMsg = (e: MessageEvent) => {
                  const d = e.data;
                  if (d && d.type === 'onlyoffice-file-stream' && isArrayBuffer(d.buffer)) {
                    window.removeEventListener('message', onMsg);
                    const b = new Uint8Array(d.buffer);
                    resolve({ size: b.byteLength, isZip: b[0] === 0x50 && b[1] === 0x4b });
                  }
                };
                window.addEventListener('message', onMsg);
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
              if (!(found.api.isDocumentLoadComplete && found.api.isLoadFullApi)) {
                return { ok: false, ms: 0, error: 'editor lost readiness before save' };
              }
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
