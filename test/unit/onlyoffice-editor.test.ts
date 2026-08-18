import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('ranui/message', () => ({}));
vi.mock('ranuts/utils', () => ({
  createObjectURL: vi.fn().mockResolvedValue('blob:mock'),
}));
vi.mock('@ranuts/shared/store', () => ({
  getDocmentObj: vi.fn().mockReturnValue({ fileName: 'test.xlsx', file: undefined }),
}));
vi.mock('@ranuts/shared/i18n', () => ({
  getOnlyOfficeLang: vi.fn().mockReturnValue('en'),
  t: vi.fn((key: string) => key),
}));
vi.mock(import('@ranuts/shared/document-utils'), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, getMimeTypeFromExtension: vi.fn().mockReturnValue('image/png') };
});

import {
  awaitFontSystem,
  classifyOpenFailure,
  compactViewportCustomization,
  createEditorInstance,
  isCompactViewport,
  FONT_SYSTEM_WAIT_MS,
  resetCompactLayoutState,
  syncCompactLayout,
  getNormalizedFile,
  isFontSystemReady,
  openAttemptHoldsBytes,
  getReadonlyMode,
  getSavedFileMimeType,
  requestSaveDocument,
  setReadonlyMode,
  toUint8Array,
} from '../../lib/onlyoffice-editor';

function makeEditor(extra: Record<string, unknown> = {}) {
  return { sendCommand: vi.fn(), ...extra };
}

