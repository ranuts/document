import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from './lib/l0';
import { buildDocx, toBase64 } from './lib/ooxml';
import { buildXlsx, buildPptx } from './actions/fixtures';
import {
  waitForEditorReady,
  focusEditor,
  typeIntoDocument,
  saveAndCapture,
  editorHealth,
  SAVE_FORMAT_CODE,
} from './actions/editor';

/**
 * Interaction-surface sweep, keyboard layer (strategy section 9.1 step 5).
 *
 * Every shortcut a user is likely to press, sent as TRUSTED input through
 * page.keyboard into each editor, with an L0-style health check after each
 * one (fatal dialog, asc_onError, editor still loaded, long-action counter
 * not stuck) and a real save at the end. Like api-surface it is a
 * STABILITY sweep: it does not assert what the shortcut did, only that the
 * editor survived it and can still save. Modal dialogs a shortcut opens are
 * dismissed with Escape before the next one.
 *
 * Nightly-class (SHORTCUT_SWEEP=1); a few seconds per editor.
 */

declare function post(type: string, payload?: Record<string, unknown>): Promise<any>;

const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';

// Shortcuts common to all three editors (OnlyOffice keyboard reference),
// spelled for Playwright. `Modifier` is expanded to the platform primary key.
const COMMON = [
  `${MOD}+A`,
  `${MOD}+C`,
  `${MOD}+X`,
  `${MOD}+V`,
  `${MOD}+Z`,
  `${MOD}+Y`,
  `${MOD}+Shift+Z`,
  `${MOD}+B`,
  `${MOD}+I`,
  `${MOD}+U`,
  `${MOD}+F`,
  `${MOD}+H`,
  `${MOD}+K`,
  `${MOD}+D`,
  `${MOD}+Shift+H`,
  `${MOD}+Shift+S`,
  `${MOD}+Alt+A`,
  `${MOD}+Alt+F`,
  `${MOD}+Alt+Q`,
  'Alt+F',
  'Alt+H',
  'Alt+Q',
  'Escape',
  'F2',
  'F5',
  'F7',
  'F12',
  'Home',
  'End',
  `${MOD}+Home`,
  `${MOD}+End`,
  'PageUp',
  'PageDown',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Shift+ArrowRight',
  'Shift+ArrowDown',
  `${MOD}+ArrowRight`,
  `${MOD}+Shift+ArrowRight`,
  'Tab',
  'Shift+Tab',
  'Enter',
  'Shift+Enter',
  'Backspace',
  'Delete',
  'Insert',
  `${MOD}+Shift+.`,
  `${MOD}+Shift+,`,
  `${MOD}+]`,
  `${MOD}+[`,
  `${MOD}+=`,
  `${MOD}+-`,
  `${MOD}+0`,
  `${MOD}+Shift+Digit8`,
];

