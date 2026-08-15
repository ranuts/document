import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { expect, test } from './lib/l0';
import { buildDocx, toBase64 } from './lib/ooxml';
import { buildXlsx, buildPptx } from './actions/fixtures';
import { waitForEditorReady, typeIntoDocument, saveAndCapture, editorHealth, SAVE_FORMAT_CODE } from './actions/editor';

/**
 * Interaction-surface sweep, API layer (strategy section 9.1 step 1).
 *
 * The three editors expose ~600 `asc_*` methods; the toolbar, menus and
 * shortcuts are thin wrappers over them. Calling every zero-argument method
 * with the caret on real content, and checking L0 after each, touches most
 * of the implementation paths behind the UI without driving the UI. It is
 * a STABILITY sweep (does not throw uncaught, does not raise asc_onError,
 * does not open the fatal dialog, does not wedge the main thread), not a
 * semantics check -- semantics live in embed-regression and the corpus.
 *
 * Documents: one synthetic per format by default (CI); with CORPUS_DIR set,
 * additionally the first real file of each format found there (local runs).
 * Output: test-results/api-surface-<kind>.json with per-method verdicts, and
 * a console summary of the ones that misbehaved.
 */

declare function post(type: string, payload?: Record<string, unknown>): Promise<any>;

// Methods that legitimately change the world in ways a sweep must not:
// close/exit the document, kick off a save/download (covered elsewhere),
// enter modal states that block every following call, or start long-
// running background work.
const SKIP = new RegExp(
  [
    '^asc_(Save|DownloadAs|DownloadOrigin|CloseFile|Print|Close|Exit|Logout|Reconnect)',
    // Verified by bisection: after asc_stopSaving() no later asc_DownloadAs
    // ever produces a stream (saves are permanently off for the session),
    // and asc_onCloseFrameEditor tears the frame bridge down. Both are
    // legitimate one-way switches, not defects, but the sweep must not pull
    // them or every method after them is judged in a broken editor.
    '^asc_(stopSaving|onCloseFrameEditor)$',
    'Print',
    'Presentation|Demonstration|SlideShow',
    'startSaveDocument|forceSave|Force',
    'asc_(setDocumentReadOnly|coAuthoringDisconnect|coAuthoringChatSendMessage)',
    'asc_(nativeOpenFile|nativePrint|nativeInit)',
    'CoAuthoring',
    'asc_(getMailMerge|StartMailMerge|PreviewMailMerge)',
    'asc_(setPageOptions|setPrintOptions)',
    'ExternalReference|ExternalLink',
    'asc_(pastePreview|Paste|Cut|Copy)',
    'asc_(startEditCurrentOleObject|OpenCurrentOle)',
    'asc_(setViewMode|setViewerMode|asc_setRestriction)',
    'asc_(showRevision|BeginViewModeInReview|EndViewModeInReview)',
    'asc_(setCoAuthoringDisable|setAutoSaveGap)',
    'asc_(nativeGetPDF|nativeGetHtml)',
    'asc_(getPdfProps|GetPdfProps)',
    'Encrypt|Password|Crypto',
    'asc_(setDocumentPassword|resetPassword)',
    'asc_(startGetDocInfo|stopGetDocInfo)',
    'asc_(setDocumentModified|setSaveNotify)',
    'asc_(getUsers|getUsersCount|SetFastCollaborative)',
    'asc_(setDefaultLanguage|setSpellCheck|SpellCheck)',
    'asc_(getInputLanguage|setInputLanguage)',
    'asc_(setPluginsOptions|Plugin|plugin)',
    'asc_(setDrawImagePlaceContents|setDrawImagePlaceParagraph)',
    'asc_(getRefreshOnLoad|refresh)',
    'asc_(setAdvancedOptions|setLocale)',
    'asc_(setDisplayModeInReview)',
  ].join('|'),
);

type Verdict = {
  method: string;
  status: 'ok' | 'threw' | 'asc_onError' | 'fatal-dialog' | 'skipped';
  detail?: string;
  ms?: number;
};

