import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CANVAS_PDF_INPUT_FORMAT,
  X2TConverter,
  hasEditorBinSignature,
  isHtmlDocument,
  isZipContainer,
} from '@ranuts/converter';

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

    it('decodes GBK bytes (Excel zh-CN "ANSI" CSV) instead of producing U+FFFD mojibake', async () => {
      const readSpy = vi.fn().mockReturnValue({});
      stubXlsx(readSpy);
      // "姓名,值\n张三,1" encoded as GBK: 姓=0xD0D5 名=0xC3FB 张=0xD5C5 三=0xC8FD
      const data = new Uint8Array([0xd0, 0xd5, 0xc3, 0xfb, 0x2c, 0xd6, 0xb5, 0x0a, 0xd5, 0xc5, 0xc8, 0xfd, 0x2c, 0x31]);

      await convert(data, 'gbk.csv');

      expect(readSpy).toHaveBeenCalledWith('姓名,值\n张三,1', expect.objectContaining({ type: 'string' }));
    });

    it('falls back to latin1 for bytes invalid in both UTF-8 and GB18030', async () => {
      const readSpy = vi.fn().mockReturnValue({});
      stubXlsx(readSpy);
      // "café,1" in latin1: 0xE9 is an invalid UTF-8 sequence, and as a GB18030
      // lead byte it cannot be followed by 0x2C, so both strict decoders throw.
      const data = new Uint8Array([0x63, 0x61, 0x66, 0xe9, 0x2c, 0x31]);

      await convert(data, 'latin1.csv');

      expect(readSpy).toHaveBeenCalledWith('café,1', expect.objectContaining({ type: 'string' }));
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

  describe('loadFontsForPdf (private) — indexed catalog fonts for x2t PDF export', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    // A fake catalog font: TTF magic 00 01 00 00 followed by padding, with
    // the first 32 bytes XOR-obfuscated using the OnlyOffice catalog key.
    const CATALOG_KEY = [160, 102, 214, 32, 20, 150, 71, 250, 149, 105, 184, 80, 176, 65, 73, 72];
    const makeCatalogBytes = () => {
      const plain = new Uint8Array(40);
      plain.set([0x00, 0x01, 0x00, 0x00]);
      for (let i = 4; i < plain.length; i++) plain[i] = i;
      const wire = new Uint8Array(plain);
      for (let i = 0; i < 32; i++) wire[i] ^= CATALOG_KEY[i % 16];
      return { plain, wire };
    };

    it('decodeCatalogFont restores the TTF magic and leaves bytes past 32 untouched', () => {
      const { plain, wire } = makeCatalogBytes();

      const decoded = (new X2TConverter() as any).decodeCatalogFont(wire) as Uint8Array;

      expect(Array.from(decoded)).toEqual(Array.from(plain));
      // Input is not mutated (decode returns a copy).
      expect(wire[0]).toBe(0xa0);
    });

    it('fetches catalog indexes and writes every alias with decoded TTF bytes', async () => {
      const { plain, wire } = makeCatalogBytes();
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => wire.buffer.slice(0),
      });
      vi.stubGlobal('fetch', fetchMock);

      const converter = new X2TConverter();
      const writeFile = vi.fn();
      (converter as any).x2tModule = { FS: { writeFile } };

      await (converter as any).loadFontsForPdf();

      // Catalog indexes are fetched, not the old (nonexistent) named TTFs.
      // Which index backs which alias is not asserted here: the slots moved
      // once already, when bin/font-license-sweep.mjs swapped the proprietary
      // faces out, and pinning them here only produces a false red. What has
      // to hold is that every fetch is a catalog index and every alias in the
      // manifest gets written.
      const fetchedUrls = fetchMock.mock.calls.map((call) => String(call[0]));
      expect(fetchedUrls.length).toBeGreaterThan(0);
      expect(fetchedUrls.every((url) => /fonts\/\d{3}$/.test(url))).toBe(true);

      const writtenPaths = writeFile.mock.calls.map((call) => String(call[0]));
      expect(writtenPaths).toContain('/working/fonts/Arial.ttf');
      expect(writtenPaths).toContain('/working/fonts/SimSun.ttf');
      expect(writtenPaths).toContain('/working/fonts/宋体.ttf');
      expect(writtenPaths).toContain('/working/fonts/DejaVuSans.ttf');

      // Written bytes are the decoded TTF, not the wire format.
      const arialWrite = writeFile.mock.calls.find((call) => String(call[0]).endsWith('Arial.ttf'));
      expect(Array.from(arialWrite![1].slice(0, 4))).toEqual(Array.from(plain.slice(0, 4)));
    });

    it('is non-fatal when a font fetch fails: remaining fonts still load', async () => {
      const { wire } = makeCatalogBytes();
      // Fail whichever slot happens to back Arial, without naming it.
      const manifest = (X2TConverter as any).PDF_FONT_MANIFEST as { file: string; aliases: string[] }[];
      const arialSlot = manifest.find((entry) => entry.aliases.includes('Arial.ttf'))!.file;
      const fetchMock = vi.fn().mockImplementation(async (url: string) => {
        if (String(url).endsWith(`fonts/${arialSlot}`)) throw new Error('network down');
        return { ok: true, arrayBuffer: async () => wire.buffer.slice(0) };
      });
      vi.stubGlobal('fetch', fetchMock);

      const converter = new X2TConverter();
      const writeFile = vi.fn();
      (converter as any).x2tModule = { FS: { writeFile } };

      await (converter as any).loadFontsForPdf();

      const writtenPaths = writeFile.mock.calls.map((call) => String(call[0]));
      expect(writtenPaths).not.toContain('/working/fonts/Arial.ttf');
      expect(writtenPaths).toContain('/working/fonts/SimSun.ttf');
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

    describe('isZipContainer / v9 OOXML zip saves', () => {
      const zip = () => new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]);

      it('detects the PK zip signature and rejects other data', () => {
        expect(isZipContainer(zip())).toBe(true);
        expect(isZipContainer(new Uint8Array([0x50, 0x4b, 0x05, 0x06]))).toBe(false); // empty-zip EOCD, not a local header
        expect(isZipContainer(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))).toBe(false);
        expect(isZipContainer(new Uint8Array(0))).toBe(false);
      });

      it('returns a same-format zip save as-is without invoking x2t', async () => {
        const { converter } = makeBinConverter();
        const bin = zip();

        const result = await converter.convertBinToDocument(bin, 'doc.xlsx', 'XLSX');

        expect(result.fileName).toBe('doc.xlsx');
        expect(result.data).toBe(bin);
        expect((converter as any).x2tModule.ccall).not.toHaveBeenCalled();
      });

      it('converts a cross-format zip save as a real document with the source extension', async () => {
        const { converter, writeFile } = makeBinConverter();

        await converter.convertBinToDocument(zip(), 'doc.xlsx', 'PDF');

        const params = writtenParams(writeFile);
        expect(params).toContain('<m_sFileFrom>/working/doc.xlsx</m_sFileFrom>');
        expect(params).toContain('<m_sFileTo>/working/doc.pdf</m_sFileTo>');
        expect(params).toContain('<m_bIsNoBase64>true</m_bIsNoBase64>');
        expect(params).not.toContain('<m_nFormatFrom>');
      });
    });
  });
});

