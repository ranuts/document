import { createObjectURL, getExtensions, scriptOnLoad } from 'ranuts/utils';
import 'ranui/message';
import { t } from '@ranuts/shared/i18n';
import type {
  BinConversionResult,
  ConversionResult,
  DocumentType,
  EmscriptenModule,
} from '@ranuts/shared/document-types';
import { BASE_PATH, DOCUMENT_TYPE_MAP, getDocumentMimeType } from '@ranuts/shared/document-utils';
import { extractDocxMediaUrls } from './docx-zip';

// x2t input-format constant for the editor's canvas render stream. When the
// editor exports via "Print to PDF" (and similar render-based paths) it emits a
// stream of drawing commands instead of a serialized document, and that stream
// carries no format signature, so x2t must be told the input format explicitly.
export const CANVAS_PDF_INPUT_FORMAT = 8196;

// x2t output-format constant for PDF (AVS_OFFICESTUDIO_FILE_CROSSPLATFORM_PDF).
// Declared explicitly because x2t cannot infer the conversion direction from
// file extensions alone when the input is a canvas render stream.
export const PDF_OUTPUT_FORMAT = 513;

// Serialized editor documents start with a 4-byte engine signature.
const EDITOR_BIN_SIGNATURES = new Set(['DOCY', 'XLSY', 'PPTY', 'VSDY']);

export function hasEditorBinSignature(bin: Uint8Array): boolean {
  if (bin.length < 4) return false;
  return EDITOR_BIN_SIGNATURES.has(String.fromCharCode(bin[0]!, bin[1]!, bin[2]!, bin[3]!));
}

// The v9 engine's offline save trigger emits a finished OOXML document (a ZIP
// container starting with "PK\x03\x04"), not an editor bin at all.
export function isZipContainer(bin: Uint8Array): boolean {
  return bin.length >= 4 && bin[0] === 0x50 && bin[1] === 0x4b && bin[2] === 0x03 && bin[3] === 0x04;
}

const FILE_DESCRIPTION_MAP: Record<string, string> = {
  docx: 'Word Document',
  doc: 'Word 97-2003 Document',
  odt: 'OpenDocument Text',
  pdf: 'PDF Document',
  xlsx: 'Excel Workbook',
  xls: 'Excel 97-2003 Workbook',
  ods: 'OpenDocument Spreadsheet',
  pptx: 'PowerPoint Presentation',
  ppt: 'PowerPoint 97-2003 Presentation',
  odp: 'OpenDocument Presentation',
  txt: 'Text Document',
  rtf: 'Rich Text Format',
  csv: 'CSV File',
};

/**
 * Save a finished file to the user's disk: File System Access API when
 * available (native save dialog, success toast), plain anchor download
 * otherwise. A user-cancelled dialog resolves silently; any other failure
 * rejects so the caller can surface it. Shared by the v7 convert-and-download
 * path and the v9 file-stream save path (lib/onlyoffice-editor.ts).
 */
export async function saveFileToDisk(data: Blob | Uint8Array, fileName: string, mimeType?: string): Promise<void> {
  const picker = (
    window as unknown as {
      showSaveFilePicker?: (opts: {
        suggestedName: string;
        types: Array<{ description: string; accept: Record<string, string[]> }>;
      }) => Promise<{
        createWritable: () => Promise<{ write: (d: Blob | Uint8Array) => Promise<void>; close: () => Promise<void> }>;
      }>;
    }
  ).showSaveFilePicker;

  if (typeof picker !== 'function') {
    const blob = data instanceof Blob ? data : new Blob([data as BlobPart]);
    const url = await createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }, 100);
    return;
  }

  try {
    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    const detectedMimeType = mimeType || getDocumentMimeType(fileName);
    const fileHandle = await picker.call(window, {
      suggestedName: fileName,
      types: [
        {
          description: FILE_DESCRIPTION_MAP[extension] || 'Document',
          accept: { [detectedMimeType]: [`.${extension}`] },
        },
      ],
    });
    const writable = await fileHandle.createWritable();
    await writable.write(data);
    await writable.close();
    // ranui/message registers a global `window.message` toast API (untyped).
    (window as unknown as { message?: { success?: (msg: string) => void } }).message?.success?.(
      `${t('fileSavedSuccess')}${fileName}`,
    );
  } catch (error) {
    if ((error as Error).name === 'AbortError') return;
    throw error;
  }
}

const MIME_MAP: Record<string, string> = {
  gif: 'image/gif',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  bmp: 'image/bmp',
  tiff: 'image/tiff',
  tif: 'image/tiff',
  emf: 'image/x-emf',
  wmf: 'image/x-wmf',
};

