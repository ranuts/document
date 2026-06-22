import { getMime } from 'ranuts/utils';
import type { DocumentType } from './document-types';

/**
 * Derive the deployment base path from the current URL.
 *
 * v9 always deploys under a semver prefix (e.g. /9.3.0/, /document/9.3.0/).
 * When a semver segment is present in the path, everything up to and including
 * it is the base (so WASM, fonts, and SDK assets resolve correctly).
 *
 * Examples:
 *   /document/9.3.0/zh-cn/docx/ → /document/9.3.0/
 *   /document/9.3.0/docx/       → /document/9.3.0/
 *   /9.3.0/docx/                → /9.3.0/
 *   /document/                  → /document/   (fallback, GitHub Pages home)
 *   /                           → /            (fallback, root deployment)
 */
export const getBasePath = (): string => {
  if (typeof window === 'undefined') return '/';
  const p = window.location.pathname;
  // Primary: detect semver version prefix (covers all normal v9 deployment paths)
  const m = /^(.*\/\d+\.\d+\.\d+\/)/.exec(p);
  if (m) return m[1];
  // Fallback for unexpected paths (e.g. home page before version prefix is known)
  if (p.startsWith('/document/') || p === '/document') return '/document/';
  return '/';
};

export const BASE_PATH = getBasePath();

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