const CORPUS_DIR = process.env.CORPUS_DIR;
function firstCorpusFile(ext: string): string | null {
  if (!CORPUS_DIR) return null;
  const walk = (dir: string, depth: number): string | null => {
    if (depth > 4) return null;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return null;
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
      if (st.isDirectory()) {
        const f = walk(p, depth + 1);
        if (f) return f;
      } else if (extname(name).toLowerCase() === ext && st.size > 0 && st.size < 15 * 1024 * 1024) return p;
    }
    return null;
  };
  return walk(CORPUS_DIR, 0);
}

type Doc = { label: string; fileName: string; b64: string; kind: 'word' | 'cell' | 'slide'; format: number };

function synthDocs(): Doc[] {
  return [
    {
      label: 'synthetic docx',
      fileName: 'api-sweep.docx',
      b64: toBase64(buildDocx('api surface sweep')),
      kind: 'word',
      format: SAVE_FORMAT_CODE.docx,
    },
    {
      label: 'synthetic xlsx',
      fileName: 'api-sweep.xlsx',
      b64: toBase64(buildXlsx()),
      kind: 'cell',
      format: SAVE_FORMAT_CODE.xlsx,
    },
    {
      label: 'synthetic pptx',
      fileName: 'api-sweep.pptx',
      b64: toBase64(buildPptx('api surface sweep')),
      kind: 'slide',
      format: SAVE_FORMAT_CODE.pptx,
    },
  ];
}

const docs: Doc[] = synthDocs();
for (const [ext, kind, format] of [
  ['.docx', 'word', SAVE_FORMAT_CODE.docx],
  ['.xlsx', 'cell', SAVE_FORMAT_CODE.xlsx],
  ['.pptx', 'slide', SAVE_FORMAT_CODE.pptx],
] as const) {
  const f = firstCorpusFile(ext);
  if (f)
    docs.push({
      label: `corpus ${basename(f)}`,
      fileName: basename(f),
      b64: readFileSync(f).toString('base64'),
      kind,
      format,
    });
}