describe('onlyoffice-editor', () => {
  beforeEach(() => {
    setReadonlyMode(false);
    delete (window as any).editor;
  });

  afterEach(() => {
    delete (window as any).editor;
  });

  describe('getReadonlyMode / setReadonlyMode', () => {
    it('defaults to false', () => {
      expect(getReadonlyMode()).toBe(false);
    });

    it('returns true after setReadonlyMode(true)', () => {
      setReadonlyMode(true);
      expect(getReadonlyMode()).toBe(true);
    });

    it('returns false after toggling back', () => {
      setReadonlyMode(true);
      setReadonlyMode(false);
      expect(getReadonlyMode()).toBe(false);
    });

    it('sends processRightsChange command to the editor when one exists', () => {
      const editor = makeEditor();
      (window as any).editor = editor;

      setReadonlyMode(true);

      expect(editor.sendCommand).toHaveBeenCalledWith(expect.objectContaining({ command: 'processRightsChange' }));
    });

    it('prefers serviceCommand over sendCommand when the editor exposes both (v9 renamed it)', () => {
      const serviceCommand = vi.fn();
      const editor = makeEditor({ serviceCommand });
      (window as any).editor = editor;

      setReadonlyMode(true);

      expect(serviceCommand).toHaveBeenCalledWith(expect.objectContaining({ command: 'processRightsChange' }));
      expect(editor.sendCommand).not.toHaveBeenCalled();
    });

    it('does not throw when no editor is present', () => {
      expect(() => setReadonlyMode(true)).not.toThrow();
    });

    // Runtime toggling goes through the SDK restriction API inside the
    // same-origin editor iframe (Asc.c_oAscRestrictionType: 128 = view, 0 = none).
    describe('SDK restriction path', () => {
      function installRestrictionFrame() {
        const iframe = document.createElement('iframe');
        document.body.appendChild(iframe);
        const asc_setRestriction = vi.fn();
        const asc_removeRestriction = vi.fn();
        (iframe.contentWindow as any).Asc = { editor: { asc_setRestriction, asc_removeRestriction } };
        return { iframe, asc_setRestriction, asc_removeRestriction };
      }

      it('locks the live editor with the view restriction on setReadonlyMode(true)', () => {
        const { iframe, asc_setRestriction } = installRestrictionFrame();

        setReadonlyMode(true);

        expect(asc_setRestriction).toHaveBeenCalledWith(128);
        iframe.remove();
      });

      it('removes the view restriction and restores none on setReadonlyMode(false)', () => {
        const { iframe, asc_setRestriction, asc_removeRestriction } = installRestrictionFrame();

        setReadonlyMode(false);

        expect(asc_removeRestriction).toHaveBeenCalledWith(128);
        expect(asc_setRestriction).toHaveBeenCalledWith(0);
        iframe.remove();
      });
    });
  });

  describe('requestSaveDocument', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(async () => {
      // Advance past the 60 s timeout to flush any pending embeddedSaveRequest,
      // ensuring module state is clean for the next test.
      vi.runAllTimers();
      await Promise.resolve();
      vi.useRealTimers();
    });

    it('rejects immediately when no document is open', async () => {
      await expect(requestSaveDocument()).rejects.toThrow('No document is open');
    });

    it('rejects when the document is readonly', async () => {
      (window as any).editor = makeEditor({ downloadAs: vi.fn() });
      setReadonlyMode(true);

      await expect(requestSaveDocument()).rejects.toThrow('readonly');
    });

    it('rejects when editor does not support downloadAs', async () => {
      (window as any).editor = makeEditor(); // no downloadAs

      await expect(requestSaveDocument()).rejects.toThrow('downloadAs');
    });

    it('rejects when a save request is already in progress', async () => {
      const downloadAs = vi.fn();
      (window as any).editor = makeEditor({ downloadAs });

      const first = requestSaveDocument().catch(() => {});
      await expect(requestSaveDocument()).rejects.toThrow('already in progress');

      vi.runAllTimers();
      await first;
    });

    // The export path goes through the same-origin editor iframe's
    // asc_DownloadAs with a numeric file-type constant (see
    // triggerPersonalDownloadAs). Emulate the editor frame with a real
    // <iframe> whose window carries a fake fully-ready Asc API.
    function installEditorFrame() {
      const iframe = document.createElement('iframe');
      document.body.appendChild(iframe);
      const win = iframe.contentWindow as any;
      const requestedFileTypes: number[] = [];
      class FakeDownloadOptions {
        fileType: number;
        constructor(fileType: number) {
          this.fileType = fileType;
        }
      }
      win.Asc = {
        editor: {
          asc_DownloadAs: (options: { fileType: number }) => requestedFileTypes.push(options.fileType),
          isLoadFullApi: true,
          isDocumentLoadComplete: true,
        },
        asc_CDownloadOptions: FakeDownloadOptions,
      };
      return { iframe, requestedFileTypes };
    }

    it('fires the editor-frame export with the numeric file type, uppercase-normalised', async () => {
      const { iframe, requestedFileTypes } = installEditorFrame();
      (window as any).editor = makeEditor({ downloadAs: vi.fn() });

      const promise = requestSaveDocument('pdf').catch(() => {});
      // The readiness gate caps at SAVE_READY_WAIT_MS when onDocumentReady never fires.
      await vi.advanceTimersByTimeAsync(150_000);

      expect(requestedFileTypes).toEqual([513]); // oAscFileType.PDF
      iframe.remove();
      vi.runAllTimers();
      await promise;
    });

    it('requests XLSX from the editor for a CSV target (CSV export stalls on a delimiter dialog)', async () => {
      const { iframe, requestedFileTypes } = installEditorFrame();
      (window as any).editor = makeEditor({ downloadAs: vi.fn() });

      const promise = requestSaveDocument('csv').catch(() => {});
      await vi.advanceTimersByTimeAsync(150_000);

      expect(requestedFileTypes).toEqual([257]); // oAscFileType.XLSX
      iframe.remove();
      vi.runAllTimers();
      await promise;
    });

    it('rejects after the 180 s timeout if no save event arrives', async () => {
      const downloadAs = vi.fn();
      (window as any).editor = makeEditor({ downloadAs });

      const promise = requestSaveDocument();
      vi.advanceTimersByTime(180_001);
      await expect(promise).rejects.toThrow('timed out');
    });
  });

  describe('createEditorInstance editor config', () => {
    afterEach(() => {
      vi.useRealTimers();
      delete (window as any).DocsAPI;
      delete (window as any).editor;
    });

    async function createAndGetConfig(options: Parameters<typeof createEditorInstance>[0]) {
      vi.useFakeTimers();
      const DocEditor = vi.fn();
      (window as any).DocsAPI = { DocEditor };

      const promise = createEditorInstance(options);
      // Skip the internal cleanup delay (150ms when no prior editor exists).
      await vi.advanceTimersByTimeAsync(200);
      await promise;

      expect(DocEditor).toHaveBeenCalledTimes(1);
      return DocEditor.mock.calls[0][1] as any;
    }

    // The bytes are kept only so an environment-class open failure can be
    // retried with them (#144). Once the document is open that retry is
    // unreachable, and a third copy of a large document (the editor holds one,
    // the blob it mounted from another) is exactly the ballast that gets a
    // phone's canvas discarded under memory pressure (#145).
    it('releases the retry bytes once the document is open', async () => {
      const config = await createAndGetConfig({
        fileName: 'held.xlsx',
        fileType: 'xlsx',
        binData: new ArrayBuffer(1024),
      });

      expect(openAttemptHoldsBytes()).toBe(true);
      config.events.onDocumentReady();
      expect(openAttemptHoldsBytes()).toBe(false);
    });

    it('always passes a non-empty Guest user to avoid the getInitials crash (#25)', async () => {
      const config = await createAndGetConfig({
        fileName: 'preview.docx',
        fileType: 'docx',
        binData: new ArrayBuffer(8),
        readonly: true,
      });

      expect(config.editorConfig.user).toEqual({ id: 'local-user', name: 'Guest' });
      // readonly:true still mounts with full edit permissions: the lock is
      // applied post-load via asc_setRestriction so it stays togglable at
      // runtime (a view-mode mount could never switch back to edit).
      expect(config.editorConfig.mode).toBe('edit');
      expect(config.document.permissions.edit).toBe(true);
      expect(config.document.permissions.download).toBe(true);
    });

    it('routes PDF straight to the pdf editor (isForm:false) so the /apps/common loader is skipped', async () => {
      // The common loader re-navigates via href.match(/common\/index.html/),
      // which never matches behind a static host that 308s index.html to the
      // directory URL (Cloudflare Pages) -- production PDFs stayed on a blank
      // loader while every local build passed.
      const pdf = await createAndGetConfig({ fileName: 'a.pdf', fileType: 'pdf', binData: new ArrayBuffer(8) });
      expect(pdf.document.isForm).toBe(false);
      // The pdf app's offline protocol: it waits for the bytes the host hands
      // over (DocEditor.openDocument in onAppReady) instead of fetching
      // document.url like the other editors do.
      expect(pdf.document.localOpenFromBinary).toBe(true);
      expect(pdf.documentType).toBe('pdf');
    });

    it('does not set isForm for non-PDF documents', async () => {
      const docx = await createAndGetConfig({ fileName: 'a.docx', fileType: 'docx', binData: new ArrayBuffer(8) });
      expect(docx.document.isForm).toBeUndefined();
      expect(docx.document.localOpenFromBinary).toBeUndefined();
    });

    it('applies the view restriction on onDocumentReady when opened readonly', async () => {
      const config = await createAndGetConfig({
        fileName: 'preview.docx',
        fileType: 'docx',
        binData: new ArrayBuffer(8),
        readonly: true,
      });

      const iframe = document.createElement('iframe');
      document.body.appendChild(iframe);
      const asc_setRestriction = vi.fn();
      (iframe.contentWindow as any).Asc = { editor: { asc_setRestriction } };

      config.events.onDocumentReady();

      expect(asc_setRestriction).toHaveBeenCalledWith(128); // ASC_RESTRICTION_VIEW
      iframe.remove();
    });

    it('does not apply any restriction on onDocumentReady when opened editable', async () => {
      const config = await createAndGetConfig({
        fileName: 'edit.docx',
        fileType: 'docx',
        binData: new ArrayBuffer(8),
      });

      const iframe = document.createElement('iframe');
      document.body.appendChild(iframe);
      const asc_setRestriction = vi.fn();
      (iframe.contentWindow as any).Asc = { editor: { asc_setRestriction } };

      config.events.onDocumentReady();

      expect(asc_setRestriction).not.toHaveBeenCalled();
      iframe.remove();
    });

    it('opens document bytes through a blob URL with a fresh cache key', async () => {
      const config = await createAndGetConfig({
        fileName: 'Report.DOCX',
        fileType: 'DOCX',
        binData: new Uint8Array([0x50, 0x4b, 0x03, 0x04]).buffer,
      });

      expect(String(config.document.url)).toMatch(/^blob:/);
      expect(config.document.fileType).toBe('docx');
      expect(config.documentType).toBe('word');
      expect(config.document.key).toMatch(/^doc-/);
    });

    it('creates a blank document (no url) when binData is absent', async () => {
      const config = await createAndGetConfig({
        fileName: 'New_Document.xlsx',
        fileType: 'xlsx',
      });

      expect(config.document.url).toBeUndefined();
      expect(config.documentType).toBe('cell');
      // downloadAs only runs when the callback is declared -- see the config.
      expect(config.events.onDownloadAs).toBeTypeOf('function');
      expect(config.events.onDocumentReady).toBeTypeOf('function');
    });

    it('fully disables the spellchecker (mode + toggle), not just the toggle', async () => {
      const config = await createAndGetConfig({
        fileName: 'a.docx',
        fileType: 'docx',
      });

      expect(config.editorConfig.customization.features.spellcheck).toEqual({ mode: false, change: false });
    });

    it('defaults the interface theme to classic Office light', async () => {
      window.localStorage.removeItem('ui-theme-id');
      const config = await createAndGetConfig({ fileName: 'a.docx', fileType: 'docx' });
      expect(config.editorConfig.customization.uiTheme).toBe('theme-classic-light');
    });

    it('keeps a theme the user already picked inside the editor', async () => {
      window.localStorage.setItem('ui-theme-id', 'theme-dark');
      try {
        const config = await createAndGetConfig({ fileName: 'a.docx', fileType: 'docx' });
        expect(config.editorConfig.customization.uiTheme).toBe('theme-dark');
      } finally {
        window.localStorage.removeItem('ui-theme-id');
      }
    });

    it('follows a dark site theme when the user has not picked one in the editor', async () => {
      window.localStorage.removeItem('ui-theme-id');
      document.documentElement.setAttribute('data-ran-theme', 'dark');
      try {
        const config = await createAndGetConfig({ fileName: 'a.docx', fileType: 'docx' });
        expect(config.editorConfig.customization.uiTheme).toBe('theme-dark');
      } finally {
        document.documentElement.removeAttribute('data-ran-theme');
        window.localStorage.removeItem('ui-theme-site-driven');
      }
    });
  });

  describe('getSavedFileMimeType', () => {
    it.each([
      ['report.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      ['report.doc', 'application/msword'],
      ['data.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      ['data.xls', 'application/vnd.ms-excel'],
      ['data.csv', 'text/csv'],
      ['deck.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
      ['deck.ppt', 'application/vnd.ms-powerpoint'],
      ['document.pdf', 'application/pdf'],
      ['archive.zip', 'application/octet-stream'],
      ['no-extension', 'application/octet-stream'],
    ])('%s → %s', (fileName, expected) => {
      expect(getSavedFileMimeType(fileName)).toBe(expected);
    });

    it('is case-insensitive for the extension', () => {
      expect(getSavedFileMimeType('REPORT.DOCX')).toBe(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
    });
  });

  describe('getNormalizedFile', () => {
    it('preserves an already-typed file unchanged', () => {
      const file = new File(['data'], 'report.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const result = getNormalizedFile(file);
      expect(result.type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      expect(result.name).toBe('report.docx');
    });

    it('infers MIME type when file has no type', () => {
      const file = new File(['data'], 'data.xlsx', { type: '' });
      const result = getNormalizedFile(file);
      expect(result.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    });

    it('infers MIME type when file has generic octet-stream type', () => {
      const file = new File(['data'], 'deck.pptx', { type: 'application/octet-stream' });
      const result = getNormalizedFile(file);
      expect(result.type).toBe('application/vnd.openxmlformats-officedocument.presentationml.presentation');
    });

    it('preserves the original file name', () => {
      const file = new File(['data'], 'my-document.csv', { type: '' });
      expect(getNormalizedFile(file).name).toBe('my-document.csv');
    });
  });

  describe('toUint8Array', () => {
    it('returns the same Uint8Array instance when given a Uint8Array', () => {
      const arr = new Uint8Array([1, 2, 3]);
      expect(toUint8Array(arr)).toBe(arr);
    });

    it('wraps an ArrayBuffer in a Uint8Array', () => {
      const buf = new Uint8Array([4, 5, 6]).buffer;
      const result = toUint8Array(buf);
      expect(result).toBeInstanceOf(Uint8Array);
      expect(Array.from(result)).toEqual([4, 5, 6]);
    });

    it('handles a typed-array view (e.g. Int16Array) correctly', () => {
      const int16 = new Int16Array([256, 512]);
      const result = toUint8Array(int16);
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.byteLength).toBe(4); // 2 × 2 bytes
    });

    it('throws for unsupported types', () => {
      expect(() => toUint8Array('string data' as unknown as BlobPart)).toThrow('Unsupported saved data type');
    });
  });
});

// The open path's two readiness/classification predicates (GitHub #144). Both
// decide whether a perfectly good document is reported as unopenable, so they
// are pinned here; the surrounding wiring is covered by test/e2e/open-retry.
describe('open-conversion readiness and failure classification', () => {
  const fontSystem = (infos: unknown, fontFiles: unknown) => ({
    AscFonts: { g_font_infos: infos },
    AscCommon: { g_font_loader: { fontFiles } },
  });

  it('reports the font system as unready until the catalog is an array', () => {
    expect(isFontSystemReady({})).toBe(false);
    expect(isFontSystemReady(fontSystem(undefined, [{ Id: '000' }]))).toBe(false);
  });

  it('reports an empty catalog as ready (the vendor loop never dereferences)', () => {
    expect(isFontSystemReady(fontSystem([], undefined))).toBe(true);
  });

  it('requires the font files of a non-empty catalog (fontFiles[i].Id would throw)', () => {
    expect(isFontSystemReady(fontSystem([{ Name: 'Arial' }], undefined))).toBe(false);
    expect(isFontSystemReady(fontSystem([{ Name: 'Arial' }], []))).toBe(false);
    expect(isFontSystemReady(fontSystem([{ Name: 'Arial' }], [{ Id: '000' }]))).toBe(true);
  });

  it('classifies x2t verdicts on the bytes as document failures (no retry)', () => {
    expect(classifyOpenFailure('Document conversion failed: Error: Conversion failed with code: 88')).toBe('document');
    expect(classifyOpenFailure('Aborted(missing function: _ZN10CHtmlFile2C1Ev)')).toBe('document');
    expect(classifyOpenFailure('RuntimeError: memory access out of bounds')).toBe('document');
  });

  it('classifies editor boot-state and resource failures as environment failures', () => {
    expect(
      classifyOpenFailure("Document conversion failed: TypeError: Cannot read properties of undefined (reading 'Id')"),
    ).toBe('environment');
    expect(classifyOpenFailure('X2T module not found after script loading')).toBe('environment');
    expect(classifyOpenFailure('Document conversion failed: TypeError: Failed to fetch')).toBe('environment');
  });
});

// Phone-sized viewports (GitHub #145). Only the vendor's desktop bundle can
// open documents offline in this package, so a phone runs the desktop UI and
// its side panels have to be trimmed for the slide to be readable.
describe('compact viewport customization', () => {
  const metrics = (width: number, height: number, coarsePointer = false) => ({ width, height, coarsePointer });

  it('treats phone widths as compact and desktop widths as not', () => {
    expect(isCompactViewport(metrics(393, 851))).toBe(true);
    expect(isCompactViewport(metrics(600, 900))).toBe(true);
    expect(isCompactViewport(metrics(601, 900))).toBe(false);
    expect(isCompactViewport(metrics(1280, 900))).toBe(false);
    // A zero width means "no window" (SSR, tests): never guess compact.
    expect(isCompactViewport(metrics(0, 0))).toBe(false);
  });

  it('counts a phone held in landscape, whose width alone looks roomy', () => {
    // 851x393 on a touch device: wide, but the desktop chrome leaves a slide
    // 498 px and 23 % zoom, which is the layout #145 is about.
    expect(isCompactViewport(metrics(851, 393, true))).toBe(true);
    expect(isCompactViewport(metrics(851, 393, false))).toBe(false);
    // A short but wide desktop window keeps its panels.
    expect(isCompactViewport(metrics(1400, 500, false))).toBe(false);
    // Tablets have room in both orientations.
    expect(isCompactViewport(metrics(1024, 768, true))).toBe(false);
  });

  it('carries only settings with no runtime switch', () => {
    const customization = compactViewportCustomization() as Record<string, unknown>;
    expect(customization.compactHeader).toBe(true);
    expect(customization.zoom).toBe(-2);
    // Everything the editor can toggle at runtime must NOT be here: the vendor
    // applies customization once, at boot, and `layout: { rightMenu: false }`
    // in particular writes an inline display:none that no later widening can
    // undo. Those pieces go through syncCompactLayout instead.
    expect(customization.layout).toBeUndefined();
    expect(customization.hideNotes).toBeUndefined();
    expect(customization.hideRulers).toBeUndefined();
  });
});

// The open conversion must wait for the font system rather than walk a
// half-built one (GitHub #144). The wait has to stay bounded: a font system
// that never comes up degrades to a fontless import, it must not hang the open.
describe('awaitFontSystem', () => {
  const ready = () => ({
    AscFonts: { g_font_infos: [{ Name: 'Arial' }] },
    AscCommon: { g_font_loader: { fontFiles: [{ Id: '000' }] } },
  });
  const notReady = () => ({ AscFonts: {}, AscCommon: { g_font_loader: {} } });

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('delegates immediately when the font system is already up (the normal path)', () => {
    const original = vi.fn();
    const cb = vi.fn();
    awaitFontSystem(ready(), original, cb);
    expect(original).toHaveBeenCalledWith(cb);
    expect(cb).not.toHaveBeenCalled();
    // Nothing is scheduled, so a ready font system costs no time at all.
    expect(vi.getTimerCount()).toBe(0);
  });

  it('delegates as soon as a late font system comes up', () => {
    const win: any = notReady();
    const original = vi.fn();
    const cb = vi.fn();
    awaitFontSystem(win, original, cb, { timeoutMs: 1000, intervalMs: 50 });
    vi.advanceTimersByTime(200);
    expect(original).not.toHaveBeenCalled();
    win.AscFonts.g_font_infos = [{ Name: 'Arial' }];
    win.AscCommon.g_font_loader.fontFiles = [{ Id: '000' }];
    vi.advanceTimersByTime(50);
    expect(original).toHaveBeenCalledWith(cb);
    expect(cb).not.toHaveBeenCalled();
    expect(win.__ooFontWaitMs).toBe(250);
  });

  it('falls back to a fontless import when the font system never comes up', () => {
    const win: any = notReady();
    const original = vi.fn();
    const cb = vi.fn();
    awaitFontSystem(win, original, cb, { timeoutMs: 500, intervalMs: 50 });
    vi.advanceTimersByTime(500);
    expect(original).not.toHaveBeenCalled();
    expect(cb).toHaveBeenCalledWith([]);
    expect(win.__ooFontWaitMs).toBe(500);
    // Bounded: no timer is left running to fire again.
    expect(vi.getTimerCount()).toBe(0);
  });

  it('survives the editor frame disappearing while it waits', () => {
    const win: any = notReady();
    // What a torn-down frame looks like from here: touching it throws.
    const original = vi.fn(() => {
      throw new Error('Cannot access a dead realm');
    });
    const cb = vi.fn(() => {
      throw new Error('Cannot access a dead realm');
    });
    awaitFontSystem(win, original, cb, { timeoutMs: 200, intervalMs: 50 });
    win.AscFonts.g_font_infos = [{ Name: 'Arial' }];
    win.AscCommon.g_font_loader.fontFiles = [{ Id: '000' }];
    // Would otherwise throw out of a timer, i.e. uncaught in the host page.
    expect(() => vi.advanceTimersByTime(50)).not.toThrow();
    expect(original).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  // The vendor's fetchFonts throws synchronously when it walks a font system
  // that is up but incomplete, and x2t_helper only settles the conversion from
  // inside the callback (`new Promise(resolve => AscCommon.fetchFonts(...))`).
  // Swallowing that throw without answering the callback is therefore not a
  // degradation but a permanent spinner -- exactly what installOpenFailureGuard
  // exists to prevent -- so the wait falls back to the fontless import.
  it('answers a throwing vendor fetchFonts with a fontless import, never with silence', () => {
    const win: any = notReady();
    const original = vi.fn(() => {
      throw new TypeError("Cannot read properties of undefined (reading 'Id')");
    });
    const cb = vi.fn();
    awaitFontSystem(win, original, cb, { timeoutMs: 500, intervalMs: 50 });
    win.AscFonts.g_font_infos = [{ Name: 'Arial' }];
    win.AscCommon.g_font_loader.fontFiles = [{ Id: '000' }];
    expect(() => vi.advanceTimersByTime(50)).not.toThrow();
    expect(original).toHaveBeenCalledTimes(1);
    // The conversion gets its answer, and only one of them.
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not answer twice when the vendor takes the callback', () => {
    const win: any = notReady();
    const original = vi.fn();
    const cb = vi.fn();
    awaitFontSystem(win, original, cb, { timeoutMs: 500, intervalMs: 50 });
    win.AscFonts.g_font_infos = [{ Name: 'Arial' }];
    win.AscCommon.g_font_loader.fontFiles = [{ Id: '000' }];
    vi.advanceTimersByTime(50);
    expect(original).toHaveBeenCalledWith(cb);
    // The vendor owns the callback from here; the fallback must stay out.
    expect(cb).not.toHaveBeenCalled();
  });

  it('stops polling when reading the frame itself starts throwing', () => {
    // The synchronous entry is deliberately unguarded (it runs inside the
    // caller's promise executor, which turns a throw into a rejected open), so
    // the frame only dies once the wait is already on the timer.
    let alive = true;
    const win: any = {
      AscCommon: { g_font_loader: {} },
      get AscFonts(): Record<string, unknown> {
        if (!alive) throw new Error('Cannot access a dead realm');
        return {};
      },
    };
    const original = vi.fn();
    const cb = vi.fn();
    awaitFontSystem(win, original, cb, { timeoutMs: 500, intervalMs: 50 });
    alive = false;
    // An uncaught throw here would also leave the interval running forever.
    expect(() => vi.advanceTimersByTime(50)).not.toThrow();
    expect(vi.getTimerCount()).toBe(0);
    expect(original).not.toHaveBeenCalled();
  });

  it('keeps the default wait short enough to stay under the save readiness budget', () => {
    expect(FONT_SYSTEM_WAIT_MS).toBeLessThanOrEqual(10_000);
  });
});

// syncCompactLayout tracks which side of the compact threshold the layout is
// on, and returns early when nothing changed. Recording a sync that never
// reached the editor would therefore silence every later one.
describe('syncCompactLayout state tracking', () => {
  const originalWidth = window.innerWidth;

  function installEditorFrameWithRulers() {
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    const asc_SetViewRulers = vi.fn();
    (iframe.contentWindow as any).Asc = {
      editor: {
        asc_setRestriction: vi.fn(),
        asc_SetViewRulers,
        asc_GetViewRulers: () => true,
      },
    };
    return { iframe, asc_SetViewRulers };
  }

  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, 'innerWidth', { value: 400, configurable: true });
    resetCompactLayoutState();
  });

  afterEach(() => {
    vi.runAllTimers();
    vi.useRealTimers();
    Object.defineProperty(window, 'innerWidth', { value: originalWidth, configurable: true });
    document.querySelectorAll('iframe').forEach((frame) => frame.remove());
  });

  it('still applies once the editor arrives after a sync that found none', () => {
    // A resize that lands between destroyEditor and the next onDocumentReady.
    syncCompactLayout('docx');

    const { asc_SetViewRulers } = installEditorFrameWithRulers();
    syncCompactLayout('docx');

    expect(asc_SetViewRulers).toHaveBeenCalledWith(false);
  });

  it('does not re-apply once the layout is already on that side', () => {
    const { asc_SetViewRulers } = installEditorFrameWithRulers();
    syncCompactLayout('docx');
    syncCompactLayout('docx');

    expect(asc_SetViewRulers).toHaveBeenCalledTimes(1);
  });
});
