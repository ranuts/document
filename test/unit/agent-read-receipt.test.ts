import { expect, it } from 'vitest';
import { readReceipt } from '../../lib/agent-plugin/ui/read-receipt';

it('states that Word reads cover only the document body and identifies partial reads', () => {
  expect(readReceipt('get_document_text', { text: 'Budget 120', truncated: true }, { kind: 'word' })).toBe(
    'Read: Document body · Partial content',
  );
});
it('distinguishes a cell range, slide text and a PDF page without claiming the entire file', () => {
  expect(readReceipt('get_range', { range: 'B2:C4', text: '120' }, { kind: 'cell', sheet: 'Sales', range: 'A1' })).toBe(
    'Read: Sales · B2:C4',
  );
  expect(
    readReceipt(
      'get_presentation_text',
      { text: 'Slide 1', slidesRead: 1, truncated: true },
      { kind: 'slide', page: 3 },
    ),
  ).toBe('Read: Slide text · 1 pages · Partial content');
  expect(readReceipt('get_pdf_text', { text: 'Budget', page: 2 }, { kind: 'pdf', page: 1 })).toBe('Read: PDF · Page 2');
});
it('does not present unreadable content or mutations as a successful read', () => {
  expect(readReceipt('get_pdf_text', { text: '', unavailable: true }, { kind: 'pdf' })).toBe(
    'No readable text is available on this page. Text in scanned images is not supported yet.',
  );
  expect(readReceipt('set_cell', { value: '42' }, { kind: 'cell' })).toBeUndefined();
});