test.describe('api surface sweep', () => {
  test.describe.configure({ timeout: 900_000 });

  for (const doc of docs) {
    test(`asc_* zero-arg sweep on ${doc.label}`, async ({ page, l0 }) => {
      // The sweep intentionally provokes vendor console errors from
      // methods called out of context; treat them as data, not failures.
      l0.allowConsole(/./);

      await page.goto('/embed-demo.html');
      await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });
      await page.evaluate(
        async ({ fileName, b64 }) => {
          const bin = atob(b64);
          const arr = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
          await post('document:open-buffer', { fileName, buffer: arr.buffer, readonly: false });
        },
        { fileName: doc.fileName, b64: doc.b64 },
      );
      const ready = await waitForEditorReady(page);
      expect(ready.kind).toBe(doc.kind);

      // Put real content under the caret so methods have something to act on.
      await typeIntoDocument(page, doc.kind, 'sweep');

      const verdicts: Verdict[] = await page.evaluate(
        async ({ skipSource }) => {
          const visit = (win: Window): { api: any; win: any } | null => {
            try {
              const scope = win as any;
              const api = scope.Asc && scope.Asc.editor;
              if (api && typeof api.asc_registerCallback === 'function') return { api, win };
            } catch {
              /* cross-origin */
            }
            for (let i = 0; i < win.frames.length; i++) {
              const f = visit(win.frames[i]);
              if (f) return f;
            }
            return null;
          };
          const found = visit(window);
          if (!found) throw new Error('no sdk');
          const { api, win } = found;
          const skip = new RegExp(skipSource);
          const names = new Set<string>();
          for (let o = api; o && o !== Object.prototype; o = Object.getPrototypeOf(o)) {
            for (const k of Object.getOwnPropertyNames(o)) {
              if (k.startsWith('asc_') && typeof api[k] === 'function' && api[k].length === 0) names.add(k);
            }
          }
          const errors: string[] = [];
          api.asc_registerCallback('asc_onError', (id: unknown, level: unknown) => errors.push(`${id}/${level}`));
          const fatal = () => {
            for (const el of Array.from(win.document.querySelectorAll('.asc-window, .modal, [role="dialog"]'))) {
              const he = el as HTMLElement;
              if (he.offsetParent !== null && /error occurred during the work|与文档工作/i.test(he.textContent || ''))
                return (he.textContent || '').trim().slice(0, 120);
            }
            return null;
          };
          const closeAnyDialog = () => {
            // Escape closes vendor windows; a method that opened a modal
            // must not poison the following calls.
            const ev = new win.KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true });
            win.document.dispatchEvent(ev);
            for (const el of Array.from(win.document.querySelectorAll('.asc-window .close, .modal .close')))
              (el as HTMLElement).click?.();
          };
          const out: Verdict[] = [];
          for (const name of [...names].sort()) {
            if (skip.test(name)) {
              out.push({ method: name, status: 'skipped' });
              continue;
            }
            const before = errors.length;
            const t0 = Date.now();
            try {
              await Promise.race([Promise.resolve().then(() => api[name]()), new Promise((r) => setTimeout(r, 1500))]);
              // Yield so async fallout (events, timers) lands before we judge.
              await new Promise((r) => setTimeout(r, 30));
              const dlg = fatal();
              if (dlg) {
                out.push({ method: name, status: 'fatal-dialog', detail: dlg, ms: Date.now() - t0 });
                closeAnyDialog();
              } else if (errors.length > before) {
                out.push({
                  method: name,
                  status: 'asc_onError',
                  detail: errors.slice(before).join(','),
                  ms: Date.now() - t0,
                });
              } else {
                out.push({ method: name, status: 'ok', ms: Date.now() - t0 });
              }
            } catch (e) {
              out.push({
                method: name,
                status: 'threw',
                detail: String((e as Error)?.message || e).slice(0, 160),
                ms: Date.now() - t0,
              });
            }
            closeAnyDialog();
          }
          return out;
        },
        { skipSource: SKIP.source },
      );

      // Post-sweep liveness: the document must still be usable and savable.
      const health = await editorHealth(page);
      let saveResult: { bytes: number; ms: number; isZip: boolean } | { error: string };
      try {
        saveResult = await saveAndCapture(page, doc.format, 120_000);
      } catch (e) {
        saveResult = { error: String((e as Error).message) };
      }

      mkdirSync('test-results', { recursive: true });
      const report = `test-results/api-surface-${doc.kind}-${doc.label.replace(/[^a-z0-9]+/gi, '_').slice(0, 40)}.json`;
      writeFileSync(report, JSON.stringify({ doc: doc.label, kind: doc.kind, health, saveResult, verdicts }, null, 2));

      const counts = verdicts.reduce<Record<string, number>>(
        (acc, v) => ((acc[v.status] = (acc[v.status] || 0) + 1), acc),
        {},
      );
      const bad = verdicts.filter(
        (v) => v.status === 'threw' || v.status === 'asc_onError' || v.status === 'fatal-dialog',
      );
      console.log(`API SWEEP ${doc.label}: ${JSON.stringify(counts)} -> ${report}`);
      for (const v of bad) console.log(`  ${v.status.padEnd(12)} ${v.method} ${v.detail ?? ''}`);
      console.log(
        `  post-sweep: loaded=${health.loaded} fatal=${health.fatalDialog} save=${JSON.stringify(saveResult)}`,
      );

      // Hard failures: the fatal dialog anywhere, or the editor no longer
      // usable/savable after the sweep. Individual `threw`/asc_onError are
      // reported (methods called out of context legitimately throw) but a
      // fatal dialog is never legitimate.
      expect(
        verdicts.filter((v) => v.status === 'fatal-dialog'),
        'methods that opened the fatal dialog',
      ).toEqual([]);
      expect(health.fatalDialog).toBeNull();
      expect(health.loaded).toBe(true);
      expect('error' in saveResult ? saveResult.error : 'ok', 'document must still save after the sweep').toBe('ok');
    });
  }
});
