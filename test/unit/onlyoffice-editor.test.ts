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
vi.mock('../../lib/file-types', () => ({ c_oAscFileType2: { 65: 'XLSX', 43: 'DOCX' } }));
vi.mock('@ranuts/shared/document-utils', () => ({ getMimeTypeFromExtension: vi.fn().mockReturnValue('image/png') }));

import {
  createEditorInstance,
  extractRequestedDownloadFormat,
  getNormalizedFile,
  getReadonlyMode,
  getSavedFileMimeType,
  patchDownloadOptionsFileTypeCapture,
  requestSaveDocument,
  setConverterCallbacks,
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

    it('normalises the target extension to uppercase', () => {
      const downloadAs = vi.fn();
      (window as any).editor = makeEditor({ downloadAs });

      void requestSaveDocument('xlsx').catch(() => {});

      expect(downloadAs).toHaveBeenCalledWith('XLSX');
    });

    it('defaults target extension to XLSX', () => {
      const downloadAs = vi.fn();
      (window as any).editor = makeEditor({ downloadAs });

      void requestSaveDocument().catch(() => {});

      expect(downloadAs).toHaveBeenCalledWith('XLSX');
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

    it('always passes a non-empty Guest user to avoid the getInitials crash (#25)', async () => {
      vi.useFakeTimers();
      const DocEditor = vi.fn();
      (window as any).DocsAPI = { DocEditor };

      const promise = createEditorInstance({
        fileName: 'preview.docx',
        fileType: 'docx',
        binData: new ArrayBuffer(8),
        readonly: true,
      });
      // Skip the internal cleanup delay (150ms when no prior editor exists).
      await vi.advanceTimersByTimeAsync(200);
      await promise;

      expect(DocEditor).toHaveBeenCalledTimes(1);
      const config = DocEditor.mock.calls[0][1] as any;
      expect(config.editorConfig.user).toEqual({ id: 'guest', name: 'Guest' });
      // readonly:true must disable edit + download permissions.
      expect(config.document.permissions.edit).toBe(false);
      expect(config.document.permissions.download).toBe(false);
    });

    it('sends binData as a base64 string to asc_openDocument (#113)', async () => {
      vi.useFakeTimers();
      const DocEditor = vi.fn();
      (window as any).DocsAPI = { DocEditor };
      const original = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 9, 8, 7]);

      const promise = createEditorInstance({
        fileName: 'report.docx',
        fileType: 'docx',
        binData: original.buffer,
      });
      await vi.advanceTimersByTimeAsync(200);
      await promise;

      const config = DocEditor.mock.calls[0][1] as any;
      const editor = { sendCommand: vi.fn() };
      (window as any).editor = editor;
      config.events.onAppReady();

      const call = editor.sendCommand.mock.calls.find((c: any[]) => c[0].command === 'asc_openDocument');
      expect(call).toBeDefined();
      const buf = call![0].data.buf;
      expect(typeof buf).toBe('string');
      const decoded = Uint8Array.from(atob(buf), (c) => c.charCodeAt(0));
      expect(Array.from(decoded)).toEqual(Array.from(original));
    });

    it('passes a string binData (empty-template case) through to asc_openDocument unchanged', async () => {
      vi.useFakeTimers();
      const DocEditor = vi.fn();
      (window as any).DocsAPI = { DocEditor };

      const promise = createEditorInstance({
        fileName: 'New_Document.docx',
        fileType: 'docx',
        binData: 'already-base64==',
      });
      await vi.advanceTimersByTimeAsync(200);
      await promise;

      const config = DocEditor.mock.calls[0][1] as any;
      const editor = { sendCommand: vi.fn() };
      (window as any).editor = editor;
      config.events.onAppReady();

      const call = editor.sendCommand.mock.calls.find((c: any[]) => c[0].command === 'asc_openDocument');
      expect(call![0].data.buf).toBe('already-base64==');
    });

    it('does not add v9-only editorConfig fields or the onSaveDocument event under the default (v7) test mode', async () => {
      vi.useFakeTimers();
      const DocEditor = vi.fn();
      (window as any).DocsAPI = { DocEditor };

      const promise = createEditorInstance({
        fileName: 'report.docx',
        fileType: 'docx',
        binData: new ArrayBuffer(4),
      });
      await vi.advanceTimersByTimeAsync(200);
      await promise;

      const config = DocEditor.mock.calls[0][1] as any;
      expect(config.editorConfig.canCoAuthoring).toBeUndefined();
      expect(config.editorConfig.coEditing).toBeUndefined();
      expect(config.events.onSave).toBeTypeOf('function');
      expect(config.events.onSaveDocument).toBeUndefined();
    });

    describe('handleSaveDocument (via events.onSave)', () => {
      async function createAndGetOnSave() {
        vi.useFakeTimers();
        const DocEditor = vi.fn();
        (window as any).DocsAPI = { DocEditor };

        const promise = createEditorInstance({
          fileName: 'report.docx',
          fileType: 'docx',
          binData: new ArrayBuffer(4),
        });
        await vi.advanceTimersByTimeAsync(200);
        await promise;

        (window as any).editor = makeEditor();
        const config = DocEditor.mock.calls[0][1] as any;
        return config.events.onSave as (event: unknown) => Promise<void>;
      }

      it('handles the v7 nested-object event shape', async () => {
        const convertAndDownload = vi.fn().mockResolvedValue({ fileName: 'report.docx', data: new Uint8Array([1]) });
        setConverterCallbacks({ convert: vi.fn(), convertAndDownload });
        const onSave = await createAndGetOnSave();

        const savedBytes = new Uint8Array([1, 2, 3]);
        await onSave({ data: { data: { data: savedBytes }, option: { outputformat: 65 } } });

        expect(convertAndDownload).toHaveBeenCalledWith(savedBytes, 'test.xlsx', 'XLSX', {});
      });

      it('handles the v9 raw-ArrayBuffer event shape', async () => {
        const convertAndDownload = vi.fn().mockResolvedValue({ fileName: 'report.docx', data: new Uint8Array([1]) });
        setConverterCallbacks({ convert: vi.fn(), convertAndDownload });
        const onSave = await createAndGetOnSave();

        const savedBuffer = new Uint8Array([4, 5, 6]).buffer;
        await onSave({ data: savedBuffer });

        const [bytesArg] = convertAndDownload.mock.calls.at(-1)!;
        expect(Array.from(bytesArg as Uint8Array)).toEqual([4, 5, 6]);
      });
    });
  });

  describe('setConverterCallbacks', () => {
    it('accepts converter and convertAndDownload functions without throwing', () => {
      expect(() =>
        setConverterCallbacks({
          convert: vi.fn(),
          convertAndDownload: vi.fn(),
        }),
      ).not.toThrow();
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

  // Print to PDF / Export to PDF (and any "save as a different format" action)
  // silently saved in the ORIGINAL file's format instead of the one actually
  // requested, because asc_DownloadAs's options object exposes no public
  // getter for the file type it was constructed with, and the internal
  // property holding it isn't even stable across construction call sites
  // (confirmed live: `oV` from a direct construction vs `V_` from the same
  // build's Print controller). patchDownloadOptionsFileTypeCapture +
  // extractRequestedDownloadFormat fix this by tagging instances at
  // construction time instead of reading an internal field. See the
  // 2026-08-09 print-to-pdf-ignores-target-format exploration doc.
  describe('patchDownloadOptionsFileTypeCapture / extractRequestedDownloadFormat', () => {
    it('tags a constructed instance with its first constructor argument', () => {
      class FakeDownloadOptions {
        constructor(public fileType: number) {}
      }
      const iwin = { Asc: { asc_CDownloadOptions: FakeDownloadOptions } };

      patchDownloadOptionsFileTypeCapture(iwin);
      const instance = new iwin.Asc.asc_CDownloadOptions(65);

      expect(extractRequestedDownloadFormat(instance)).toBe('XLSX');
    });

    it('preserves the original constructor behaviour (instance still usable normally)', () => {
      class FakeDownloadOptions {
        public fileType: number;
        constructor(fileType: number) {
          this.fileType = fileType;
        }
      }
      const iwin = { Asc: { asc_CDownloadOptions: FakeDownloadOptions } };

      patchDownloadOptionsFileTypeCapture(iwin);
      const instance = new iwin.Asc.asc_CDownloadOptions(43);

      expect(instance).toBeInstanceOf(FakeDownloadOptions);
      expect(instance.fileType).toBe(43);
    });

    it('is idempotent -- patching twice does not double-wrap the constructor', () => {
      class FakeDownloadOptions {
        constructor(public fileType: number) {}
      }
      const iwin = { Asc: { asc_CDownloadOptions: FakeDownloadOptions } };

      patchDownloadOptionsFileTypeCapture(iwin);
      const onceWrapped = iwin.Asc.asc_CDownloadOptions;
      patchDownloadOptionsFileTypeCapture(iwin);

      expect(iwin.Asc.asc_CDownloadOptions).toBe(onceWrapped);
    });

    it('does nothing when asc_CDownloadOptions is not a function', () => {
      const iwin = { Asc: {} };
      expect(() => patchDownloadOptionsFileTypeCapture(iwin)).not.toThrow();
    });

    it('does nothing when iwin/Asc is undefined', () => {
      expect(() => patchDownloadOptionsFileTypeCapture(undefined)).not.toThrow();
      expect(() => patchDownloadOptionsFileTypeCapture({})).not.toThrow();
    });

    it.each([
      [undefined, null],
      [null, null],
      ['a string', null],
      [42, null],
      [{}, null], // untagged object
      [{ __ooRequestedFileType: 'not-a-number' }, null],
      [{ __ooRequestedFileType: 999999 }, null], // no c_oAscFileType2 mapping
      [{ __ooRequestedFileType: 65 }, 'XLSX'],
      [{ __ooRequestedFileType: 43 }, 'DOCX'],
    ])('extractRequestedDownloadFormat(%j) → %j', (input, expected) => {
      expect(extractRequestedDownloadFormat(input)).toBe(expected);
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
