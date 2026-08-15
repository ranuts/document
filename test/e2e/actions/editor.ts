import type { Page } from '@playwright/test';

/**
 * Editor action library (docs/superpowers/plans/2026-08-15-v9-test-coverage-strategy.md
 * section 9.1 step 3). Shared by embed-regression, the corpus matrix and the
 * interaction-surface sweeps so every suite drives the editor the same way.
 *
 * All helpers run against embed-demo.html (which exposes `post()`), locate
 * the innermost SDK instance (`Asc.editor` in the editor frame), and use
 * TRUSTED input (page.keyboard) for edits -- synthetic DOM events do not
 * reach the canvas.
 *
 * Harness pitfalls this library encodes (each cost real investigation time):
 *   - document:opened resolves when the editor is constructed, not when the
 *     document is loaded; gate on isDocumentLoadComplete && isLoadFullApi.
 *   - asc_DownloadAs is silently dropped before that gate.
 *   - the save stream is posted up the parent chain; listen in the SAME
 *     realm as the evaluate() and never compare `instanceof ArrayBuffer`
 *     across frames.
 *   - the app-level `window.editor` one frame up is the DocEditor wrapper,
 *     not the SDK instance.
 *   - page.evaluate serializes the callback's SOURCE; every evaluate below
 *     therefore inlines the frame-walk itself instead of importing a shared
 *     function (an imported helper is not in scope on the page side).
 */

export type EditorKind = 'word' | 'cell' | 'slide';

export const SAVE_FORMAT_CODE = { docx: 65, xlsx: 257, pptx: 129, pdf: 513 } as const;

