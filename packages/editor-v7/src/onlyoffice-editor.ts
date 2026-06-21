import 'ranui/message';
import { createObjectURL } from 'ranuts/utils';
import { getOnlyOfficeLang, t } from './i18n';
import { c_oAscFileType2 } from '@bybrowser/core';
import type { BinConversionResult, SaveEvent } from './document-types';
import { getMimeTypeFromExtension } from './document-utils';

// Store decoupling — inject from app layer via setDocumentStateGetter()
type DocumentState = { fileName?: string; file?: File } | null;
type DocumentStateGetter = () => DocumentState;
let _getDocumentState: DocumentStateGetter = () => null;
export function setDocumentStateGetter(getter: DocumentStateGetter): void {
  _getDocumentState = getter;
}

// Import converter function to avoid circular dependency
let convertBinToDocumentFn:
  | ((bin: Uint8Array, fileName: string, targetExt?: string) => Promise<BinConversionResult>)
  | null = null;
let convertBinToDocumentAndDownloadFn:
  | ((bin: Uint8Array, fileName: string, targetExt?: string) => Promise<BinConversionResult>)
  | null = null;

export function setConverterCallbacks(callbacks: {
  convert: (bin: Uint8Array, fileName: string, targetExt?: string) => Promise<BinConversionResult>;
  convertAndDownload: (bin: Uint8Array, fileName: string, targetExt?: string) => Promise<BinConversionResult>;
}): void {
  convertBinToDocumentFn = callbacks.convert;
  convertBinToDocumentAndDownloadFn = callbacks.convertAndDownload;
}

// Global media mapping object
const media: Record<string, string> = {};

// Editor operation queue to prevent concurrent operations
let editorOperationQueue: Promise<void> = Promise.resolve();
let isReadonlyMode = false;

type EmbeddedSaveRequest = {
  targetExt?: string;
  resolve: (file: File) => void;
  reject: (error: Error) => void;
  timeoutId: number;
  fallbackId: number;
  settled: boolean;
};

let embeddedSaveRequest: EmbeddedSaveRequest | null = null;

export function getSavedFileMimeType(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  const mimeMap: Record<string, string> = {
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls: 'application/vnd.ms-excel',
    csv: 'text/csv',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ppt: 'application/vnd.ms-powerpoint',
    pdf: 'application/pdf',
  };
  return mimeMap[extension] || 'application/octet-stream';
}

export function getNormalizedFile(file: File): File {
  const mimeType = !file.type || file.type === 'application/octet-stream' ? getSavedFileMimeType(file.name) : file.type;
  return new File([file], file.name, { type: mimeType });
}