const PER_KIND: Record<'word' | 'cell' | 'slide', string[]> = {
  word: [
    `${MOD}+E`,
    `${MOD}+L`,
    `${MOD}+R`,
    `${MOD}+J`,
    `${MOD}+M`,
    `${MOD}+Shift+M`,
    `${MOD}+Shift+L`,
    `${MOD}+Alt+M`,
    `${MOD}+Enter`,
    `${MOD}+Shift+Enter`,
    `${MOD}+1`,
    `${MOD}+2`,
    `${MOD}+5`,
    `${MOD}+Alt+1`,
    `${MOD}+Alt+2`,
    `${MOD}+Alt+3`,
    `${MOD}+Alt+N`,
    `${MOD}+Alt+H`,
    `${MOD}+Alt+D`,
    `${MOD}+Alt+F`,
    `${MOD}+Alt+E`,
    `${MOD}+Alt+C`,
    `${MOD}+Alt+R`,
    `${MOD}+Alt+S`,
    `${MOD}+Alt+I`,
    `${MOD}+Alt+K`,
    `${MOD}+Alt+L`,
    `${MOD}+Alt+G`,
    `${MOD}+Alt+V`,
    `${MOD}+Alt+B`,
    `${MOD}+Alt+P`,
    `${MOD}+Alt+T`,
    `${MOD}+Alt+U`,
  ],
  cell: [
    `${MOD}+1`,
    `${MOD}+L`,
    `${MOD}+Shift+L`,
    `${MOD}+Shift+-`,
    `${MOD}+Shift+=`,
    `${MOD}+Shift+F3`,
    `${MOD}+Shift+F`,
    `${MOD}+Shift+D`,
    `${MOD}+Shift+E`,
    `${MOD}+Shift+A`,
    `${MOD}+Shift+I`,
    `${MOD}+Shift+O`,
    `${MOD}+Shift+K`,
    `${MOD}+Shift+U`,
    `${MOD}+Shift+Digit1`,
    `${MOD}+Shift+Digit2`,
    `${MOD}+Shift+Digit3`,
    `${MOD}+Shift+Digit4`,
    `${MOD}+Shift+Digit5`,
    `${MOD}+Shift+Digit6`,
    `${MOD}+Shift+Digit7`,
    `${MOD}+Shift+Digit9`,
    `${MOD}+Shift+Digit0`,
    `${MOD}+Space`,
    'Shift+Space',
    `${MOD}+Shift+Space`,
    `${MOD}+Backspace`,
    `${MOD}+Delete`,
    `${MOD}+PageUp`,
    `${MOD}+PageDown`,
    'Alt+Enter',
    'Alt+ArrowDown',
    'Shift+F2',
    'Shift+F3',
    'F4',
    'F9',
    'Shift+F9',
    'F11',
    `${MOD}+F3`,
    `${MOD}+Shift+O`,
    `${MOD}+Alt+ArrowLeft`,
    `${MOD}+Alt+ArrowRight`,
    `${MOD}+.`,
    `${MOD}+;`,
    `${MOD}+Shift+;`,
    `${MOD}+'`,
    `${MOD}+Shift+'`,
    `${MOD}+Alt+V`,
    `${MOD}+Alt+F1`,
    `${MOD}+Alt+F9`,
    `${MOD}+Alt+Shift+F9`,
    `${MOD}+Alt+F`,
    `${MOD}+Alt+I`,
    `${MOD}+Alt+K`,
    `${MOD}+Alt+G`,
    `${MOD}+Alt+E`,
    `${MOD}+Alt+D`,
    `${MOD}+Alt+C`,
    `${MOD}+Alt+R`,
    `${MOD}+Alt+N`,
    `${MOD}+Alt+B`,
    `${MOD}+Alt+P`,
    `${MOD}+Alt+T`,
    `${MOD}+Alt+U`,
    `${MOD}+Alt+L`,
    `${MOD}+Alt+M`,
    `${MOD}+Alt+S`,
    `${MOD}+Alt+H`,
    `${MOD}+Alt+O`,
    `${MOD}+Alt+W`,
    `${MOD}+Alt+X`,
    `${MOD}+Alt+Y`,
    `${MOD}+Alt+Z`,
    'F3',
    'F6',
    'F8',
    'F10',
    'Alt+F1',
    'Alt+F8',
    'Alt+F11',
    'Alt+F2',
    'Alt+F4',
    'Alt+F5',
    'Alt+F6',
    'Alt+F7',
    'Alt+F9',
    'Alt+F10',
    'Alt+F12',
  ],
  slide: [
    `${MOD}+E`,
    `${MOD}+L`,
    `${MOD}+R`,
    `${MOD}+J`,
    `${MOD}+M`,
    `${MOD}+Shift+M`,
    `${MOD}+Shift+Enter`,
    `${MOD}+Enter`,
    `${MOD}+Shift+.`,
    `${MOD}+Shift+,`,
    `${MOD}+Alt+ArrowUp`,
    `${MOD}+Alt+ArrowDown`,
    `${MOD}+Alt+ArrowLeft`,
    `${MOD}+Alt+ArrowRight`,
    `${MOD}+Shift+ArrowUp`,
    `${MOD}+Shift+ArrowDown`,
    `${MOD}+Shift+ArrowLeft`,
    `${MOD}+Shift+ArrowLeft`,
    `${MOD}+Shift+F5`,
    `${MOD}+F5`,
    'Shift+F5',
    'F5',
    'F1',
    'F6',
    'F7',
    'F8',
    'F9',
    'F10',
    'F11',
    'F12',
    `${MOD}+Alt+F`,
    `${MOD}+Alt+G`,
    `${MOD}+Alt+H`,
    `${MOD}+Alt+I`,
    `${MOD}+Alt+K`,
    `${MOD}+Alt+L`,
    `${MOD}+Alt+M`,
    `${MOD}+Alt+N`,
    `${MOD}+Alt+O`,
    `${MOD}+Alt+P`,
    `${MOD}+Alt+R`,
    `${MOD}+Alt+S`,
    `${MOD}+Alt+T`,
    `${MOD}+Alt+U`,
    `${MOD}+Alt+V`,
    `${MOD}+Alt+W`,
    `${MOD}+Alt+X`,
    `${MOD}+Alt+Y`,
    `${MOD}+Alt+Z`,
    `${MOD}+Alt+B`,
    `${MOD}+Alt+C`,
    `${MOD}+Alt+D`,
    `${MOD}+Alt+E`,
    `${MOD}+Alt+1`,
    `${MOD}+Alt+2`,
    `${MOD}+Alt+3`,
    `${MOD}+Alt+4`,
    `${MOD}+Alt+5`,
    `${MOD}+Alt+6`,
    `${MOD}+Alt+7`,
    `${MOD}+Alt+8`,
    `${MOD}+Alt+9`,
    `${MOD}+Alt+0`,
  ],
};

