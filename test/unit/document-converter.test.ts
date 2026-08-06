import { afterEach, describe, expect, it, vi } from 'vitest';
import { X2TConverter } from '@ranuts/converter';

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
});
