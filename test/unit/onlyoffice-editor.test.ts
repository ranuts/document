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
  createEditorInstance,
  getNormalizedFile,
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
      // The readiness gate caps at 45 s when onDocumentReady never fires.
      await vi.advanceTimersByTimeAsync(45_000);

      expect(requestedFileTypes).toEqual([513]); // oAscFileType.PDF
      iframe.remove();
      vi.runAllTimers();
      await promise;
    });

    it('requests XLSX from the editor for a CSV target (CSV export stalls on a delimiter dialog)', async () => {
      const { iframe, requestedFileTypes } = installEditorFrame();
      (window as any).editor = makeEditor({ downloadAs: vi.fn() });

      const promise = requestSaveDocument('csv').catch(() => {});
      await vi.advanceTimersByTimeAsync(45_000);

      expect(requestedFileTypes).toEqual([257]); // oAscFileType.XLSX
      iframe.remove();
      vi.runAllTimers();
      await promise;
    });

    it('rejects after 60 s timeout if no save event arrives', async () => {
      const downloadAs = vi.fn();
      (window as any).editor = makeEditor({ downloadAs });

      const promise = requestSaveDocument();
      vi.advanceTimersByTime(60_001);
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
