import { getMime } from 'ranuts/utils';
import type { DocumentType } from './document-types';

/**
 * Get base path based on deployment environment
 * - GitHub Pages: uses /document/ path
 * - Docker/Other: uses root path /
 */
export const getBasePath = (): string => {
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

export const BASE_PATH = getBasePath();

/**
 * Parse the `readonly` URL query value into a boolean for pure preview mode.
 * Truthy forms: `?readonly=true`, `?readonly=1`, and bare `?readonly` (empty
 * string). Anything else (including absent / `false`) means editable.
 */
export const parseReadonly = (value: string | undefined): boolean => {
  return value === 'true' || value === '1' || value === '';
};

/**
 * Get document type from file extension
 */
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

/**
 * Get MIME type from file extension (using ranuts getMime utility)
 * @param extension - File extension
 * @returns string - MIME type
 */
export function getMimeTypeFromExtension(extension: string): string {
  // Use ranuts getMime for common image types, fallback to image/png
  const mime = getMime(extension?.toLowerCase() || '');
  return mime || 'image/png';
}

// Canonical MIME map for the document formats this project saves/exports.
// Single source of truth -- lib/onlyoffice-editor.ts and @ranuts/converter
// both delegate here instead of keeping their own copies.
const DOCUMENT_MIME_MAP: Record<string, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  odt: 'application/vnd.oasis.opendocument.text',
  rtf: 'application/rtf',
  txt: 'text/plain',
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  csv: 'text/csv',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ppt: 'application/vnd.ms-powerpoint',
  odp: 'application/vnd.oasis.opendocument.presentation',
};

/**
 * MIME type for a document file name or bare extension; octet-stream for
 * anything outside the supported document formats.
 */
export function getDocumentMimeType(fileNameOrExt: string): string {
  const ext = fileNameOrExt.split('.').pop()?.toLowerCase() || '';
  return DOCUMENT_MIME_MAP[ext] || 'application/octet-stream';
}

/**
 * Document type mapping
 */
export const DOCUMENT_TYPE_MAP: Record<string, DocumentType> = {
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