export function toUint8Array(data: BlobPart): Uint8Array {
  if (data instanceof Uint8Array) {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  if (ArrayBuffer.isView(data)) {
    const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    return new Uint8Array(arrayBuffer);
  }
  throw new Error('Unsupported saved data type');
}

function getFileExtension(fileName: string): string {
  return fileName.split('.').pop()?.toUpperCase() || '';
}

function isEmbedMode(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const params = new URLSearchParams(window.location.search);
  const embed = params.get('embed') || params.get('embedded');
  return window.parent !== window || embed === '' || embed === '1' || embed === 'true';
}

function resolveEmbeddedSaveRequest(request: EmbeddedSaveRequest, file: File): void {
  if (request.settled) {
    return;
  }
  request.settled = true;
  request.resolve(file);
}

function rejectEmbeddedSaveRequest(request: EmbeddedSaveRequest, error: Error): void {
  if (request.settled) {
    return;
  }
  request.settled = true;
  request.reject(error);
}

function cleanupEmbeddedSaveRequest(request: EmbeddedSaveRequest): void {
  window.clearTimeout(request.timeoutId);
  window.clearTimeout(request.fallbackId);
  if (embeddedSaveRequest === request) {
    embeddedSaveRequest = null;
  }
}

async function queueEditorOperation<T>(operation: () => Promise<T>): Promise<T> {
  try {
    await Promise.race([
      editorOperationQueue,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Editor operation queue timeout')), 30000)),
    ]);
  } catch (error) {
    if (error instanceof Error && error.message === 'Editor operation queue timeout') {
      console.warn('Editor operation queue timeout, proceeding anyway');
    } else {
      throw error;
    }
  }

  let resolveOperation: () => void;
  let rejectOperation: (error: any) => void;
  const operationPromise = new Promise<void>((resolve, reject) => {
    resolveOperation = resolve;
    rejectOperation = reject;
  });

  editorOperationQueue = operationPromise;

  try {
    const result = await operation();
    resolveOperation!();
    return result;
  } catch (error) {
    rejectOperation!(error);
    throw error;
  }
}

async function handleWriteFile(event: any) {
  try {
    const { data: eventData } = event;
    if (!eventData) {
      console.warn('No data provided in writeFile event');
      return;
    }

    const { data: imageData, file: fileName } = eventData;

    if (!imageData || !(imageData instanceof Uint8Array)) {
      throw new Error('Invalid image data: expected Uint8Array');
    }

    if (!fileName || typeof fileName !== 'string') {
      throw new Error('Invalid file name');
    }

    const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'png';
    const mimeType = getMimeTypeFromExtension(fileExtension);
    const blob = new Blob([imageData as unknown as BlobPart], { type: mimeType });
    const objectUrl = await createObjectURL(blob);
    media[`media/${fileName}`] = objectUrl;

    window.editor?.sendCommand({
      command: 'asc_setImageUrls',
      data: { urls: media },
    });

    window.editor?.sendCommand({
      command: 'asc_writeFileCallback',
      data: { path: objectUrl, imgName: fileName },
    });
  } catch (error: any) {
    console.error('Error handling writeFile:', error);

    if (window.editor && typeof window.editor.sendCommand === 'function') {
      window.editor.sendCommand({
        command: 'asc_writeFileCallback',
        data: { success: false, error: error.message },
      });
    }

    if (event.callback && typeof event.callback === 'function') {
      event.callback({ success: false, error: error.message });
    }
  }
}

async function handleSaveDocument(event: SaveEvent) {
  if (event.data && event.data.data) {
    const { data, option } = event.data;
    const { fileName } = _getDocumentState() || {};

    let targetFormat = c_oAscFileType2[option.outputformat];

    if (fileName && fileName.toLowerCase().endsWith('.csv')) {
      targetFormat = 'CSV';
    }

    if (embeddedSaveRequest) {
      if (!convertBinToDocumentFn) {
        throw new Error('Converter callback not set');
      }

      const request = embeddedSaveRequest;
      cleanupEmbeddedSaveRequest(request);

      try {
        const result = await convertBinToDocumentFn(data.data, fileName ?? '', request.targetExt || targetFormat);
        const bytes = toUint8Array(result.data);
        const file = new File([bytes as BlobPart], result.fileName, { type: getSavedFileMimeType(result.fileName) });
        resolveEmbeddedSaveRequest(request, file);
      } catch (error) {
        rejectEmbeddedSaveRequest(request, error instanceof Error ? error : new Error(String(error)));
        throw error;
      }
    } else if (isEmbedMode()) {
      console.warn('Local save is disabled in iframe embed mode. Use document:save from the parent page.');
    } else if (convertBinToDocumentAndDownloadFn) {
      await convertBinToDocumentAndDownloadFn(data.data, fileName ?? '', targetFormat);
    } else {
      throw new Error('Converter callback not set');
    }
  }

  window.editor?.sendCommand({
    command: 'asc_onSaveCallback',
    data: { err_code: 0 },
  });
}

async function handleDownloadAs(event: { data?: { url?: string; fileType?: string } }): Promise<void> {
  if (!embeddedSaveRequest) {
    console.warn('Local download is disabled in iframe embed mode. Use document:save from the parent page.');
    return;
  }

  const request = embeddedSaveRequest;
  cleanupEmbeddedSaveRequest(request);

  try {
    const url = event.data?.url;
    if (!url) {
      throw new Error('Download URL is empty');
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch exported file: ${response.status} ${response.statusText}`);
    }

    const blob = await response.blob();
    const { fileName } = _getDocumentState() || {};
    const baseName = (fileName || 'document').replace(/\.[^/.]+$/, '');
    const ext = (request.targetExt || event.data?.fileType || 'XLSX').toLowerCase();
    const savedFileName = `${baseName}.${ext}`;
    const file = new File([blob], savedFileName, { type: blob.type || getSavedFileMimeType(savedFileName) });
    resolveEmbeddedSaveRequest(request, file);
  } catch (error) {
    rejectEmbeddedSaveRequest(request, error instanceof Error ? error : new Error(String(error)));
  }
}

export function createEditorInstance(config: {
  fileName: string;
  fileType: string;
  binData: ArrayBuffer | string;
  media?: any;
  readonly?: boolean;
}): Promise<void> {
  return queueEditorOperation(async () => {
    const { fileName, fileType, binData, media: mediaUrls, readonly = false } = config;
    isReadonlyMode = readonly;

    const hasExistingEditor = !!window.editor;

    if (window.editor) {
      try {
        window.editor.destroyEditor();
        const isPresentation = fileType === 'pptx' || fileType === 'ppt';
        const destroyDelay = hasExistingEditor && isPresentation ? 400 : hasExistingEditor ? 250 : 150;
        await new Promise((resolve) => setTimeout(resolve, destroyDelay));
      } catch (error) {
        console.warn('Error destroying previous editor:', error);
      }
      window.editor = undefined;
    }

    const iframeContainer = document.getElementById('iframe');
    if (iframeContainer) {
      while (iframeContainer.firstChild) {
        iframeContainer.removeChild(iframeContainer.firstChild);
      }
    }

    const isPresentation = fileType === 'pptx' || fileType === 'ppt';
    const cleanupDelay = hasExistingEditor && isPresentation ? 400 : hasExistingEditor ? 250 : 150;
    await new Promise((resolve) => setTimeout(resolve, cleanupDelay));

    const editorLang = getOnlyOfficeLang();

    try {
      window.editor = new window.DocsAPI.DocEditor('iframe', {
        document: {
          title: fileName,
          url: fileName,
          fileType: fileType,
          permissions: {
            edit: !readonly,
            download: !readonly,
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
            if (mediaUrls) {
              window.editor?.sendCommand({
                command: 'asc_setImageUrls',
                data: { urls: mediaUrls },
              });
            }

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
          onDownloadAs: handleDownloadAs,
          writeFile: handleWriteFile,
        },
      });
    } catch (error) {
      console.error('Error creating editor instance:', error);
      throw error;
    }
  });
}

export function setReadonlyMode(readonly: boolean): void {
  isReadonlyMode = readonly;
  window.editor?.sendCommand({
    command: 'processRightsChange',
    data: {
      enabled: !readonly,
      message: readonly ? 'Readonly mode' : '',
    } as any,
  });
}

export function getReadonlyMode(): boolean {
  return isReadonlyMode;
}

export function requestSaveDocument(
  targetExt = 'XLSX',
  options: {
    returnOriginalOnTimeout?: boolean;
  } = {},
): Promise<File> {
  if (!window.editor) {
    return Promise.reject(new Error('No document is open'));
  }

  if (isReadonlyMode) {
    return Promise.reject(new Error('Current document is readonly'));
  }

  if (embeddedSaveRequest) {
    return Promise.reject(new Error('A save request is already in progress'));
  }

  return new Promise<File>((resolve, reject) => {
    const normalizedTargetExt = targetExt.toUpperCase();

    const fallbackId = window.setTimeout(() => {
      if (!embeddedSaveRequest || embeddedSaveRequest.settled) {
        return;
      }

      const { file, fileName } = _getDocumentState() || {};
      const originalExt = getFileExtension(fileName || file?.name || '');

      if (options.returnOriginalOnTimeout && file && originalExt === normalizedTargetExt) {
        const request = embeddedSaveRequest;
        cleanupEmbeddedSaveRequest(request);
        resolveEmbeddedSaveRequest(request, getNormalizedFile(file));
      }
    }, 8000);

    const timeoutId = window.setTimeout(() => {
      if (!embeddedSaveRequest) {
        return;
      }
      const request = embeddedSaveRequest;
      cleanupEmbeddedSaveRequest(request);
      rejectEmbeddedSaveRequest(request, new Error('Save request timed out before receiving edited file data'));
    }, 60000);

    embeddedSaveRequest = {
      targetExt: normalizedTargetExt,
      resolve,
      reject,
      timeoutId,
      fallbackId,
      settled: false,
    };

    const editor = window.editor;
    if (!editor || typeof editor.downloadAs !== 'function') {
      const request = embeddedSaveRequest;
      cleanupEmbeddedSaveRequest(request);
      rejectEmbeddedSaveRequest(request, new Error('The current editor does not support downloadAs export'));
      return;
    }

    editor.downloadAs(normalizedTargetExt);
  });
}

export function loadEditorApi(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.DocsAPI) {
      resolve();
      return;
    }

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
