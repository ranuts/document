import { decodeTextBytes } from 'ranuts/utils';
import { BASE_PATH } from '@ranuts/shared/document-utils';

/**
 * The spreadsheet shapes x2t cannot read, handled by SheetJS instead.
 *
 * Two of them: CSV, which the v9 engine will not open at all (it is converted
 * to XLSX on the way in and back to CSV on the way out), and the "HTML table
 * saved with a .xls extension" that web systems export, which x2t cannot
 * import either -- its HTML importer is stubbed out.
 *
 * Both decode through `decodeTextBytes`: a non-fatal utf-8 TextDecoder never
 * throws (invalid sequences become U+FFFD), so strict decoding is the only way
 * to detect a legacy encoding at all. Excel on zh-CN Windows still exports CSV
 * in the ANSI code page, which is why gb18030 is tried before latin1.
 */

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * SheetJS, loaded on demand and shared by the page.
 *
 * Cached on `window` rather than per converter: it is a global the script tag
 * defines, and a second converter would otherwise append a second tag for a
 * library that is already there.
 */
export async function loadXlsxLibrary(): Promise<any> {
  if (typeof window !== 'undefined' && (window as any).XLSX) return (window as any).XLSX;

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${BASE_PATH}libs/sheetjs/xlsx.full.min.js`;
    script.onload = () => {
      if (typeof window !== 'undefined' && (window as any).XLSX) resolve((window as any).XLSX);
      else reject(new Error('Failed to load xlsx library'));
    };
    script.onerror = () => reject(new Error('Failed to load xlsx library from local file'));
    document.head.appendChild(script);
  });
}

/** CSV in, a real XLSX File out, because the engine will not read CSV. */
export async function convertCsvToXlsx(csvData: Uint8Array, fileName: string): Promise<File> {
  try {
    const XLSX = await loadXlsxLibrary();
    const workbook = XLSX.read(decodeTextBytes(csvData), { type: 'string', raw: false });
    const xlsxBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    return new File([xlsxBuffer], fileName.replace(/\.csv$/i, '.xlsx'), { type: XLSX_MIME });
  } catch (error) {
    throw new Error(
      `Failed to convert CSV to XLSX: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
        'Please convert your CSV file to XLSX format manually and try again.',
    );
  }
}

/**
 * An HTML-table document masquerading as a spreadsheet (.xls/.xlsx exports
 * from web systems) into a real XLSX. SheetJS parses `<table>` markup
 * natively; x2t cannot import it at all.
 */
export async function convertHtmlTableToXlsx(htmlData: Uint8Array, fileName: string): Promise<File> {
  try {
    const XLSX = await loadXlsxLibrary();
    const workbook = XLSX.read(decodeTextBytes(htmlData), { type: 'string', raw: false });
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) throw new Error('no table found');
    const xlsxBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    return new File([xlsxBuffer], fileName.replace(/\.[^.]+$/, '') + '.xlsx', { type: XLSX_MIME });
  } catch (error) {
    throw new Error(
      `Failed to convert HTML table to XLSX: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
        'The file is an HTML page saved with a spreadsheet extension; open it in a spreadsheet application and save it as XLSX.',
    );
  }
}
