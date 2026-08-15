import { describe, expect, it } from 'vitest';
import {
  DOCUMENT_TYPE_MAP,
  getBasePath,
  getDocumentType,
  getMimeTypeFromExtension,
  parseReadonly,
} from '@ranuts/shared/document-utils';

describe('document utils', () => {
  it('classifies common document extensions', () => {
    expect(getDocumentType('docx')).toBe('word');
    expect(getDocumentType('xlsx')).toBe('cell');
    expect(getDocumentType('csv')).toBe('cell');
    expect(getDocumentType('pptx')).toBe('slide');
  });

  it('normalizes extension casing for MIME lookup', () => {
    expect(getMimeTypeFromExtension('XLSX')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  });

  it('uses image/png fallback for unknown MIME extensions', () => {
    expect(getMimeTypeFromExtension('unknown')).toBe('image/png');
    expect(getMimeTypeFromExtension('')).toBe('image/png');
  });

  it('parses the readonly query value for preview mode', () => {
    // Truthy forms
    expect(parseReadonly('true')).toBe(true);
    expect(parseReadonly('1')).toBe(true);
    expect(parseReadonly('')).toBe(true); // bare ?readonly
    // Falsy forms
    expect(parseReadonly('false')).toBe(false);
    expect(parseReadonly('0')).toBe(false);
    expect(parseReadonly(undefined)).toBe(false);
    expect(parseReadonly('yes')).toBe(false);
  });

  it('detects GitHub Pages base path', () => {
    window.history.pushState({}, '', '/document/');
    expect(getBasePath()).toBe('/document/');

    window.history.pushState({}, '', '/');
    expect(getBasePath()).toBe('/');
  });

  it('keeps the supported document type map stable', () => {
    expect(DOCUMENT_TYPE_MAP).toMatchInlineSnapshot(`
      {
        "csv": "cell",
        "doc": "word",
        "docx": "word",
        "odp": "slide",
        "ods": "cell",
        "odt": "word",
        "pdf": "pdf",
        "ppt": "slide",
        "pptx": "slide",
        "rtf": "word",
        "txt": "word",
        "xls": "cell",
        "xlsx": "cell",
      }
    `);
  });
});
