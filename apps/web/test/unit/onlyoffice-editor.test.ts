import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('ranui/message', () => ({}));
vi.mock('ranuts/utils', () => ({
  createObjectURL: vi.fn().mockResolvedValue('blob:mock'),
  getCookie: vi.fn().mockReturnValue(null),
  getQuery: vi.fn().mockReturnValue(null),
  localStorageGetItem: vi.fn().mockReturnValue(null),
  localStorageSetItem: vi.fn(),
  getMime: vi.fn().mockReturnValue('application/octet-stream'),
  getExtensions: vi.fn().mockReturnValue(['docx']),
  scriptOnLoad: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@ranuts/core', () => ({ c_oAscFileType2: { 65: 'XLSX', 43: 'DOCX' }, oAscFileType: {} }));

import {
  getNormalizedFile,
  getReadonlyMode,
  getSavedFileMimeType,
  requestSaveDocument,
  setConverterCallbacks,
  setDocumentStateGetter,
  setReadonlyMode,
  toUint8Array,
} from '@ranuts/editor-v9';

function makeEditor(extra: Record<string, unknown> = {}) {
  return { sendCommand: vi.fn(), ...extra };
}

describe('onlyoffice-editor', () => {
  beforeEach(() => {
    setReadonlyMode(false);
    setDocumentStateGetter(() => ({ fileName: 'test.xlsx', file: undefined }));
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