/** Wait until the SDK instance exists and reports the document fully loaded. */
export async function waitForEditorReady(
  page: Page,
  timeoutMs = 120_000,
): Promise<{ kind: EditorKind; loadMs: number }> {
  return page.evaluate(async (timeoutMs) => {
    const t0 = Date.now();
    const findSdk = (): { api: any; win: any } | null => {
      const visit = (win: Window): { api: any; win: any } | null => {
        try {
          const scope = win as any;
          const api = scope.Asc && scope.Asc.editor;
          if (api && typeof api.asc_registerCallback === 'function') return { api, win };
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
    let found = findSdk();
    while (!found && Date.now() - t0 < timeoutMs) {
      await new Promise((r) => setTimeout(r, 250));
      found = findSdk();
    }
    if (!found) throw new Error('editor SDK instance never appeared');
    const { api, win } = found;
    while (!(api.isDocumentLoadComplete && api.isLoadFullApi) && Date.now() - t0 < timeoutMs) {
      await new Promise((r) => setTimeout(r, 250));
    }
    if (!(api.isDocumentLoadComplete && api.isLoadFullApi)) {
      throw new Error(
        `document not ready after ${timeoutMs}ms (isDocumentLoadComplete=${api.isDocumentLoadComplete}, isLoadFullApi=${api.isLoadFullApi})`,
      );
    }
    const path = String(win.location.pathname);
    const kind: EditorKind = /spreadsheeteditor/.test(path)
      ? 'cell'
      : /presentationeditor/.test(path)
        ? 'slide'
        : 'word';
    // Let the first layout pass settle before anyone starts typing.
    await new Promise((r) => setTimeout(r, 1500));
    return { kind, loadMs: Date.now() - t0 };
  }, timeoutMs);
}

/** Focus the editor's hidden keyboard-capture textarea so page.keyboard reaches the canvas. */
export async function focusEditor(page: Page): Promise<void> {
  await page.evaluate(() => {
    const visit = (win: Window): boolean => {
      try {
        const scope = win as any;
        if (scope.Asc && scope.Asc.editor && typeof scope.Asc.editor.asc_registerCallback === 'function') {
          (win.document.getElementById('area_id') as HTMLElement | null)?.focus();
          return true;
        }
      } catch {
        /* cross-origin */
      }
      for (let i = 0; i < win.frames.length; i++) if (visit(win.frames[i])) return true;
      return false;
    };
    if (!visit(window)) throw new Error('editor SDK instance not found');
  });
}

/**
 * Put the caret somewhere text can be typed, per editor kind, then type.
 * word: start of document; cell: first empty row below used range;
 * slide: enter the first placeholder on the current slide.
 */
export async function typeIntoDocument(page: Page, kind: EditorKind, text: string): Promise<void> {
  await focusEditor(page);
  if (kind === 'cell') {
    await page.keyboard.press('Control+End');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.type(text, { delay: 40 });
    await page.keyboard.press('Enter');
  } else if (kind === 'slide') {
    // Tab cycles placeholders; Enter enters text-edit mode of the selected one.
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await page.keyboard.type(text, { delay: 40 });
    await page.keyboard.press('Escape');
  } else {
    await page.keyboard.press('Control+Home');
    await page.keyboard.type(text, { delay: 40 });
  }
  await page.waitForTimeout(600);
}

/**
 * Trigger a save through the SDK exactly as the toolbar does and capture the
 * resulting file stream. Resolves with the stream size, or rejects on timeout.
 */
export async function saveAndCapture(
  page: Page,
  formatCode: number,
  timeoutMs = 120_000,
): Promise<{ bytes: number; ms: number; isZip: boolean; head: number[] }> {
  return page.evaluate(
    async ({ formatCode, timeoutMs }) => {
      const findSdk = (): { api: any; win: any } | null => {
        const visit = (win: Window): { api: any; win: any } | null => {
          try {
            const scope = win as any;
            const api = scope.Asc && scope.Asc.editor;
            if (api && typeof api.asc_registerCallback === 'function') return { api, win };
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
      const found = findSdk();
      if (!found) throw new Error('editor SDK instance not found');
      const { api, win } = found;
      if (!(api.isDocumentLoadComplete && api.isLoadFullApi))
        throw new Error('save requested before the editor was ready');
      const isArrayBuffer = (v: unknown) => Object.prototype.toString.call(v) === '[object ArrayBuffer]';
      const started = Date.now();
      const stream = new Promise<{ bytes: number; head: number[] }>((resolve) => {
        const onMsg = (e: MessageEvent) => {
          const d = e.data;
          if (d && d.type === 'onlyoffice-file-stream' && isArrayBuffer(d.buffer)) {
            window.removeEventListener('message', onMsg);
            const b = new Uint8Array(d.buffer);
            resolve({ bytes: b.byteLength, head: Array.from(b.slice(0, 4)) });
          }
        };
        window.addEventListener('message', onMsg);
      });
      api.asc_DownloadAs(new win.Asc.asc_CDownloadOptions(formatCode));
      const out = await Promise.race([
        stream,
        new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error(`save timed out after ${timeoutMs}ms`)), timeoutMs),
        ),
      ]);
      return { ...out, ms: Date.now() - started, isZip: out.head[0] === 0x50 && out.head[1] === 0x4b };
    },
    { formatCode, timeoutMs },
  );
}

/** Snapshot of the SDK's own health signals, for L0-style assertions between actions. */
export async function editorHealth(page: Page): Promise<{
  loaded: boolean;
  canSave: boolean;
  fatalDialog: string | null;
  restrictions: number | null;
}> {
  return page.evaluate(() => {
    const visit = (win: Window): { api: any; win: any } | null => {
      try {
        const scope = win as any;
        const api = scope.Asc && scope.Asc.editor;
        if (api && typeof api.asc_registerCallback === 'function') return { api, win };
      } catch {
        /* cross-origin */
      }
      for (let i = 0; i < win.frames.length; i++) {
        const found = visit(win.frames[i]);
        if (found) return found;
      }
      return null;
    };
    const found = visit(window);
    if (!found) return { loaded: false, canSave: false, fatalDialog: null, restrictions: null };
    const { api, win } = found;
    let fatalDialog: string | null = null;
    for (const el of Array.from(win.document.querySelectorAll('.asc-window, .modal, [role="dialog"]'))) {
      const he = el as HTMLElement;
      if (he.offsetParent !== null && /error occurred during the work|与文档工作/i.test(he.textContent || '')) {
        fatalDialog = (he.textContent || '').trim().slice(0, 160);
        break;
      }
    }
    return {
      loaded: !!(api.isDocumentLoadComplete && api.isLoadFullApi),
      canSave: !!api.isDocumentCanSave,
      fatalDialog,
      restrictions: typeof api.restrictions === 'number' ? api.restrictions : null,
    };
  });
}
