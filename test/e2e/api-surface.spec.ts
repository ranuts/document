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
    '^asc_(stopSaving|onCloseFrameEditor|SetSilentMode)$',
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
  status: 'ok' | 'threw' | 'asc_onError' | 'fatal-dialog' | 'save-switch-off' | 'state-drift' | 'skipped';
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
  // Nightly-class suite (strategy section 6): ~5-15 min per format and it
  // deliberately pokes every method. Opt in with API_SWEEP=1; the PR gate
  // must never wait on it.
  test.skip(!process.env.API_SWEEP, 'API_SWEEP not set - api-surface sweep is a local/nightly suite');
  test.describe.configure({ timeout: 900_000 });

  for (const doc of docs) {
    test(`asc_* zero-arg sweep on ${doc.label}`, async ({ page, l0 }) => {
      // The sweep intentionally provokes vendor console errors from
      // methods called out of context; treat them as data, not failures.
      l0.allowConsole(/./);
      const calls: string[] = [];
      page.on('console', (m) => {
        const t = m.text();
        if (t.startsWith('SWEEP-CALL ')) calls.push(t.slice(11));
        if (t.startsWith('SWEEP-ORDER ')) console.log(t);
      });
      page.on('crash', () =>
        console.log(`RENDERER CRASHED during ${doc.label}; last calls: ${calls.slice(-5).join(' <- ')}`),
      );

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
        async ({ skipSource, probeEvery, onlySource }) => {
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
          // `api.canSave` is the SDK's "save pipeline is open" switch
          // (flipped off by stopSaving/prepareSave paths). Snapshot it after
          // every call so a one-way save killer is attributed to the exact
          // method that flipped it, instead of only showing up as a timeout
          // at the end of the sweep.
          let saveSwitchWas = api.canSave;
          // Real save probe every N methods (SWEEP_PROBE_EVERY env; default
          // off): asc_DownloadAs must still yield a stream. Attributes a
          // save killer that leaves every cheap flag untouched to a batch of
          // at most N methods -- the pptx sweep found exactly such a case.
          const isArrayBuffer = (v: unknown) => Object.prototype.toString.call(v) === '[object ArrayBuffer]';
          const saveProbe = () =>
            new Promise<boolean>((resolve) => {
              const onMsg = (e: MessageEvent) => {
                const d = e.data;
                if (d && d.type === 'onlyoffice-file-stream' && isArrayBuffer(d.buffer)) {
                  window.removeEventListener('message', onMsg);
                  resolve(true);
                }
              };
              window.addEventListener('message', onMsg);
              try {
                api.asc_DownloadAs(new win.Asc.asc_CDownloadOptions(api.documentFormatSave));
              } catch {
                /* judged by the timeout */
              }
              setTimeout(() => {
                window.removeEventListener('message', onMsg);
                resolve(false);
              }, 8000);
            });
          let sinceProbe = 0;
          let batchStart = 0;
          // SWEEP_ONLY="a,b,c" restricts the sweep to those methods, for
          // bisecting a batch that the probe attributed.
          const only = onlySource
            ? new Set(
                onlySource
                  .split(',')
                  .map((x) => x.trim())
                  .filter(Boolean),
              )
            : null;
          const sortedNames = [...names].sort().filter((n) => !only || only.has(n));
          console.log('SWEEP-ORDER ' + sortedNames.join(','));
          const stateVec = () =>
            JSON.stringify({
              // isLongAction() true means asc_DownloadAs is silently dropped;
              // a method that leaves it stuck true is a save killer.
              longAction: typeof api.isLongAction === 'function' ? !!api.isLongAction() : undefined,
              frameEditor: !!api.isOpenedFrameEditor,
              fmt: api.documentFormatSave,
              view: !!api.isViewMode,
              restr: api.restrictions,
              ro: !!api.isRestrictionView,
              loaded: !!api.isDocumentLoadComplete,
              full: !!api.isLoadFullApi,
              locked: typeof api.asc_isWorkbookLocked === 'function' ? !!api.asc_isWorkbookLocked() : undefined,
            });
          let stateWas = stateVec();
          for (let idx = 0; idx < sortedNames.length; idx++) {
            const name = sortedNames[idx];
            if (skip.test(name)) {
              out.push({ method: name, status: 'skipped' });
              continue;
            }
            if (probeEvery > 0 && sinceProbe >= probeEvery) {
              sinceProbe = 0;
              const ok = await saveProbe();
              if (!ok) {
                const batch = sortedNames.slice(batchStart, idx).filter((n) => !skip.test(n));
                console.log('SWEEP-SAVE-PROBE-FAILED after batch: ' + batch.join(','));
                out.push({
                  method: `<probe after ${batch[batch.length - 1]}>`,
                  status: 'save-switch-off',
                  detail: 'save probe failed; culprit in: ' + batch.join(','),
                });
                return out;
              }
              batchStart = idx;
            }
            sinceProbe++;
            const before = errors.length;
            const t0 = Date.now();
            // Streamed to the runner via page.on('console'): if the renderer
            // crashes mid-sweep, the last logged name is the culprit.
            console.log('SWEEP-CALL ' + name);
            try {
              await Promise.race([Promise.resolve().then(() => api[name]()), new Promise((r) => setTimeout(r, 1500))]);
              // Yield so async fallout (events, timers) lands before we judge.
              await new Promise((r) => setTimeout(r, 30));
              if (saveSwitchWas && !api.canSave) {
                console.log('SWEEP-SAVE-SWITCH-OFF ' + name);
                out.push({ method: name, status: 'save-switch-off', ms: Date.now() - t0 });
                saveSwitchWas = false;
                closeAnyDialog();
                continue;
              }
              const stateNow = stateVec();
              if (stateNow !== stateWas) {
                console.log('SWEEP-STATE-DRIFT ' + name + ' ' + stateWas + ' -> ' + stateNow);
                out.push({
                  method: name,
                  status: 'state-drift',
                  detail: `${stateWas} -> ${stateNow}`,
                  ms: Date.now() - t0,
                });
                stateWas = stateNow;
                closeAnyDialog();
                continue;
              }
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
              // A method that throws can still have mutated state on the way
              // out (asc_editChartInFrameEditor: opens the frame editor,
              // increments the long-action counter, THEN throws on a null
              // chart -- leaving isLongAction() stuck true and every later
              // asc_DownloadAs silently dropped). Judge drift here too.
              const stateNow = stateVec();
              const drift = stateNow !== stateWas ? ` | state ${stateWas} -> ${stateNow}` : '';
              if (drift) {
                console.log('SWEEP-STATE-DRIFT(threw) ' + name + drift);
                stateWas = stateNow;
              }
              out.push({
                method: name,
                status: 'threw',
                detail: String((e as Error)?.message || e).slice(0, 160) + drift,
                ms: Date.now() - t0,
              });
            }
            closeAnyDialog();
          }
          return out;
        },
        {
          skipSource: SKIP.source,
          probeEvery: Number(process.env.SWEEP_PROBE_EVERY || 0),
          onlySource: process.env.SWEEP_ONLY || '',
        },
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
      const bad = verdicts.filter((v) => v.status !== 'ok' && v.status !== 'skipped');
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
