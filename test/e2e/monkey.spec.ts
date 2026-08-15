import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from './lib/l0';
import { buildDocx, toBase64 } from './lib/ooxml';
import { buildXlsx, buildPptx } from './actions/fixtures';
import { waitForEditorReady, focusEditor, saveAndCapture, editorHealth, SAVE_FORMAT_CODE } from './actions/editor';

/**
 * Seeded monkey (strategy section 9.1 step 4).
 *
 * The defects that escaped every scripted suite were STATE COMBINATIONS:
 * "select all, then ask for chart series settings", "open the chart
 * editor with nothing selected, then save", "edit a slide title in a real
 * deck". No one writes those as test cases in advance. This suite composes
 * random sequences of user-shaped actions -- keyboard shortcuts, typing,
 * navigation, and the safe zero-arg asc_* methods -- from a fixed seed,
 * checks liveness after every step (fatal dialog, asc_onError, stuck
 * long-action counter, editor still loaded, main thread responsive) and
 * proves the document still saves at the end. On failure it prints the
 * seed, the document, and the exact step list so the run replays exactly:
 *
 *   MONKEY_SEED=1234 MONKEY_STEPS=200 E2E_PORT=4176 pnpm exec playwright test test/e2e/monkey.spec.ts
 *
 * Nightly-class (MONKEY=1). Default 150 steps per editor.
 */

declare function post(type: string, payload?: Record<string, unknown>): Promise<any>;

const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';
const SEED = Number(process.env.MONKEY_SEED || 20260815);
const STEPS = Number(process.env.MONKEY_STEPS || 150);

// mulberry32: tiny, deterministic, good enough for action selection.
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Kind = 'word' | 'cell' | 'slide';

// User-shaped keyboard actions. Weighted towards editing/navigation, with
// formatting and dialog-opening shortcuts mixed in (Escape follows every
// step so a dialog never blocks the next action).
const KEYS_COMMON = [
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  `${MOD}+Home`,
  `${MOD}+End`,
  'Shift+ArrowRight',
  'Shift+ArrowDown',
  'Shift+End',
  'Shift+Home',
  `${MOD}+Shift+ArrowRight`,
  'Enter',
  'Shift+Enter',
  'Backspace',
  'Delete',
  'Tab',
  'Shift+Tab',
  `${MOD}+A`,
  `${MOD}+C`,
  `${MOD}+X`,
  `${MOD}+V`,
  `${MOD}+Z`,
  `${MOD}+Y`,
  `${MOD}+B`,
  `${MOD}+I`,
  `${MOD}+U`,
  `${MOD}+F`,
  `${MOD}+H`,
  `${MOD}+K`,
  `${MOD}+D`,
  `${MOD}+Shift+H`,
  `${MOD}+]`,
  `${MOD}+[`,
  `${MOD}+=`,
  `${MOD}+-`,
  `${MOD}+0`,
  `${MOD}+Shift+Digit8`,
  'PageUp',
  'PageDown',
  'F2',
  'Escape',
];
const KEYS_KIND: Record<Kind, string[]> = {
  word: [
    `${MOD}+E`,
    `${MOD}+L`,
    `${MOD}+R`,
    `${MOD}+J`,
    `${MOD}+M`,
    `${MOD}+Shift+M`,
    `${MOD}+Enter`,
    `${MOD}+1`,
    `${MOD}+2`,
    `${MOD}+5`,
    `${MOD}+Alt+1`,
    `${MOD}+Alt+2`,
    `${MOD}+Alt+N`,
  ],
  cell: [
    `${MOD}+1`,
    `${MOD}+L`,
    `${MOD}+Shift+L`,
    `${MOD}+Shift+-`,
    `${MOD}+Shift+=`,
    `${MOD}+Space`,
    'Shift+Space',
    `${MOD}+Shift+Space`,
    'Alt+Enter',
    'F4',
    'F9',
    `${MOD}+;`,
    `${MOD}+Shift+;`,
    `${MOD}+PageUp`,
    `${MOD}+PageDown`,
    'Shift+F3',
  ],
  slide: [
    `${MOD}+E`,
    `${MOD}+L`,
    `${MOD}+R`,
    `${MOD}+M`,
    `${MOD}+Shift+M`,
    `${MOD}+Enter`,
    `${MOD}+Shift+.`,
    `${MOD}+Shift+,`,
    `${MOD}+Alt+ArrowUp`,
    `${MOD}+Alt+ArrowDown`,
    'Home',
    'End',
  ],
};
const TEXTS = ['abc', 'Hello, world', '12345', '中文测试', '=1+2', 'ünïcödé', 'a\tb', 'x'.repeat(40)];