export class X2TConverter {
  private x2tModule: EmscriptenModule | null = null;
  private isReady = false;
  private initPromise: Promise<EmscriptenModule> | null = null;
  private hasScriptLoaded = false;
  private fontsLoaded = false;

  // Supported file type mapping
  private readonly DOCUMENT_TYPE_MAP: Record<string, DocumentType> = DOCUMENT_TYPE_MAP;

  private readonly WORKING_DIRS = ['/working', '/working/media', '/working/fonts', '/working/themes'];
  private readonly SCRIPT_PATH = `${BASE_PATH}wasm/x2t/x2t.js`;
  private readonly WASM_GZ_PATH = `${BASE_PATH}wasm/x2t/x2t.wasm.gz`;
  private readonly INIT_TIMEOUT = 300000;

  /**
   * Load X2T script file (using ranuts scriptOnLoad utility).
   *
   * We first decompress the gzipped WASM and hand the bytes to Emscripten via
   * `Module.wasmBinary` (see prepareWasmBinary), so x2t.js never fetches the raw
   * 55 MB `x2t.wasm` itself. This lets us ship only the ~11 MB `x2t.wasm.gz`,
   * staying under Cloudflare Pages' 25 MiB-per-file deploy limit.
   */
  async loadScript(): Promise<void> {
    if (this.hasScriptLoaded) return;

    try {
      await this.prepareWasmBinary();
      // scriptOnLoad accepts an array of URLs
      await scriptOnLoad([this.SCRIPT_PATH]);
      this.hasScriptLoaded = true;
      console.log('X2T WASM script loaded successfully');
    } catch (error) {
      const errorMsg = 'Failed to load X2T WASM script';
      console.error(errorMsg, error);
      throw new Error(errorMsg);
    }
  }

  /**
   * Fetch the gzipped x2t WASM, decompress it in the browser, and stash the raw
   * bytes on `window.Module.wasmBinary` *before* x2t.js runs. Emscripten checks
   * `if (Module['wasmBinary']) wasmBinary = Module['wasmBinary']` and then skips
   * its own fetch/instantiateStreaming of `x2t.wasm` entirely.
   *
   * Uses the native `DecompressionStream('gzip')` — no extra dependency.
   *
   * Servers disagree on how they serve a `.gz` file: some (e.g. Vite's dev /
   * preview server) send it with `Content-Encoding: gzip`, so the browser has
   * already transparently decompressed it by the time we read the body; others
   * (static hosts like Cloudflare Pages / GitHub Pages) serve the raw gzip
   * bytes. We detect which by the leading magic bytes and only decompress when
   * the payload is still gzip (`1f 8b`) rather than an already-raw wasm module
   * (`00 61 73 6d`). This keeps it correct on every host.
   */
  private async prepareWasmBinary(): Promise<void> {
    const globalScope = window as unknown as {
      Module?: Record<string, unknown> & { wasmBinary?: ArrayBuffer };
    };
    if (globalScope.Module?.wasmBinary) return; // already prepared

    const response = await fetch(this.WASM_GZ_PATH);
    if (!response.ok) {
      throw new Error(`Failed to fetch x2t WASM at '${this.WASM_GZ_PATH}' (${response.status})`);
    }
    const raw = await response.arrayBuffer();
    const head = new Uint8Array(raw, 0, Math.min(2, raw.byteLength));
    const isGzip = head[0] === 0x1f && head[1] === 0x8b;

    let wasmBinary: ArrayBuffer;
    if (isGzip) {
      const stream = new Response(raw).body!.pipeThrough(new DecompressionStream('gzip'));
      wasmBinary = await new Response(stream).arrayBuffer();
    } else {
      // Already decompressed by the browser via Content-Encoding.
      wasmBinary = raw;
    }

    // Pre-seed the global Module so x2t.js (which reuses an existing global
    // Module) picks up the binary. Preserve any properties already set.
    globalScope.Module = { ...globalScope.Module, wasmBinary };
  }

