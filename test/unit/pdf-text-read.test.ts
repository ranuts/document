import { expect, it, vi } from 'vitest';
import { readPdfPageText } from '../../lib/agent-plugin/pdf-text-read';
it('reads a page through native copy without mutating selection or requesting other pages', () => {
  const selection = { Page1: 2 };
  const copySelection = vi.fn(function (this: any, index, output) {
    expect(this.sortSelection().Page1).toBe(index);
    expect(this.isSelectionUse()).toBe(true);
    output.Text = 'Page text\r\n';
  });
  const file = { pages: [{ text: new Uint8Array(1) }], Selection: selection, copySelection };
  expect(readPdfPageText({ DocumentRenderer: { file } }, 1)).toEqual({
    page: 1,
    pages: 1,
    text: 'Page text\n',
    truncated: false,
  });
  expect(file.Selection).toBe(selection);
  expect(file).not.toHaveProperty('sortSelection');
});
it('distinguishes unready or scanned page text from an empty extracted page', () => {
  expect(readPdfPageText({ DocumentRenderer: { file: { pages: [{}] } } }, 1)).toBeUndefined();
});
it('bounds the returned text and rejects invalid page numbers', () => {
  const api = {
    DocumentRenderer: {
      file: {
        pages: [{ text: [] }],
        copySelection(_page: any, out: any) {
          out.Text = 'x'.repeat(9000);
        },
      },
    },
  };
  expect(readPdfPageText(api, 1)?.truncated).toBe(true);
  expect(readPdfPageText(api, 1)?.text).toHaveLength(8000);
  expect(() => readPdfPageText(api, 0)).toThrow();
  expect(() => readPdfPageText(api, 2)).toThrow();
});