// Shortcuts that legitimately leave the editor (close/exit/print/save-as
// dialogs owned by the browser or app) — the sweep does not press them.
const SKIP = new Set([
  `${MOD}+P`,
  `${MOD}+S`,
  `${MOD}+W`,
  `${MOD}+Q`,
  `${MOD}+N`,
  `${MOD}+O`,
  `${MOD}+T`,
  `${MOD}+Shift+N`,
  `${MOD}+Shift+T`,
  `${MOD}+Shift+W`,
  `${MOD}+R`,
  `${MOD}+Shift+R`,
  'F5',
  'F11',
  'F12',
  `${MOD}+F5`,
  'Shift+F5',
  `${MOD}+Shift+F5`,
  `${MOD}+Alt+I`,
  `${MOD}+Alt+J`,
  `${MOD}+Alt+C`,
  `${MOD}+Alt+U`,
  `${MOD}+Alt+F1`,
  'Alt+F4',
  'Alt+F1',
  'Alt+F2',
  'Alt+F5',
  'Alt+F6',
  'Alt+F7',
  'Alt+F8',
  'Alt+F9',
  'Alt+F10',
  'Alt+F11',
  'Alt+F12',
]);

type Verdict = {
  key: string;
  status: 'ok' | 'fatal-dialog' | 'asc_onError' | 'long-action-stuck' | 'not-loaded' | 'skipped';
  detail?: string;
};

type Doc = { label: string; fileName: string; b64: string; kind: 'word' | 'cell' | 'slide'; format: number };
const docs: Doc[] = [
  {
    label: 'docx',
    fileName: 'shortcut-sweep.docx',
    b64: toBase64(buildDocx('shortcut surface sweep')),
    kind: 'word',
    format: SAVE_FORMAT_CODE.docx,
  },
  {
    label: 'xlsx',
    fileName: 'shortcut-sweep.xlsx',
    b64: toBase64(buildXlsx()),
    kind: 'cell',
    format: SAVE_FORMAT_CODE.xlsx,
  },
  {
    label: 'pptx',
    fileName: 'shortcut-sweep.pptx',
    b64: toBase64(buildPptx('shortcut surface sweep')),
    kind: 'slide',
    format: SAVE_FORMAT_CODE.pptx,
  },
];

