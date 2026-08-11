import { afterEach, describe, expect, it, vi } from 'vitest';
import { CANVAS_PDF_INPUT_FORMAT, X2TConverter, hasEditorBinSignature } from '@ranuts/converter';

/**
 * X2TConverter wraps the x2t WASM module (loaded onto window.Module by the host).
 * Most methods require a real WASM instance and aren't unit-testable here, but a
 * few pieces of pure logic run before or alongside the WASM call and can be
 * exercised directly via the class's private members (TS-private, not
 * runtime-private) without booting the WASM module at all:
 *   - sanitizeFileName: pure string logic
 *   - convertCsvToXlsx: only touches window.XLSX (mocked below), never x2tModule
 *   - executeConversion's error-hint mapping: only needs a stubbed x2tModule.ccall
 */
describe('X2TConverter', () => {
  afterEach(() => {
    delete (window as any).XLSX;
  });

  describe('sanitizeFileName (private)', () => {
    const sanitize = (name: string) => (new X2TConverter() as any).sanitizeFileName(name);

    it('strips illegal, control, and unsafe characters but keeps the extension', () => {
      expect(sanitize('my/doc:name*?.docx')).toBe('mydocname.docx');
    });

    it('falls back to "file.bin" for empty or non-string input', () => {
      expect(sanitize('')).toBe('file.bin');
      expect(sanitize('   ')).toBe('file.bin');
      expect(sanitize(undefined as unknown as string)).toBe('file.bin');
    });

    it('falls back to "file" as the base name when sanitizing empties it out', () => {
      expect(sanitize('***.docx')).toBe('file.docx');
    });

    it('truncates very long base names to 200 characters', () => {
      const longName = `${'a'.repeat(300)}.docx`;
      const result = sanitize(longName);
      expect(result).toBe(`${'a'.repeat(200)}.docx`);
    });
  });

  describe('convertCsvToXlsx (private) — GitHub #33/#13 "can CSV files be opened"', () => {
    const convert = (data: Uint8Array, fileName: string) =>
      (new X2TConverter() as any).convertCsvToXlsx(data, fileName) as Promise<File>;

    const stubXlsx = (readSpy: ReturnType<typeof vi.fn>) => {
      (window as any).XLSX = {
        read: readSpy,
        write: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
      };
    };

    it('strips a UTF-8 BOM before handing text to SheetJS', async () => {
      const readSpy = vi.fn().mockReturnValue({});
      stubXlsx(readSpy);
      const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
      const body = new TextEncoder().encode('a,b\n1,2');
      const data = new Uint8Array([...bom, ...body]);

      await convert(data, 'sheet.csv');

      expect(readSpy).toHaveBeenCalledWith('a,b\n1,2', expect.objectContaining({ type: 'string' }));
    });

    it('decodes as UTF-8 directly when there is no BOM', async () => {
      const readSpy = vi.fn().mockReturnValue({});
      stubXlsx(readSpy);
      const data = new TextEncoder().encode('name,age\n李雷,20');

      await convert(data, 'sheet.csv');

      expect(readSpy).toHaveBeenCalledWith('name,age\n李雷,20', expect.objectContaining({ type: 'string' }));
    });

    it('returns an XLSX File with the .csv extension swapped to .xlsx', async () => {
      stubXlsx(vi.fn().mockReturnValue({}));

      const file = await convert(new TextEncoder().encode('a,b\n1,2'), 'report.csv');

      expect(file.name).toBe('report.xlsx');
      expect(file.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    });

    it('wraps SheetJS errors with actionable guidance instead of the raw parser error', async () => {
      (window as any).XLSX = {
        read: vi.fn(() => {
          throw new Error('bad csv');
        }),
      };

      await expect(convert(new TextEncoder().encode('garbage'), 'bad.csv')).rejects.toThrow(
        /Failed to convert CSV to XLSX.*bad csv.*convert your CSV file to XLSX format manually/s,
      );
    });
  });

  describe('convertDocument — empty CSV (GitHub #33/#13)', () => {
    it('rejects with "CSV file is empty" for a zero-byte CSV, without invoking x2t', async () => {
      const converter = new X2TConverter();
      // Bypass real WASM boot: convertDocument's CSV-empty check runs after
      // initialize() resolves, so stub it rather than loading window.Module.
      vi.spyOn(converter, 'initialize').mockResolvedValue({} as any);

      const emptyCsv = new File([], 'empty.csv', { type: 'text/csv' });

      await expect(converter.convertDocument(emptyCsv)).rejects.toThrow(/CSV file is empty/);
    });
  });

  describe('getDocumentType (private) — file-type detection', () => {
    it('recognizes csv as a supported (cell) type, not an "unsupported format" error', () => {
      expect(() => (new X2TConverter() as any).getDocumentType('csv')).not.toThrow();
    });

    it('throws "Unsupported file format" for an unknown extension', () => {
      expect(() => (new X2TConverter() as any).getDocumentType('xyz')).toThrow(/Unsupported file format: xyz/);
    });
  });

  describe('executeConversion error hints (private) — GitHub #49 "conversion fails"', () => {
    const runWithExitCode = (code: number) => {
      const converter = new X2TConverter();
      (converter as any).x2tModule = {
        ccall: vi.fn().mockReturnValue(code),
        FS: { readFile: vi.fn().mockReturnValue(new Uint8Array()) },
      };
      return () => (converter as any).executeConversion('/working/params.xml');
    };

    it('code 88 hints at an unsupported/legacy .doc binary format', () => {
      expect(runWithExitCode(88)).toThrow(/code: 88.*unsupported format \(\.doc binary format\)/s);
    });

    it('code 55 hints at DRM/encryption', () => {
      expect(runWithExitCode(55)).toThrow(/code: 55.*DRM-protected or encrypted/s);
    });

    it('an unmapped exit code still throws, without a hint suffix', () => {
      expect(runWithExitCode(999)).toThrow(/^Conversion failed with code: 999$/);
    });

    it('a zero exit code does not throw', () => {
      expect(runWithExitCode(0)).not.toThrow();
    });
  });

  describe('writeMediaFiles (private) — GitHub #72 "pasted image saves blank"', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    const makeConverter = () => {
      const converter = new X2TConverter();
      const writeFile = vi.fn();
      (converter as any).x2tModule = { FS: { writeFile } };
      return { converter, writeFile };
    };

    it('does nothing when no media map is given', async () => {
      const { converter, writeFile } = makeConverter();
      await (converter as any).writeMediaFiles(undefined);
      expect(writeFile).not.toHaveBeenCalled();
    });

    it('fetches each URL and writes its bytes into /working/media/', async () => {
      const bytes = new Uint8Array([1, 2, 3]);
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => bytes.buffer }));
      const { converter, writeFile } = makeConverter();

      await (converter as any).writeMediaFiles({ 'media/pasted.png': 'blob:http://localhost/abc' });

      expect(fetch).toHaveBeenCalledWith('blob:http://localhost/abc');
      expect(writeFile).toHaveBeenCalledWith('/working/media/pasted.png', new Uint8Array([1, 2, 3]));
    });

    it('adds the "media/" prefix when the key does not already have one', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new Uint8Array([9]).buffer }),
      );
      const { converter, writeFile } = makeConverter();

      await (converter as any).writeMediaFiles({ 'pasted.png': 'blob:http://localhost/abc' });

      expect(writeFile).toHaveBeenCalledWith('/working/media/pasted.png', new Uint8Array([9]));
    });

    it('skips an entry whose fetch fails without throwing or blocking the others', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(async (url: string) => {
          if (url.includes('bad')) return { ok: false };
          return { ok: true, arrayBuffer: async () => new Uint8Array([7]).buffer };
        }),
      );
      const { converter, writeFile } = makeConverter();

      await expect(
        (converter as any).writeMediaFiles({
          'media/bad.png': 'blob:http://localhost/bad',
          'media/good.png': 'blob:http://localhost/good',
        }),
      ).resolves.not.toThrow();

      expect(writeFile).toHaveBeenCalledTimes(1);
      expect(writeFile).toHaveBeenCalledWith('/working/media/good.png', new Uint8Array([7]));
    });
  });

  describe('hasEditorBinSignature / canvas render stream detection — "Print to PDF" exit code 80', () => {
    const signed = (sig: string) => new Uint8Array([...sig].map((c) => c.charCodeAt(0)).concat([0x3b, 0x76]));

    it('recognizes the four engine signatures', () => {
      for (const sig of ['DOCY', 'XLSY', 'PPTY', 'VSDY']) {
        expect(hasEditorBinSignature(signed(sig))).toBe(true);
      }
    });

    it('rejects unsigned data, short buffers, and near-miss signatures', () => {
      expect(hasEditorBinSignature(new Uint8Array([0x01, 0x02, 0x03, 0x04]))).toBe(false);
      expect(hasEditorBinSignature(new Uint8Array([0x44, 0x4f]))).toBe(false); // "DO" only
      expect(hasEditorBinSignature(new Uint8Array(0))).toBe(false);
      expect(hasEditorBinSignature(signed('DOCX'))).toBe(false);
    });

    const makeBinConverter = () => {
      const converter = new X2TConverter();
      const writeFile = vi.fn();
      vi.spyOn(converter, 'initialize').mockResolvedValue({} as any);
      (converter as any).x2tModule = {
        ccall: vi.fn().mockReturnValue(0),
        FS: {
          writeFile,
          readFile: vi.fn().mockReturnValue(new Uint8Array([1])),
        },
      };
      (converter as any).fontsLoaded = true; // skip the font fetch in loadFontsForPdf
      return { converter, writeFile };
    };

    const writtenParams = (writeFile: ReturnType<typeof vi.fn>): string =>
      writeFile.mock.calls.find(([path]) => path === '/working/params.xml')?.[1] as string;

    it('declares m_nFormatFrom 8196 for an unsigned render stream converted to PDF', async () => {
      const { converter, writeFile } = makeBinConverter();

      await converter.convertBinToDocument(new Uint8Array([0xde, 0xad, 0xbe, 0xef]), 'doc.xlsx', 'PDF');

      const params = writtenParams(writeFile);
      expect(params).toContain(`<m_nFormatFrom>${CANVAS_PDF_INPUT_FORMAT}</m_nFormatFrom>`);
      expect(params).toContain('<m_sFontDir>/working/fonts/</m_sFontDir>');
    });

    it('leaves a signed editor bin without an explicit input format (v7 behavior unchanged)', async () => {
      const { converter, writeFile } = makeBinConverter();

      await converter.convertBinToDocument(signed('XLSY'), 'doc.xlsx', 'XLSX');

      expect(writtenParams(writeFile)).not.toContain('<m_nFormatFrom>');
    });
  });
});