// asc_* methods the monkey may call directly (safe, state-changing, no
// modal / no external side effect). Kept small on purpose: the API sweep
// already enumerates everything; here we want plausible user intent.
const SAFE_API: Record<Kind, string[]> = {
  word: [
    'asc_Undo',
    'asc_Redo',
    'asc_EditSelectAll',
    'asc_addTable',
    'asc_AddShapeOnCurrentPage',
    'asc_addComment',
    'asc_RemoveAllComments',
    'asc_getCanUndo',
    'asc_SetTrackRevisions',
    'asc_setDrawCollaborationMarks',
  ],
  cell: [
    'asc_Undo',
    'asc_Redo',
    'asc_EditSelectAll',
    'asc_addWorksheet',
    'asc_insertCells',
    'asc_deleteCells',
    'asc_mergeCells',
    'asc_unmergeCells',
    'asc_freezePane',
    'asc_getCanUndo',
    'asc_addAutoFilter',
    'asc_sortColFilter',
    'asc_setCellBold',
    'asc_setCellItalic',
  ],
  slide: [
    'asc_Undo',
    'asc_Redo',
    'asc_EditSelectAll',
    'asc_AddSlide',
    'asc_DeleteSlide',
    'asc_DuplicateSlide',
    'asc_getCanUndo',
    'asc_moveSelectedSlidesToStart',
    'asc_moveSelectedSlidesToEnd',
    'asc_addTable',
    'asc_AddShapeOnCurrentPage',
  ],
};

type Step = { i: number; kind: 'key' | 'type' | 'api'; value: string };
type Doc = { label: string; fileName: string; b64: string; kind: Kind; format: number };
const docs: Doc[] = [
  {
    label: 'docx',
    fileName: 'monkey.docx',
    b64: toBase64(buildDocx('monkey seed doc')),
    kind: 'word',
    format: SAVE_FORMAT_CODE.docx,
  },
  { label: 'xlsx', fileName: 'monkey.xlsx', b64: toBase64(buildXlsx()), kind: 'cell', format: SAVE_FORMAT_CODE.xlsx },
  {
    label: 'pptx',
    fileName: 'monkey.pptx',
    b64: toBase64(buildPptx('monkey seed deck')),
    kind: 'slide',
    format: SAVE_FORMAT_CODE.pptx,
  },
];