test.describe('shortcut surface sweep', () => {
  test.skip(!process.env.SHORTCUT_SWEEP, 'SHORTCUT_SWEEP not set - shortcut sweep is a local/nightly suite');
  test.describe.configure({ timeout: 600_000 });

  for (const doc of docs) {
    test(`keyboard shortcut sweep on ${doc.label}`, async ({ page, l0 }) => {
      // Shortcuts open dialogs and drive vendor code paths that log freely.
      l0.allowConsole(/./);
      l0.allowFrameError?.(/./);

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
      await typeIntoDocument(page, doc.kind, 'sweep');

      // Collect asc_onError inside the editor frame for the whole run.
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
        (window as any).__kbErrors = [];
        api.asc_registerCallback('asc_onError', (id: unknown, level: unknown) =>
          (window as any).__kbErrors.push(`${id}/${level}`),
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
            return { loaded: false, longAction: null, fatal: null, errors: (window as any).__kbErrors?.length ?? 0 };
          const { api, win } = found;
          let fatal: string | null = null;
          for (const el of Array.from(win.document.querySelectorAll('.asc-window, .modal, [role="dialog"]'))) {
            const he = el as HTMLElement;
            if (he.offsetParent !== null && /error occurred during the work|与文档工作/i.test(he.textContent || '')) {
              fatal = (he.textContent || '').trim().slice(0, 120);
              break;
            }
          }
          return {
            loaded: !!(api.isDocumentLoadComplete && api.isLoadFullApi),
            longAction: typeof api.isLongAction === 'function' ? !!api.isLongAction() : null,
            fatal,
            errors: (window as any).__kbErrors?.length ?? 0,
          };
        });

      const keys = [...COMMON, ...PER_KIND[doc.kind]];
      const verdicts: Verdict[] = [];
      let errorsSeen = 0;
      for (const key of keys) {
        if (SKIP.has(key)) {
          verdicts.push({ key, status: 'skipped' });
          continue;
        }
        await focusEditor(page);
        try {
          await page.keyboard.press(key);
        } catch (e) {
          verdicts.push({
            key,
            status: 'skipped',
            detail: `unpressable: ${String((e as Error).message).slice(0, 60)}`,
          });
          continue;
        }
        await page.waitForTimeout(120);
        // Close whatever the shortcut opened so the next key lands in the editor.
        await page.keyboard.press('Escape');
        await page.waitForTimeout(60);
        const s = await probe();
        if (s.fatal) verdicts.push({ key, status: 'fatal-dialog', detail: s.fatal });
        else if (s.errors > errorsSeen)
          verdicts.push({ key, status: 'asc_onError', detail: `+${s.errors - errorsSeen}` });
        else if (s.longAction) verdicts.push({ key, status: 'long-action-stuck' });
        else if (!s.loaded) verdicts.push({ key, status: 'not-loaded' });
        else verdicts.push({ key, status: 'ok' });
        errorsSeen = s.errors;
      }

      // Post-sweep: exit any lingering mode and prove the document still saves.
      await focusEditor(page);
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
      const health = await editorHealth(page);
      let saveResult: { bytes: number; ms: number; isZip: boolean } | { error: string };
      try {
        saveResult = await saveAndCapture(page, doc.format, 90_000);
      } catch (e) {
        saveResult = { error: String((e as Error).message) };
      }

      mkdirSync('test-results', { recursive: true });
      const report = `test-results/shortcut-surface-${doc.kind}.json`;
      writeFileSync(report, JSON.stringify({ doc: doc.label, kind: doc.kind, health, saveResult, verdicts }, null, 2));
      const counts = verdicts.reduce<Record<string, number>>(
        (acc, v) => ((acc[v.status] = (acc[v.status] || 0) + 1), acc),
        {},
      );
      const bad = verdicts.filter((v) => v.status !== 'ok' && v.status !== 'skipped');
      console.log(`SHORTCUT SWEEP ${doc.label}: ${JSON.stringify(counts)} -> ${report}`);
      for (const v of bad) console.log(`  ${v.status.padEnd(18)} ${v.key} ${v.detail ?? ''}`);
      console.log(
        `  post-sweep: loaded=${health.loaded} fatal=${health.fatalDialog} save=${JSON.stringify(saveResult)}`,
      );

      expect(
        verdicts.filter((v) => v.status === 'fatal-dialog'),
        'shortcuts that opened the fatal dialog',
      ).toEqual([]);
      expect(
        verdicts.filter((v) => v.status === 'long-action-stuck'),
        'shortcuts that left the long-action counter stuck',
      ).toEqual([]);
      expect(health.fatalDialog).toBeNull();
      expect(health.loaded).toBe(true);
      expect('error' in saveResult ? saveResult.error : 'ok', 'document must still save after the sweep').toBe('ok');
    });
  }
});
