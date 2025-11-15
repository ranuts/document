import { getExtensions } from 'ranuts/utils';
import 'ranui/message';
import { g_sEmpty_bin } from './empty_bin';
import { getOnlyOfficeLang, t } from './i18n';
import { getDocmentObj } from '@/store';

declare global {
  interface Window {
    Module: EmscriptenModule;
    editor?: {
      sendCommand: ({
        command,
        data,
      }: {
        command: string;
        data: {
          err_code?: number;
          urls?: Record<string, string>;
          path?: string;
          imgName?: string;
          buf?: ArrayBuffer;
          success?: boolean;
          error?: string;
        };
      }) => void;
      destroyEditor: () => void;
    };
  }
}

// types/x2t.d.ts - Type definitions file
interface EmscriptenFileSystem {
  mkdir(path: string): void;
  readdir(path: string): string[];
  readFile(path: string, options?: { encoding: 'binary' }): BlobPart;
  writeFile(path: string, data: Uint8Array | string): void;
}

interface EmscriptenModule {
  FS: EmscriptenFileSystem;
  ccall: (funcName: string, returnType: string, argTypes: string[], args: any[]) => number;
  onRuntimeInitialized: () => void;
}

interface ConversionResult {
  fileName: string;
  type: DocumentType;
  bin: BlobPart;
  media: Record<string, string>;
}

interface BinConversionResult {
  fileName: string;
  data: BlobPart;
}

type DocumentType = 'word' | 'cell' | 'slide';

/**
 * Get base path based on deployment environment
 * - GitHub Pages: uses /document/ path
 * - Docker/Other: uses root path /
 */
const getBasePath = (): string => {
  if (typeof window === 'undefined') {
    return '/';
  }

  const pathname = window.location.pathname;
  // Check if we're in GitHub Pages (path starts with /document/ or contains /document/)
  if (pathname.startsWith('/document/') || pathname === '/document') {
    return '/document/';
  }
  // Docker or other deployments use root path
  return '/';
};

const BASE_PATH = getBasePath();

/**
 * X2T utility class - Handles document conversion functionality
 */
class X2TConverter {
  private x2tModule: EmscriptenModule | null = null;
  private isReady = false;
  private initPromise: Promise<EmscriptenModule> | null = null;
  private hasScriptLoaded = false;

  // Supported file type mapping
  private readonly DOCUMENT_TYPE_MAP: Record<string, DocumentType> = {
    docx: 'word',
    doc: 'word',
    odt: 'word',
    rtf: 'word',
    txt: 'word',
    xlsx: 'cell',
    xls: 'cell',
    ods: 'cell',
    csv: 'cell',
    pptx: 'slide',
    ppt: 'slide',
    odp: 'slide',
  };

  private readonly WORKING_DIRS = ['/working', '/working/media', '/working/fonts', '/working/themes'];
  private readonly SCRIPT_PATH = `${BASE_PATH}wasm/x2t/x2t.js`;
  private readonly INIT_TIMEOUT = 300000;