test.describe('seeded monkey', () => {
  test.skip(!process.env.MONKEY, 'MONKEY not set - seeded monkey is a local/nightly suite');
  test.describe.configure({ timeout: 900_000 });

  for (const doc of docs) {
    test(`monkey seed=${SEED} steps=${STEPS} on ${doc.label}`, async ({ page, l0 }) => {
      l0.allowConsole(/./);
      l0.allowFrameError?.(/./);
      const rand = prng(SEED ^ doc.kind.length);
      const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

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

      // Error collector + probe, same shape as the other sweeps.
      await page.evaluate(() => {
        const visit = (win: Window): any => {
          try {
            const scope = win as any;
            if (scope.Asc?.editor && typeof scope.Asc.editor.asc_registerCallback === 'function')
              return scope.Asc.editor;
          } catch {
            /* cross-origin */
          }
          for (let i = 0; i < win.frames.length; i++) {
            const f = visit(win.frames[i]);
            if (f) return f;
          }
          return null;
        };
        const api = visit(window);
        (window as any).__mkErrors = [];
        api.asc_registerCallback('asc_onError', (id: unknown, level: unknown) =>
          (window as any).__mkErrors.push(`${id}/${level}`),
        );
      });
      const probe = () =>
        page.evaluate(() => {
          const visit = (win: Window): any => {
            try {
              const scope = win as any;
              if (scope.Asc?.editor && typeof scope.Asc.editor.asc_registerCallback === 'function')
                return { api: scope.Asc.editor, win };
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
          if (!found)
            return {
              loaded: false,
              longAction: null,
              fatal: 'editor frame gone',
              errors: (window as any).__mkErrors?.length ?? 0,
            };
          const { api, win } = found;
          let fatal: string | null = null;
          for (const el of Array.from(win.document.querySelectorAll('.asc-window, .modal, [role="dialog"]'))) {
            const he = el as HTMLElement;
            if (he.offsetParent !== null && /error occurred during the work|与文档工作/i.test(he.textContent || '')) {
              fatal = (he.textContent || '').trim().slice(0, 120);
              break;
            }
          }
          const fl = api.FontLoader || (win.AscCommon && win.AscCommon.g_font_loader);
          const fontsPending = fl && Array.isArray(fl.fonts_loading) ? fl.fonts_loading.length : null;
          const pendingDetail =
            fl && Array.isArray(fl.fonts_loading) && fl.fonts_loading[0]
              ? (() => {
                  const f = fl.fonts_loading[0];
                  const ff = fl.fontFiles;
                  const face = (i: number) =>
                    i >= 0 && ff && ff[i] ? `${ff[i].Id}:st${ff[i].Status}:lc${ff[i].LoadingCounter}` : `idx${i}`;
                  return `${f.Name} R=${face(f.indexR)} I=${face(f.indexI)} B=${face(f.indexB)} BI=${face(f.indexBI)} need=${[f.needR, f.needI, f.needB, f.needBI].map(Number).join('')}`;
                })()
              : null;
          const fontReqs = (win.performance.getEntriesByType('resource') as PerformanceResourceTiming[])
            .filter((e) => /\/fonts\//.test(e.name))
            .slice(-4)
            .map((e) => `${e.name.split('/').pop()}:${(e as any).responseStatus ?? '?'}`);
          return {
            loaded: !!(api.isDocumentLoadComplete && api.isLoadFullApi),
            longAction: typeof api.isLongAction === 'function' ? !!api.isLongAction() : null,
            fatal,
            errors: (window as any).__mkErrors?.length ?? 0,
            fontsPending,
            pendingDetail,
            fontReqs,
            cellEdit: typeof api.asc_getCellEditMode === 'function' ? !!api.asc_getCellEditMode() : null,
          };
        });
      const callApi = (name: string) =>
        page.evaluate((name) => {
          const visit = (win: Window): any => {
            try {
              const scope = win as any;
              if (scope.Asc?.editor && typeof scope.Asc.editor.asc_registerCallback === 'function')
                return scope.Asc.editor;
            } catch {
              /* cross-origin */
            }
            for (let i = 0; i < win.frames.length; i++) {
              const f = visit(win.frames[i]);
              if (f) return f;
            }
            return null;
          };
          const api = visit(window);
          if (!api || typeof api[name] !== 'function') return 'absent';
          try {
            api[name]();
            return 'ok';
          } catch (e) {
            return 'threw: ' + String((e as Error)?.message || e).slice(0, 80);
          }
        }, name);

      const steps: Step[] = [];
      const ascErrorSteps: Array<{ step: number; action: string; ids: string[] }> = [];
      let failure: { at: number; why: string } | null = null;
      let errorsSeen = 0;
      const keys = [...KEYS_COMMON, ...KEYS_KIND[doc.kind]];
      const apis = SAFE_API[doc.kind];

      for (let i = 0; i < STEPS && !failure; i++) {
        const r = rand();
        let step: Step;
        if (r < 0.55) step = { i, kind: 'key', value: pick(keys) };
        else if (r < 0.8) step = { i, kind: 'type', value: pick(TEXTS) };
        else step = { i, kind: 'api', value: pick(apis) };
        steps.push(step);

        await focusEditor(page);
        try {
          if (step.kind === 'key') await page.keyboard.press(step.value);
          else if (step.kind === 'type') await page.keyboard.type(step.value, { delay: 15 });
          else await callApi(step.value);
        } catch (e) {
          failure = { at: i, why: `harness: ${String((e as Error).message).slice(0, 120)}` };
          break;
        }
        await page.waitForTimeout(80);
        await page.keyboard.press('Escape');

        // Liveness: bounded evaluate so a wedged main thread is a finding,
        // not a hang.
        let s: Awaited<ReturnType<typeof probe>>;
        try {
          s = await Promise.race([
            probe(),
            new Promise<never>((_, rej) =>
              setTimeout(() => rej(new Error('main thread unresponsive for 15s')), 15_000),
            ),
          ]);
        } catch (e) {
          failure = { at: i, why: String((e as Error).message) };
          break;
        }
        // A raised long-action counter is legitimate while async work is in
        // flight (a 2-3 MB CJK font fetch after typing Chinese, an image
        // load); only a counter that stays raised is a leak. Re-probe for
        // up to 8 s before calling it stuck.
        if (!s.fatal && s.loaded && s.longAction) {
          const t0 = Date.now();
          while (s.longAction && Date.now() - t0 < 8000) {
            await page.waitForTimeout(400);
            s = await probe();
          }
        }
        if (s.fatal) failure = { at: i, why: `fatal dialog: ${s.fatal}` };
        else if (!s.loaded) failure = { at: i, why: 'editor no longer loaded' };
        else if (s.longAction)
          failure = {
            at: i,
            why: `long-action counter stuck true (fontsPending=${s.fontsPending} [${s.pendingDetail}], cellEdit=${s.cellEdit}, lastFonts=${(s.fontReqs || []).join(',')})`,
          };
        // asc_onError is attributed to its step so a replay is exact. Only
        // Critical (level -1) ones fail the run: NoCritical (level 0) errors
        // are the SDK's own user-facing refusals ("range not suitable for
        // autofilter", "object not editable") that random sequences
        // legitimately provoke.
        if (s.errors > errorsSeen) {
          const ids: string[] = await page.evaluate(
            (from) => ((window as any).__mkErrors || []).slice(from),
            errorsSeen,
          );
          ascErrorSteps.push({ step: i, action: `${step.kind}(${step.value})`, ids });
          const critical = ids.filter((x) => x.endsWith('/-1'));
          if (critical.length) failure = { at: i, why: `critical asc_onError ${critical.join(',')}` };
        }
        errorsSeen = s.errors;
      }

      let saveResult: { bytes: number; ms: number; isZip: boolean } | { error: string };
      if (!failure) {
        await focusEditor(page);
        await page.keyboard.press('Escape');
        try {
          saveResult = await saveAndCapture(page, doc.format, 90_000);
        } catch (e) {
          saveResult = { error: String((e as Error).message) };
          failure = { at: STEPS, why: `post-run save failed: ${saveResult.error}` };
        }
      } else {
        saveResult = { error: 'skipped (failed earlier)' };
      }
      const health = await editorHealth(page).catch(() => ({
        loaded: false,
        canSave: false,
        fatalDialog: 'probe failed',
        restrictions: null,
      }));

      mkdirSync('test-results', { recursive: true });
      const report = `test-results/monkey-${doc.kind}-seed${SEED}.json`;
      writeFileSync(
        report,
        JSON.stringify(
          { seed: SEED, doc: doc.label, steps, failure, ascErrors: errorsSeen, health, saveResult },
          null,
          2,
        ),
      );
      console.log(
        `MONKEY ${doc.label} seed=${SEED} steps=${steps.length}/${STEPS} ascErrors=${errorsSeen} save=${JSON.stringify(saveResult)} -> ${report}`,
      );
      for (const e of ascErrorSteps) console.log(`  asc_onError ${e.ids.join(',')} at step ${e.step}: ${e.action}`);
      if (failure) {
        console.log(`  FAILED at step ${failure.at}: ${failure.why}`);
        console.log(
          `  REPLAY: MONKEY=1 MONKEY_SEED=${SEED} MONKEY_STEPS=${failure.at + 1} pnpm exec playwright test test/e2e/monkey.spec.ts -g "${doc.label}"`,
        );
        console.log(
          '  last 12 steps: ' +
            steps
              .slice(-12)
              .map((st) => `${st.i}:${st.kind}(${st.value})`)
              .join(' -> '),
        );
      }

      expect(failure, failure ? `monkey failed at step ${failure.at}: ${failure.why}` : '').toBeNull();
    });
  }
});