describe('HTML disguised as a spreadsheet (corpus campaign defect #5)', () => {
  afterEach(() => {
    delete (window as any).XLSX;
  });

  const enc = (s: string) => new TextEncoder().encode(s);

  describe('isHtmlDocument', () => {
    it('recognizes an HTML table export saved as .xls', () => {
      expect(isHtmlDocument(enc('<html><body><table><tr><td>1</td></tr></table></body></html>'))).toBe(true);
      expect(isHtmlDocument(enc('  \n<!DOCTYPE html><html>'))).toBe(true);
      expect(isHtmlDocument(enc('<table border=1><tr><td>x</td></tr></table>'))).toBe(true);
      expect(isHtmlDocument(enc('<?xml version="1.0"?><html xmlns:o="urn:schemas-microsoft-com:office:office">'))).toBe(
        true,
      );
    });

    it('ignores a UTF-8 BOM before the markup', () => {
      expect(isHtmlDocument(new Uint8Array([0xef, 0xbb, 0xbf, ...enc('<html><table></table></html>')]))).toBe(true);
    });

    it('does not flag real OOXML, plain CSV, or short buffers', () => {
      expect(isHtmlDocument(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00, 0x08, 0x00]))).toBe(false);
      expect(isHtmlDocument(enc('name,age\n<b>,20\n'))).toBe(false);
      expect(isHtmlDocument(enc('<td>'))).toBe(false);
      expect(isHtmlDocument(new Uint8Array(0))).toBe(false);
    });
  });

  describe('convertHtmlTableToXlsx', () => {
    const convert = (data: Uint8Array, fileName: string) =>
      new X2TConverter().convertHtmlTableToXlsx(data, fileName) as Promise<File>;

    it('parses the HTML with SheetJS (string mode) and returns a .xlsx File', async () => {
      const readSpy = vi.fn().mockReturnValue({ SheetNames: ['Sheet1'], Sheets: {} });
      (window as any).XLSX = { read: readSpy, write: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3])) };

      const file = await convert(enc('<table><tr><td>a</td></tr></table>'), 'export.xls');

      expect(readSpy).toHaveBeenCalledWith(
        '<table><tr><td>a</td></tr></table>',
        expect.objectContaining({ type: 'string' }),
      );
      expect(file.name).toBe('export.xlsx');
      expect(file.type).toContain('spreadsheetml');
    });

    it('decodes GBK exports before parsing (zh-CN web systems export ANSI HTML)', async () => {
      const readSpy = vi.fn().mockReturnValue({ SheetNames: ['Sheet1'], Sheets: {} });
      (window as any).XLSX = { read: readSpy, write: vi.fn().mockReturnValue(new Uint8Array([1])) };
      // "<table><tr><td>中文</td></tr></table>" in GBK: 中=D6D0 文=CEC4
      const gbk = new Uint8Array([...enc('<table><tr><td>'), 0xd6, 0xd0, 0xce, 0xc4, ...enc('</td></tr></table>')]);

      await convert(gbk, 'list.xls');

      expect(readSpy.mock.calls[0][0]).toContain('中文');
    });

    it('fails with a clear message when no table is found', async () => {
      (window as any).XLSX = { read: vi.fn().mockReturnValue({ SheetNames: [] }), write: vi.fn() };
      await expect(convert(enc('<html><body>nothing</body></html>'), 'x.xls')).rejects.toThrow(
        /Failed to convert HTML table to XLSX.*no table found/s,
      );
    });
  });
});
