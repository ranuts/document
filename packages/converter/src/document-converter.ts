import { createObjectURL, getExtensions, scriptOnLoad } from 'ranuts/utils';
import 'ranui/message';
import { t } from '@ranuts/shared/i18n';
import type {
  BinConversionResult,
  ConversionResult,
  DocumentType,
  EmscriptenModule,
} from '@ranuts/shared/document-types';
import { BASE_PATH, DOCUMENT_TYPE_MAP } from '@ranuts/shared/document-utils';
import { extractDocxMediaUrls } from './docx-zip';

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
   * Load core fonts into WASM FS for PDF rendering. Called once per session.
   * Without fonts, x2t generates a PDF with invisible (empty) text.
   */
  private async loadFontsForPdf(): Promise<void> {
    if (this.fontsLoaded || !this.x2tModule) return;
    const fontNames = ['DejaVuSans.ttf', 'DejaVuSans-Bold.ttf', 'LiberationSans-Regular.ttf'];
    await Promise.all(
      fontNames.map(async (name) => {
        try {
          const res = await fetch(`${BASE_PATH}fonts/${name}`);
          if (!res.ok) return;
          const buf = new Uint8Array(await res.arrayBuffer());
          this.x2tModule!.FS.writeFile(`/working/fonts/${name}`, buf);
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
      };
      const hint = hints[result] ? ` (${hints[result]})` : '';
      throw new Error(`Conversion failed with code: ${result}${hint}`);
    }
  }

  /**
   * Create conversion parameters XML
   */
  private createConversionParams(fromPath: string, toPath: string, additionalParams = ''): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<TaskQueueDataConvert xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <m_sFileFrom>${fromPath}</m_sFileFrom>
  <m_sThemeDir>/working/themes</m_sThemeDir>
  <m_sFileTo>${toPath}</m_sFileTo>
  <m_bIsNoBase64>false</m_bIsNoBase64>
  ${additionalParams}
</TaskQueueDataConvert>`;
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
   * Convert CSV to XLSX format using SheetJS library
   * This is a workaround since x2t may not support CSV directly
   */
  private async convertCsvToXlsx(csvData: Uint8Array, fileName: string): Promise<File> {
    try {
      // Load xlsx library
      const XLSX = await this.loadXlsxLibrary();

      // Remove UTF-8 BOM if present
      let csvText: string;
      if (csvData.length >= 3 && csvData[0] === 0xef && csvData[1] === 0xbb && csvData[2] === 0xbf) {
        csvText = new TextDecoder('utf-8').decode(csvData.slice(3));
      } else {
        // Try UTF-8 first, fallback to other encodings if needed
        try {
          csvText = new TextDecoder('utf-8').decode(csvData);
        } catch {
          csvText = new TextDecoder('latin1').decode(csvData);
        }
      }

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
  ): Promise<BinConversionResult> {
    await this.initialize();

    const sanitizedBase = this.sanitizeFileName(originalFileName).replace(/\.[^/.]+$/, '');
    const binFileName = `${sanitizedBase}.bin`;
    const outputFileName = `${sanitizedBase}.${targetExt.toLowerCase()}`;

    try {
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

        // Convert XLSX to CSV using SheetJS
        const XLSX = await this.loadXlsxLibrary();
        const workbook = XLSX.read(xlsxArray, { type: 'array' });

        // Get the first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Convert to CSV
        const csvText = XLSX.utils.sheet_to_csv(worksheet);

        // Convert CSV text to Uint8Array (UTF-8 with BOM for better compatibility)
        const csvBOM = new Uint8Array([0xef, 0xbb, 0xbf]);
        const csvTextBytes = new TextEncoder().encode(csvText);
        const csvArray = new Uint8Array(csvBOM.length + csvTextBytes.length);
        csvArray.set(csvBOM, 0);
        csvArray.set(csvTextBytes, csvBOM.length);

        return {
          fileName: outputFileName,
          data: csvArray,
        };
      }

      // For all other file types, use standard conversion
      // Write bin file
      this.x2tModule!.FS.writeFile(`/working/${binFileName}`, bin);

      // Create conversion parameters
      let additionalParams = '';
      if (targetExt === 'PDF') {
        await this.loadFontsForPdf();
        additionalParams = '<m_sFontDir>/working/fonts/</m_sFontDir>';
      }

      const params = this.createConversionParams(
        `/working/${binFileName}`,
        `/working/${outputFileName}`,
        additionalParams,
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
   * Convert bin format to specified format and save it locally.
   */
  async convertBinToDocumentAndDownload(
    bin: Uint8Array,
    originalFileName: string,
    targetExt = 'DOCX',
  ): Promise<BinConversionResult> {
    const result = await this.convertBinToDocument(bin, originalFileName, targetExt);
    const data = result.data instanceof Uint8Array ? result.data : new Uint8Array(result.data as ArrayBuffer);

    // TODO: Improve print functionality
    await this.saveWithFileSystemAPI(data, result.fileName);
    return result;
  }

  /**
   * Download file
   */
  private async downloadFile(data: Uint8Array, fileName: string): Promise<void> {
    const blob = new Blob([data as BlobPart]);
    const url = await createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = fileName;
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();

    // Clean up resources
    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }, 100);
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeTypeFromExtension(extension: string): string {
    const mimeMap: Record<string, string> = {
      // Document types
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      doc: 'application/msword',
      odt: 'application/vnd.oasis.opendocument.text',
      rtf: 'application/rtf',
      txt: 'text/plain',
      pdf: 'application/pdf',

      // Spreadsheet types
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      xls: 'application/vnd.ms-excel',
      ods: 'application/vnd.oasis.opendocument.spreadsheet',
      csv: 'text/csv',

      // Presentation types
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      ppt: 'application/vnd.ms-powerpoint',
      odp: 'application/vnd.oasis.opendocument.presentation',

      // Image types
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      bmp: 'image/bmp',
      webp: 'image/webp',
      svg: 'image/svg+xml',
    };

    return mimeMap[extension.toLowerCase()] || 'application/octet-stream';
  }

  /**
   * Get file type description
   */
  private getFileDescription(extension: string): string {
    const descriptionMap: Record<string, string> = {
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

    return descriptionMap[extension.toLowerCase()] || 'Document';
  }

  /**
   * Save file using modern File System API
   */
  private async saveWithFileSystemAPI(data: Uint8Array, fileName: string, mimeType?: string): Promise<void> {
    if (!(window as any).showSaveFilePicker) {
      await this.downloadFile(data, fileName);
      return;
    }
    try {
      // Get file extension and determine MIME type
      const extension = fileName.split('.').pop()?.toLowerCase() || '';
      const detectedMimeType = mimeType || this.getMimeTypeFromExtension(extension);

      // Show file save dialog
      const fileHandle = await (window as any).showSaveFilePicker({
        suggestedName: fileName,
        types: [
          {
            description: this.getFileDescription(extension),
            accept: {
              [detectedMimeType]: [`.${extension}`],
            },
          },
        ],
      });

      // Create writable stream and write data
      const writable = await fileHandle.createWritable();
      await writable.write(data);
      await writable.close();
      // ranui/message registers a global `window.message` toast API (untyped).
      (window as unknown as { message?: { success?: (msg: string) => void } }).message?.success?.(
        `${t('fileSavedSuccess')}${fileName}`,
      );
      console.log('File saved successfully:', fileName);
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        console.log('User cancelled the save operation');
        return;
      }
      throw error;
    }
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