  /**
   * Load X2T script file
   */
  async loadScript(): Promise<void> {
    if (this.hasScriptLoaded) return;

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = this.SCRIPT_PATH;
      script.onload = () => {
        this.hasScriptLoaded = true;
        console.log('X2T WASM script loaded successfully');
        resolve();
      };

      script.onerror = (error) => {
        const errorMsg = 'Failed to load X2T WASM script';
        console.error(errorMsg, error);
        reject(new Error(errorMsg));
      };

      document.head.appendChild(script);
    });
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
    const docType = this.DOCUMENT_TYPE_MAP[extension.toLowerCase()];
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
      throw new Error(`Conversion failed with code: ${result}`);
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
  private readMediaFiles(): Record<string, string> {
    if (!this.x2tModule) return {};

    const media: Record<string, string> = {};

    try {
      const files = this.x2tModule.FS.readdir('/working/media/');

      files
        .filter((file) => file !== '.' && file !== '..')
        .forEach((file) => {
          try {
            const fileData = this.x2tModule!.FS.readFile(`/working/media/${file}`, {
              encoding: 'binary',
            }) as BlobPart;

            const blob = new Blob([fileData]);
            const mediaUrl = window.URL.createObjectURL(blob);
            media[`media/${file}`] = mediaUrl;
          } catch (error) {
            console.warn(`Failed to read media file ${file}:`, error);
          }
        });
    } catch (error) {
      console.warn('Failed to read media directory:', error);
    }

    return media;
  }

  /**
   * Convert document to bin format
   */
  async convertDocument(file: File): Promise<ConversionResult> {
    await this.initialize();

    const fileName = file.name;
    const fileExt = getExtensions(file?.type)[0] || fileName.split('.').pop() || '';
    const documentType = this.getDocumentType(fileExt);

    try {
      // Read file content
      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);

      // Generate safe file name
      const sanitizedName = this.sanitizeFileName(fileName);
      const inputPath = `/working/${sanitizedName}`;
      const outputPath = `${inputPath}.bin`;

      // Write file to virtual file system
      this.x2tModule!.FS.writeFile(inputPath, data);

      // Create conversion parameters
      const params = this.createConversionParams(inputPath, outputPath);
      this.x2tModule!.FS.writeFile('/working/params.xml', params);

      // Execute conversion
      this.executeConversion('/working/params.xml');

      // Read conversion result
      const result = this.x2tModule!.FS.readFile(outputPath);
      const media = this.readMediaFiles();

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
   * Convert bin format to specified format and download
   */
  async convertBinToDocumentAndDownload(
    bin: Uint8Array,
    originalFileName: string,
    targetExt = 'DOCX',
  ): Promise<BinConversionResult> {
    await this.initialize();

    const sanitizedBase = this.sanitizeFileName(originalFileName).replace(/\.[^/.]+$/, '');
    const binFileName = `${sanitizedBase}.bin`;
    const outputFileName = `${sanitizedBase}.${targetExt.toLowerCase()}`;

    try {
      // Write bin file
      this.x2tModule!.FS.writeFile(`/working/${binFileName}`, bin);

      // Create conversion parameters
      let additionalParams = '';
      if (targetExt === 'PDF') {
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

      // Ensure result is Uint8Array type
      const resultArray = result instanceof Uint8Array ? result : new Uint8Array(result as ArrayBuffer);

      // Download file
      // TODO: Improve print functionality
      this.saveWithFileSystemAPI(resultArray, outputFileName);

      return {
        fileName: outputFileName,
        data: result,
      };
    } catch (error) {
      throw new Error(`Bin to document conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Download file
   */
  private downloadFile(data: Uint8Array, fileName: string): void {
    const blob = new Blob([data as BlobPart]);
    const url = window.URL.createObjectURL(blob);
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
      this.downloadFile(data, fileName);
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
      window?.message?.success?.(`${t('fileSavedSuccess')}${fileName}`);
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

export function loadEditorApi(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.DocsAPI) {
      resolve();
      return;
    }

    // Load editor API
    const script = document.createElement('script');
    script.src = './web-apps/apps/api/documents/api.js';
    script.onload = () => resolve();
    script.onerror = (error) => {
      console.error('Failed to load OnlyOffice API:', error);
      alert(t('failedToLoadEditor'));
      reject(error);
    };
    document.head.appendChild(script);
  });
}

// Singleton instance
const x2tConverter = new X2TConverter();
export const loadScript = (): Promise<void> => x2tConverter.loadScript();
export const initX2T = (): Promise<EmscriptenModule> => x2tConverter.initialize();
export const convertDocument = (file: File): Promise<ConversionResult> => x2tConverter.convertDocument(file);
export const convertBinToDocumentAndDownload = (
  bin: Uint8Array,
  fileName: string,
  targetExt?: string,
): Promise<BinConversionResult> => x2tConverter.convertBinToDocumentAndDownload(bin, fileName, targetExt);

// File type constants
export const oAscFileType = {
  UNKNOWN: 0,
  PDF: 513,
  PDFA: 521,
  DJVU: 515,
  XPS: 516,
  DOCX: 65,
  DOC: 66,
  ODT: 67,
  RTF: 68,
  TXT: 69,
  HTML: 70,
  MHT: 71,
  EPUB: 72,
  FB2: 73,
  MOBI: 74,
  DOCM: 75,
  DOTX: 76,
  DOTM: 77,
  FODT: 78,
  OTT: 79,
  DOC_FLAT: 80,
  DOCX_FLAT: 81,
  HTML_IN_CONTAINER: 82,
  DOCX_PACKAGE: 84,
  OFORM: 85,
  DOCXF: 86,
  DOCY: 4097,
  CANVAS_WORD: 8193,
  JSON: 2056,
  XLSX: 257,
  XLS: 258,
  ODS: 259,
  CSV: 260,
  XLSM: 261,
  XLTX: 262,
  XLTM: 263,
  XLSB: 264,
  FODS: 265,
  OTS: 266,
  XLSX_FLAT: 267,
  XLSX_PACKAGE: 268,
  XLSY: 4098,
  PPTX: 129,
  PPT: 130,
  ODP: 131,
  PPSX: 132,
  PPTM: 133,
  PPSM: 134,
  POTX: 135,
  POTM: 136,
  FODP: 137,
  OTP: 138,
  PPTX_PACKAGE: 139,
  IMG: 1024,
  JPG: 1025,
  TIFF: 1026,
  TGA: 1027,
  GIF: 1028,
  PNG: 1029,
  EMF: 1030,
  WMF: 1031,
  BMP: 1032,
  CR2: 1033,
  PCX: 1034,
  RAS: 1035,
  PSD: 1036,
  ICO: 1037,
} as const;

export const c_oAscFileType2 = Object.fromEntries(
  Object.entries(oAscFileType).map(([key, value]) => [value, key]),
) as Record<number, keyof typeof oAscFileType>;

interface SaveEvent {
  data: {
    data: {
      data: Uint8Array;
    };
    option: {
      outputformat: number;
    };
  };
}

async function handleSaveDocument(event: SaveEvent) {
  console.log('Save document event:', event);

  if (event.data && event.data.data) {
    const { data, option } = event.data;
    const { fileName } = getDocmentObj() || {};
    // Create download
    await convertBinToDocumentAndDownload(data.data, fileName, c_oAscFileType2[option.outputformat]);
  }

  // Notify editor that save is complete
  window.editor?.sendCommand({
    command: 'asc_onSaveCallback',
    data: { err_code: 0 },
  });
}

/**
 * Get MIME type from file extension
 * @param extension - File extension
 * @returns string - MIME type
 */
function getMimeTypeFromExtension(extension: string): string {
  const mimeMap: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    bmp: 'image/bmp',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    ico: 'image/x-icon',
    tiff: 'image/tiff',
    tif: 'image/tiff',
  };

  return mimeMap[extension?.toLowerCase()] || 'image/png';
}

// Get document type
export function getDocumentType(fileType: string): string | null {
  const type = fileType.toLowerCase();
  if (type === 'docx' || type === 'doc') {
    return 'word';
  } else if (type === 'xlsx' || type === 'xls' || type === 'csv') {
    return 'cell';
  } else if (type === 'pptx' || type === 'ppt') {
    return 'slide';
  }
  return null;
}
// Global media mapping object
const media: Record<string, string> = {};
/**
 * Handle file write request (mainly for handling pasted images)
 * @param event - OnlyOffice editor file write event
 */
function handleWriteFile(event: any) {
  try {
    console.log('Write file event:', event);

    const { data: eventData } = event;
    if (!eventData) {
      console.warn('No data provided in writeFile event');
      return;
    }

    const {
      data: imageData, // Uint8Array image data
      file: fileName, // File name, e.g., "display8image-174799443357-0.png"
      _target, // Target object containing frameOrigin and other info
    } = eventData;

    // Validate data
    if (!imageData || !(imageData instanceof Uint8Array)) {
      throw new Error('Invalid image data: expected Uint8Array');
    }

    if (!fileName || typeof fileName !== 'string') {
      throw new Error('Invalid file name');
    }

    // Extract extension from file name
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'png';
    const mimeType = getMimeTypeFromExtension(fileExtension);

    // Create Blob object
    const blob = new Blob([imageData as unknown as BlobPart], { type: mimeType });

    // Create object URL
    const objectUrl = window.URL.createObjectURL(blob);
    // Add image URL to media mapping using original file name as key
    media[`media/${fileName}`] = objectUrl;
    window.editor?.sendCommand({
      command: 'asc_setImageUrls',
      data: {
        urls: media,
      },
    });

    window.editor?.sendCommand({
      command: 'asc_writeFileCallback',
      data: {
        // Image base64
        path: objectUrl,
        imgName: fileName,
      },
    });
    console.log(`Successfully processed image: ${fileName}, URL: ${media}`);
  } catch (error) {
    console.error('Error handling writeFile:', error);

    // Notify editor that file processing failed
    if (window.editor && typeof window.editor.sendCommand === 'function') {
      window.editor.sendCommand({
        command: 'asc_writeFileCallback',
        data: {
          success: false,
          error: error.message,
        },
      });
    }

    if (event.callback && typeof event.callback === 'function') {
      event.callback({
        success: false,
        error: error.message,
      });
    }
  }
}

// Public editor creation method
function createEditorInstance(config: {
  fileName: string;
  fileType: string;
  binData: ArrayBuffer | string;
  media?: any;
}) {
  // Clean up old editor instance
  if (window.editor) {
    window.editor.destroyEditor();
    window.editor = undefined;
  }

  const { fileName, fileType, binData, media } = config;

  const editorLang = getOnlyOfficeLang();
  console.log('Setting OnlyOffice editor language to:', editorLang);

  window.editor = new window.DocsAPI.DocEditor('iframe', {
    document: {
      title: fileName,
      url: fileName, // Use file name as identifier
      fileType: fileType,
      permissions: {
        edit: true,
        chat: false,
        protect: false,
      },
    },
    editorConfig: {
      lang: editorLang,
      customization: {
        help: false,
        about: false,
        hideRightMenu: true,
        features: {
          spellcheck: {
            change: false,
          },
        },
        anonymous: {
          request: false,
          label: 'Guest',
        },
      },
    },
    events: {
      onAppReady: () => {
        // Set media resources
        if (media) {
          window.editor?.sendCommand({
            command: 'asc_setImageUrls',
            data: { urls: media },
          });
        }

        // Load document content
        window.editor?.sendCommand({
          command: 'asc_openDocument',
          // @ts-expect-error binData type is handled by the editor
          data: { buf: binData },
        });
      },
      onDocumentReady: () => {
        console.log(`${t('documentLoaded')}${fileName}`);
      },
      onSave: handleSaveDocument,
      // writeFile
      // TODO: writeFile - handle when pasting images from external sources
      writeFile: handleWriteFile,
    },
  });
}

// Merged file operation method
export async function handleDocumentOperation(options: {
  isNew: boolean;
  fileName: string;
  file?: File;
}): Promise<void> {
  try {
    const { isNew, fileName, file } = options;
    const fileType = getExtensions(file?.type || '')[0] || fileName.split('.').pop() || '';
    const _docType = getDocumentType(fileType);

    // Get document content
    let documentData: {
      bin: ArrayBuffer | string;
      media?: any;
    };

    if (isNew) {
      // New document uses empty template
      const emptyBin = g_sEmpty_bin[`.${fileType}`];
      if (!emptyBin) {
        throw new Error(`${t('unsupportedFileType')}${fileType}`);
      }
      documentData = { bin: emptyBin };
    } else {
      // Opening existing document requires conversion
      if (!file) throw new Error(t('invalidFileObject'));
      // @ts-expect-error convertDocument handles the file type conversion
      documentData = await convertDocument(file);
    }

    // Create editor instance
    createEditorInstance({
      fileName,
      fileType,
      binData: documentData.bin,
      media: documentData.media,
    });
  } catch (error: any) {
    console.error(`${t('documentOperationFailed')}`, error);
    alert(`${t('documentOperationFailed')}${error.message}`);
    throw error;
  }
}