  /**
   * Initialize X2T module
   */
  async initialize(): Promise<EmscriptenModule> {
    if (this.isReady && this.x2tModule) {
      return this.x2tModule;
    }

    // Prevent duplicate initialization
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private async doInitialize(): Promise<EmscriptenModule> {
    try {
      await this.loadScript();
      return new Promise((resolve, reject) => {
        const x2t = window.Module;
        if (!x2t) {
          reject(new Error('X2T module not found after script loading'));
          return;
        }

        // Set timeout handling
        const timeoutId = setTimeout(() => {
          if (!this.isReady) {
            reject(new Error(`X2T initialization timeout after ${this.INIT_TIMEOUT}ms`));
          }
        }, this.INIT_TIMEOUT);

        x2t.onRuntimeInitialized = () => {
          try {
            clearTimeout(timeoutId);
            this.createWorkingDirectories(x2t);
            this.x2tModule = x2t;
            this.isReady = true;
            console.log('X2T module initialized successfully');
            resolve(x2t);
          } catch (error) {
            reject(error);
          }
        };
      });
    } catch (error) {
      this.initPromise = null; // Reset to allow retry
      throw error;
    }
  }

  /**
   * The indexed catalog fonts under public/fonts/{index} are raw TTFs whose
   * first 32 bytes are XOR-obfuscated with this fixed 16-byte key (the same
   * wire format the editor's own font loader decodes).
   */
  private static readonly CATALOG_FONT_XOR_KEY = [160, 102, 214, 32, 20, 150, 71, 250, 149, 105, 184, 80, 176, 65, 73, 72];

  /**
   * PDF-export font manifest: catalog file index -> alias file names x2t
   * matches against inside m_sFontDir. One decoded byte set is written once
   * per alias. Indexes come from __fonts_infos in public/sdkjs/common/
   * AllFonts.js (file position, then __fonts_files lookup). Keep Arial and
   * other western families on their own files -- aliasing them to the CJK
   * fallback garbles latin text and digits. The CJK alias entries carry the
   * literal zh font names documents reference; they are data, not UI copy.
   */
  private static readonly PDF_FONT_MANIFEST: ReadonlyArray<{ file: string; aliases: string[] }> = [
    { file: '072', aliases: ['Arial.ttf'] },
    { file: '074', aliases: ['Arial_Bold.ttf'] },
    { file: '076', aliases: ['Arial_Italic.ttf'] },
    { file: '075', aliases: ['Arial_Bold_Italic.ttf'] },
    // Calibri regular is present; Carlito (metric-compatible) fills the
    // missing bold/italic faces under both names.
    { file: '049', aliases: ['Calibri.ttf'] },
    { file: '109', aliases: ['Calibri_Bold.ttf', 'Carlito_Bold.ttf'] },
    { file: '111', aliases: ['Calibri_Italic.ttf', 'Carlito_Italic.ttf'] },
    { file: '110', aliases: ['Calibri_Bold_Italic.ttf', 'Carlito_Bold_Italic.ttf'] },
    { file: '018', aliases: ['Times_New_Roman.ttf', 'Times New Roman.ttf'] },
    { file: '088', aliases: ['Times_New_Roman_Bold.ttf'] },
    { file: '090', aliases: ['Times_New_Roman_Italic.ttf'] },
    { file: '089', aliases: ['Times_New_Roman_Bold_Italic.ttf'] },
    { file: '079', aliases: ['Courier_New.ttf', 'Courier New.ttf'] },
    // Names the previous implementation fetched directly (kept for the same
    // default-latin coverage).
    { file: '117', aliases: ['DejaVuSans.ttf'] },
    { file: '050', aliases: ['DejaVuSans-Bold.ttf'] },
    { file: '062', aliases: ['LiberationSans-Regular.ttf'] },
    // CJK: SimSun (017) and Microsoft YaHei (016) exist as real files in
    // this vendor; PingFang maps to YaHei as the closest match.
    // 017 aliases include SimSun's zh display name, 016 includes YaHei's.
    { file: '017', aliases: ['SimSun.ttf', 'NSimSun.ttf', '宋体.ttf'] },
    { file: '016', aliases: ['Microsoft YaHei.ttf', '微软雅黑.ttf', 'PingFang SC.ttf'] },
    { file: '130', aliases: ['DroidSansFallback.ttf', 'Droid Sans Fallback.ttf'] },
  ];

  /** Undo the catalog XOR obfuscation, returning a plain TTF byte copy. */
  private decodeCatalogFont(bytes: Uint8Array): Uint8Array {
    const out = new Uint8Array(bytes);
    const key = X2TConverter.CATALOG_FONT_XOR_KEY;
    const n = Math.min(32, out.length);
    for (let i = 0; i < n; i++) {
      out[i] ^= key[i % key.length];
    }
    return out;
  }

  /**
   * Load fonts into WASM FS for PDF rendering. Called once per session.
   * Without fonts, x2t generates a PDF with invisible (empty) text. Fonts
   * are fetched from the indexed catalog (public/fonts/{index}) -- the same
   * files the editor loads, so they are usually already HTTP-cached -- and
   * XOR-decoded before being written under their alias names.
   */
  private async loadFontsForPdf(): Promise<void> {
    if (this.fontsLoaded || !this.x2tModule) return;
    await Promise.all(
      X2TConverter.PDF_FONT_MANIFEST.map(async ({ file, aliases }) => {
        try {
          const res = await fetch(`${BASE_PATH}fonts/${file}`);
          if (!res.ok) return;
          const bytes = this.decodeCatalogFont(new Uint8Array(await res.arrayBuffer()));
          for (const alias of aliases) {
            this.x2tModule!.FS.writeFile(`/working/fonts/${alias}`, bytes);
          }
        } catch {
          // Non-fatal — PDF may still render with remaining fonts
        }
      }),
    );
    this.fontsLoaded = true;
  }

  /**
   * Create working directories
   */
  private createWorkingDirectories(x2t: EmscriptenModule): void {
    this.WORKING_DIRS.forEach((dir) => {
      try {
        x2t.FS.mkdir(dir);
      } catch (error) {
        // Directory may already exist, ignore error
        console.warn(`Directory ${dir} may already exist:`, error);
      }
    });
  }

  /**
   * Get document type
   */
  private getDocumentType(extension: string): DocumentType {
    const docType = DOCUMENT_TYPE_MAP[extension.toLowerCase()];
    if (!docType) {
      throw new Error(`Unsupported file format: ${extension}`);
    }
    return docType;
  }

  /**
   * Sanitize file name
   */
  private sanitizeFileName(input: string): string {
    if (typeof input !== 'string' || !input.trim()) {
      return 'file.bin';
    }

    const parts = input.split('.');
    const ext = parts.pop() || 'bin';
    const name = parts.join('.');

    const illegalChars = /[/?<>\\:*|"]/g;
    // eslint-disable-next-line no-control-regex
    const controlChars = /[\x00-\x1f\x80-\x9f]/g;
    const reservedPattern = /^\.+$/;
    const unsafeChars = /[&'%!"{}[\]]/g;

    let sanitized = name
      .replace(illegalChars, '')
      .replace(controlChars, '')
      .replace(reservedPattern, '')
      .replace(unsafeChars, '');

    sanitized = sanitized.trim() || 'file';
    return `${sanitized.slice(0, 200)}.${ext}`; // Limit length
  }

  /**
   * Execute document conversion
   */
  private executeConversion(paramsPath: string): void {
    if (!this.x2tModule) {
      throw new Error('X2T module not initialized');
    }

    const result = this.x2tModule.ccall('main1', 'number', ['string'], [paramsPath]);
    if (result !== 0) {
      // Read the params XML for debugging
      try {
        const paramsContent = this.x2tModule.FS.readFile(paramsPath, { encoding: 'binary' });
        // Convert binary to string for logging
        if (paramsContent instanceof Uint8Array) {
          const paramsText = new TextDecoder('utf-8').decode(paramsContent);
          console.error('Conversion failed. Parameters XML:', paramsText);
        } else {
          console.error('Conversion failed. Parameters XML:', paramsContent);
        }
      } catch (e) {
        console.error('Conversion failed. Parameters XML:', e);
        // Ignore if we can't read the params file
      }
      const hints: Record<number, string> = {
        88: 'The file may be in an unsupported format (.doc binary format), password-protected, or corrupted. Try converting to .docx first.',
        55: 'DRM-protected or encrypted file cannot be opened.',
        1: 'Invalid or corrupted file.',
        80: 'x2t could not recognize the input format. An unsigned editor render stream needs an explicit m_nFormatFrom (see hasEditorBinSignature).',
      };
      const hint = hints[result] ? ` (${hints[result]})` : '';
      throw new Error(`Conversion failed with code: ${result}${hint}`);
    }
  }

  /**
   * Create conversion parameters XML
   */
  private createConversionParams(fromPath: string, toPath: string, additionalParams = '', noBase64 = false): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<TaskQueueDataConvert xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <m_sFileFrom>${fromPath}</m_sFileFrom>
  <m_sThemeDir>/working/themes</m_sThemeDir>
  <m_sFileTo>${toPath}</m_sFileTo>
  <m_bIsNoBase64>${noBase64}</m_bIsNoBase64>
  ${additionalParams}
</TaskQueueDataConvert>`;
  }

  /**
   * Write media files into x2t's virtual FS before a bin -> document conversion.
   *
   * The bin format (the editor's serialized internal state) references inserted
   * images by relative path (e.g. "media/image1.png") rather than embedding their
   * bytes inline. On the open/forward direction, x2t itself populates
   * /working/media/ as a side effect of unzipping the source docx/xlsx/pptx, and
   * readMediaFiles() above reads that back out. But an image inserted into an
   * already-open document (paste, or "Insert > Image > From File" -- both go
   * through the SDK's writeFile event, see handleWriteFile in
   * lib/onlyoffice-editor.ts) only ever exists as an in-memory blob: URL on our
   * side; x2t's WASM sandbox has no access to the browser's Blob URL store, so
   * without this step the bin -> document conversion has no way to find those
   * bytes and the image comes out blank in the saved file (GitHub #72). Fetching
   * each URL and writing it into /working/media/ here gives x2t the same files it
   * would have found had they been present in the original document.
   */
  private async writeMediaFiles(media?: Record<string, string>): Promise<void> {
    if (!this.x2tModule || !media) return;

    await Promise.all(
      Object.entries(media).map(async ([key, url]) => {
        try {
          const response = await fetch(url);
          if (!response.ok) return;
          const bytes = new Uint8Array(await response.arrayBuffer());
          const relativePath = key.startsWith('media/') ? key : `media/${key}`;
          this.x2tModule!.FS.writeFile(`/working/${relativePath}`, bytes);
        } catch (error) {
          console.warn(`Failed to write media file ${key}:`, error);
        }
      }),
    );
  }

  /**
   * Read media files
   */
  private async readMediaFiles(): Promise<Record<string, string>> {
    if (!this.x2tModule) return {};

    const media: Record<string, string> = {};

    try {
      const files = this.x2tModule.FS.readdir('/working/media/');

      // Use Promise.all to handle async createObjectURL
      const mediaPromises = files
        .filter((file) => file !== '.' && file !== '..')
        .map(async (file) => {
          try {
            const fileData = this.x2tModule!.FS.readFile(`/working/media/${file}`, {
              encoding: 'binary',
            }) as BlobPart;

            const ext = file.split('.').pop()?.toLowerCase() ?? '';
            const mime = MIME_MAP[ext] ?? 'application/octet-stream';
            const blob = new Blob([fileData], { type: mime });
            const mediaUrl = await createObjectURL(blob);
            return { key: `media/${file}`, url: mediaUrl };
          } catch (error) {
            console.warn(`Failed to read media file ${file}:`, error);
            return null;
          }
        });

      const results = await Promise.all(mediaPromises);
      results.forEach((result) => {
        if (result) {
          media[result.key] = result.url;
        }
      });
    } catch (error) {
      console.warn('Failed to read media directory:', error);
    }

    return media;
  }

  /**
   * Load xlsx library from local file
   */
  private async loadXlsxLibrary(): Promise<any> {
    // Check if xlsx is already loaded
    if (typeof window !== 'undefined' && (window as any).XLSX) {
      return (window as any).XLSX;
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `${BASE_PATH}libs/sheetjs/xlsx.full.min.js`;
      script.onload = () => {
        if (typeof window !== 'undefined' && (window as any).XLSX) {
          resolve((window as any).XLSX);
        } else {
          reject(new Error('Failed to load xlsx library'));
        }
      };
      script.onerror = () => {
        reject(new Error('Failed to load xlsx library from local file'));
      };
      document.head.appendChild(script);
    });
  }

  /**
   * Decode CSV bytes with encoding sniffing. A non-fatal utf-8 TextDecoder
   * never throws (invalid sequences become U+FFFD), so strict decoding is the
   * only way to detect legacy encodings at all. Excel on zh-CN Windows still
   * exports CSV in the ANSI code page (GBK), which is why gb18030 (its
   * superset) is tried before the latin1 last resort.
   */
  private decodeCsvBytes(csvData: Uint8Array): string {
    if (csvData.length >= 3 && csvData[0] === 0xef && csvData[1] === 0xbb && csvData[2] === 0xbf) {
      return new TextDecoder('utf-8').decode(csvData.slice(3));
    }
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(csvData);
    } catch {
      try {
        return new TextDecoder('gb18030', { fatal: true }).decode(csvData);
      } catch {
        // gb18030 decoder unavailable, or bytes invalid in it too
        return new TextDecoder('latin1').decode(csvData);
      }
    }
  }

  /**
   * Convert CSV to XLSX format using SheetJS library
   * This is a workaround since x2t may not support CSV directly
   */
  async convertCsvToXlsx(csvData: Uint8Array, fileName: string): Promise<File> {
    try {
      // Load xlsx library
      const XLSX = await this.loadXlsxLibrary();

      const csvText = this.decodeCsvBytes(csvData);

      // Parse CSV using SheetJS
      const workbook = XLSX.read(csvText, { type: 'string', raw: false });

      // Convert to XLSX binary format
      const xlsxBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });

      // Create File object
      const xlsxFileName = fileName.replace(/\.csv$/i, '.xlsx');
      return new File([xlsxBuffer], xlsxFileName, {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
    } catch (error) {
      throw new Error(
        `Failed to convert CSV to XLSX: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
          'Please convert your CSV file to XLSX format manually and try again.',
      );
    }
  }

