import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { expect, it } from 'vitest';

function conversion(operation: string, data: string | ArrayBuffer) {
  let response: { ok: boolean; data: ArrayBuffer; error?: string };
  const context = createContext({
    URL,
    ArrayBuffer,
    Uint8Array,
    TextEncoder,
    TextDecoder,
    self: {
      location: { href: 'https://example.com/document/libs/sheetjs/convert.worker.js' },
      postMessage: (result: typeof response) => {
        response = result;
      },
    },
    importScripts: (url: string) => {
      expect(url).toBe('https://example.com/document/libs/sheetjs/xlsx.full.min.js');
      runInContext(readFileSync('public/libs/sheetjs/xlsx.full.min.js', 'utf8'), context);
    },
  });
  runInContext(readFileSync('public/libs/sheetjs/convert.worker.js', 'utf8'), context);
  context.self.onmessage({ data: { operation, data } });
  return response!;
}
it.each([
  ['csv-to-xlsx', 'name,value\n中文,12'],
  ['html-to-xlsx', '<table><tr><td rowspan="2">中文</td><td>12</td></tr><tr><td>13</td></tr></table>'],
])('converts %s and round trips text through the real local SheetJS worker', (operation, input) => {
  const xlsx = conversion(operation, input);
  expect(xlsx.ok).toBe(true);
  expect([...new Uint8Array(xlsx.data).slice(0, 2)]).toEqual([0x50, 0x4b]);
  const csv = conversion('xlsx-to-csv', xlsx.data);
  expect(csv.ok).toBe(true);
  expect([...new Uint8Array(csv.data).slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  expect(new TextDecoder().decode(csv.data)).toContain('中文,12');
});
it('returns a bounded error for malformed operations', () => {
  expect(conversion('invalid', 'x')).toMatchObject({ ok: false, error: 'Invalid spreadsheet conversion request' });
});
