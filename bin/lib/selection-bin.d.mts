export interface SelectionRecord {
  name: string;
  altNames: string[];
  path: string;
  index: number;
  italic: number;
  bold: number;
  fixed: number;
  panose: number[];
  unicodeRange: number[];
  codePageRange: number[];
  weight: number;
  width: number;
  familyClass: number;
  format: number;
  avgCharWidth: number;
  ascent: number;
  descent: number;
  lineGap: number;
  xHeight: number;
  capHeight: number;
  type: number;
  trailing?: Buffer;
}

export function decode(base64: string): { records: SelectionRecord[]; tail: Buffer };
export function encode(input: { records: SelectionRecord[]; tail?: Buffer }): string;
export function buildRecord(buf: Buffer, opts: { path: string }): SelectionRecord;