  /**
   * Convert document to bin format
   */
  async convertDocument(file: File): Promise<ConversionResult> {
    await this.initialize();

    const fileName = file.name;
    const fileExt = fileName.split('.').pop() || getExtensions(file?.type)[0] || '';
    const documentType = this.getDocumentType(fileExt);

    try {
      // Read file content
      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);

      // Handle CSV files - x2t may not support them directly, so convert to XLSX first
      if (fileExt.toLowerCase() === 'csv') {
        if (data.length === 0) {
          throw new Error('CSV file is empty');
        }
        console.log('CSV file detected. Converting to XLSX format...');
        console.log('CSV file size:', data.length, 'bytes');

        // Convert CSV to XLSX first
        try {
          const xlsxFile = await this.convertCsvToXlsx(data, fileName);
          console.log('CSV converted to XLSX, now converting with x2t...');

          // Now convert the XLSX file using x2t
          const xlsxArrayBuffer = await xlsxFile.arrayBuffer();
          const xlsxData = new Uint8Array(xlsxArrayBuffer);

          // Use the XLSX file for conversion
          const sanitizedName = this.sanitizeFileName(xlsxFile.name);
          const inputPath = `/working/${sanitizedName}`;
          const outputPath = `${inputPath}.bin`;

          // Write XLSX file to virtual file system
          this.x2tModule!.FS.writeFile(inputPath, xlsxData);

          // Create conversion parameters - no special params needed for XLSX
          const params = this.createConversionParams(inputPath, outputPath, '');
          this.x2tModule!.FS.writeFile('/working/params.xml', params);

          // Execute conversion
          this.executeConversion('/working/params.xml');

          // Read conversion result
          const result = this.x2tModule!.FS.readFile(outputPath);
          const media = await this.readMediaFiles();

          // Return original CSV fileName, not the XLSX one
          return {
            fileName: this.sanitizeFileName(fileName), // Keep original CSV filename
            type: documentType,
            bin: result,
            media,
          };
        } catch (conversionError: any) {
          // If conversion fails, provide helpful error message
          throw new Error(
            `Failed to convert CSV file: ${conversionError?.message || 'Unknown error'}. ` +
              'Please ensure your CSV file is properly formatted and try again.',
          );
        }
      }

      // For all other file types, use standard conversion
      const sanitizedName = this.sanitizeFileName(fileName);
      const inputPath = `/working/${sanitizedName}`;
      const outputPath = `${inputPath}.bin`;

      // Pre-extract media from PPTX ZIP before x2t conversion.
      // x2t may convert GIF→PNG in its output; the original ZIP preserves GIF animation.
      // We merge after conversion, with original ZIP entries winning for same-basename files.
      let originalPptxMedia: Record<string, string> = {};
      if (fileExt.toLowerCase() === 'pptx') {
        try {
          originalPptxMedia = await extractDocxMediaUrls(data);
        } catch {
          // non-fatal; fall back to x2t output only
        }
      }

      // Write file to virtual file system
      this.x2tModule!.FS.writeFile(inputPath, data);

      // Create conversion parameters - no special params needed for non-CSV files
      const params = this.createConversionParams(inputPath, outputPath, '');
      this.x2tModule!.FS.writeFile('/working/params.xml', params);

      // Execute conversion
      this.executeConversion('/working/params.xml');

      // Read conversion result
      const result = this.x2tModule!.FS.readFile(outputPath);
      const x2tMedia = await this.readMediaFiles();

      // Merge media: for each x2t output file, if the same basename exists in the
      // original PPTX ZIP as a GIF, serve the original GIF (preserves animation).
      const media: Record<string, string> = { ...x2tMedia };
      if (Object.keys(originalPptxMedia).length > 0) {
        const gifByBasename: Record<string, string> = {};
        for (const [key, url] of Object.entries(originalPptxMedia)) {
          const ext = key.split('.').pop()?.toLowerCase();
          if (ext === 'gif') {
            gifByBasename[key.replace(/\.[^.]+$/, '')] = url;
          }
        }
        for (const key of Object.keys(media)) {
          const basename = key.replace(/\.[^.]+$/, '');
          if (gifByBasename[basename]) {
            media[key] = gifByBasename[basename]!;
          }
        }
        for (const [key, url] of Object.entries(originalPptxMedia)) {
          if (!(key in media)) media[key] = url;
        }
      }

      return {
        fileName: sanitizedName,
        type: documentType,
        bin: result,
        media,
      };
    } catch (error) {
      throw new Error(`Document conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Attempt to convert CSV directly using x2t (may fail)
   */
  private async convertCsvDirectly(
    _file: File,
    data: Uint8Array,
    fileName: string,
    documentType: DocumentType,
  ): Promise<ConversionResult> {
    // Handle UTF-8 BOM
    let fileData = data;
    const hasBOM = data.length >= 3 && data[0] === 0xef && data[1] === 0xbb && data[2] === 0xbf;
    if (!hasBOM) {
      const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
      fileData = new Uint8Array(bom.length + data.length);
      fileData.set(bom, 0);
      fileData.set(data, bom.length);
    }

    const sanitizedName = this.sanitizeFileName(fileName);
    const inputPath = `/working/${sanitizedName}`;
    const outputPath = `${inputPath}.bin`;

    // Write file to virtual file system
    this.x2tModule!.FS.writeFile(inputPath, fileData);

    // Try with format specification
    const additionalParams = '<m_nFormatFrom>260</m_nFormatFrom>';
    const params = this.createConversionParams(inputPath, outputPath, additionalParams);
    this.x2tModule!.FS.writeFile('/working/params.xml', params);

    // Execute conversion - this will likely fail with error 89
    this.executeConversion('/working/params.xml');

    // If we get here, conversion succeeded (unlikely for CSV)
    const result = this.x2tModule!.FS.readFile(outputPath);
    const media = await this.readMediaFiles();

    return {
      fileName: sanitizedName,
      type: documentType,
      bin: result,
      media,
    };
  }

  /**
   * Convert bin format to specified document format.
   */
  async convertBinToDocument(
    bin: Uint8Array,
    originalFileName: string,
    targetExt = 'DOCX',
    media?: Record<string, string>,
  ): Promise<BinConversionResult> {
    await this.initialize();

    const sanitizedBase = this.sanitizeFileName(originalFileName).replace(/\.[^/.]+$/, '');
    const binFileName = `${sanitizedBase}.bin`;
    const outputFileName = `${sanitizedBase}.${targetExt.toLowerCase()}`;

    try {
      await this.writeMediaFiles(media);

      // The v9 engine's offline save hands us a finished OOXML zip rather than
      // an editor bin. Same-format saves need no conversion at all; cross-format
      // ones go through x2t as a real document, with the source extension spelled
      // out so x2t can infer the conversion direction.
      if (isZipContainer(bin)) {
        return await this.convertZipDocument(bin, originalFileName, targetExt);
      }

      // Handle CSV files specially - need to convert bin -> XLSX -> CSV
      if (targetExt.toUpperCase() === 'CSV') {
        // First convert bin to XLSX
        const xlsxFileName = `${sanitizedBase}.xlsx`;
        this.x2tModule!.FS.writeFile(`/working/${binFileName}`, bin);

        const params = this.createConversionParams(`/working/${binFileName}`, `/working/${xlsxFileName}`, '');

        this.x2tModule!.FS.writeFile('/working/params.xml', params);
        this.executeConversion('/working/params.xml');

        // Read XLSX file
        const xlsxResult = this.x2tModule!.FS.readFile(`/working/${xlsxFileName}`);
        const xlsxArray = xlsxResult instanceof Uint8Array ? xlsxResult : new Uint8Array(xlsxResult as ArrayBuffer);

        return {
          fileName: outputFileName,
          data: await this.xlsxToCsvBytes(xlsxArray),
        };
      }

      // For all other file types, use standard conversion
      // Write bin file
      this.x2tModule!.FS.writeFile(`/working/${binFileName}`, bin);

      // Create conversion parameters
      let additionalParams = '';
      if (targetExt === 'PDF') {
        await this.loadFontsForPdf();
        additionalParams = `<m_sFontDir>/working/fonts/</m_sFontDir><m_nFormatTo>${PDF_OUTPUT_FORMAT}</m_nFormatTo>`;
      }

      // A bin without a DOCY/XLSY/PPTY/VSDY signature is the editor's canvas
      // render stream ("Print to PDF" and similar), which x2t cannot identify
      // from the bytes alone -- it fails with exit code 80 unless the input
      // format is declared explicitly. The stream is also raw binary (unlike
      // signed editor bins, which are base64-wrapped text), so m_bIsNoBase64
      // must be true for it. Signed editor bins are left untouched.
      const isCanvasRenderStream = !hasEditorBinSignature(bin);
      if (isCanvasRenderStream) {
        additionalParams += `<m_nFormatFrom>${CANVAS_PDF_INPUT_FORMAT}</m_nFormatFrom>`;
      }

      const params = this.createConversionParams(
        `/working/${binFileName}`,
        `/working/${outputFileName}`,
        additionalParams,
        isCanvasRenderStream,
      );

      this.x2tModule!.FS.writeFile('/working/params.xml', params);

      // Execute conversion
      this.executeConversion('/working/params.xml');

      // Read generated document
      const result = this.x2tModule!.FS.readFile(`/working/${outputFileName}`);

      return {
        fileName: outputFileName,
        data: result,
      };
    } catch (error) {
      throw new Error(`Bin to document conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert XLSX bytes to CSV bytes (UTF-8 with BOM) via SheetJS.
   */
  async xlsxToCsvBytes(xlsxArray: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
    const XLSX = await this.loadXlsxLibrary();
    const workbook = XLSX.read(xlsxArray, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const csvText = XLSX.utils.sheet_to_csv(worksheet);
    const csvBOM = new Uint8Array([0xef, 0xbb, 0xbf]);
    const csvTextBytes = new TextEncoder().encode(csvText);
    const csvArray = new Uint8Array(csvBOM.length + csvTextBytes.length);
    csvArray.set(csvBOM, 0);
    csvArray.set(csvTextBytes, csvBOM.length);
    return csvArray;
  }

  /**
   * Convert a finished OOXML document (v9 offline save output) to the target
   * format. The editor already produced a complete docx/xlsx/pptx zip, so a
   * same-format save returns the bytes as-is, CSV goes straight to SheetJS,
   * and everything else is a plain document-to-document x2t conversion.
   */
  private async convertZipDocument(
    bin: Uint8Array,
    originalFileName: string,
    targetExt: string,
  ): Promise<BinConversionResult> {
    const sanitizedBase = this.sanitizeFileName(originalFileName).replace(/\.[^/.]+$/, '');
    const nameExt = (originalFileName.split('.').pop() || targetExt).toLowerCase();
    // The editor opens CSV files as spreadsheets internally, so the zip it
    // emits for them is an XLSX regardless of the original file's name.
    const sourceExt = nameExt === 'csv' ? 'xlsx' : nameExt;
    const outputFileName = `${sanitizedBase}.${targetExt.toLowerCase()}`;

    if (sourceExt === targetExt.toLowerCase()) {
      return { fileName: outputFileName, data: bin as BlobPart };
    }

    if (targetExt.toUpperCase() === 'CSV') {
      return { fileName: outputFileName, data: await this.xlsxToCsvBytes(bin) };
    }

    const inputPath = `/working/${sanitizedBase}.${sourceExt}`;
    const outputPath = `/working/${outputFileName}`;
    this.x2tModule!.FS.writeFile(inputPath, bin);

    let additionalParams = '';
    if (targetExt === 'PDF') {
      await this.loadFontsForPdf();
      additionalParams = `<m_sFontDir>/working/fonts/</m_sFontDir><m_nFormatTo>${PDF_OUTPUT_FORMAT}</m_nFormatTo>`;
    }

    const params = this.createConversionParams(inputPath, outputPath, additionalParams, true);
    this.x2tModule!.FS.writeFile('/working/params.xml', params);
    this.executeConversion('/working/params.xml');

    return { fileName: outputFileName, data: this.x2tModule!.FS.readFile(outputPath) };
  }

  /**
   * Convert bin format to specified format and save it locally.
   */
  async convertBinToDocumentAndDownload(
    bin: Uint8Array,
    originalFileName: string,
    targetExt = 'DOCX',
    media?: Record<string, string>,
  ): Promise<BinConversionResult> {
    const result = await this.convertBinToDocument(bin, originalFileName, targetExt, media);
    const data = result.data instanceof Uint8Array ? result.data : new Uint8Array(result.data as ArrayBuffer);

    // TODO: Improve print functionality
    await saveFileToDisk(data, result.fileName);
    return result;
  }

  /**
   * Destroy instance and clean up resources
   */
  destroy(): void {
    this.x2tModule = null;
    this.isReady = false;
    this.initPromise = null;
    console.log('X2T converter destroyed');
  }
}
