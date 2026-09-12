import { describe, expect, it } from 'vitest';
import { looksLikeUrl } from '../../lib/onlyoffice/guards/x2t-worker';

/**
 * Which strings the worker proxy resolves itself, and which it hands over.
 *
 * Guard 14 turns whatever the vendor passes into bytes before sending it to
 * the x2t worker. For strings that is only correct when the string is a
 * location: x2t_helper's own `handleFileData` sorts strings into
 * DataURL / BlobURL / FileURL / HttpURL / URL **and `String`**, and that last
 * one is not an error -- it encodes the text as UTF-8 bytes. Fetching it
 * instead would turn a document into a bogus request.
 *
 * So anything this does not call a location crosses the boundary untouched and
 * the vendor decides, exactly as it did before conversion moved out of the
 * frame.
 */
describe('what the x2t proxy treats as a location', () => {
  it('resolves the forms the vendor fetches', () => {
    for (const url of [
      'blob:http://127.0.0.1:4173/2f0a-4d1e',
      'http://example.test/report.docx',
      'https://example.test/report.docx',
      'file:///Users/x/report.docx',
      'data:application/octet-stream;base64,AAAA',
    ]) {
      expect(looksLikeUrl(url), url).toBe(true);
    }
  });

  it('leaves document text alone', () => {
    // The empty-document template the offline patch hands the editor, and the
    // shape #113 was about: a latin1 string carrying its DOCY header.
    for (const text of ['DOCY;v5;7372;AAAA', 'plain text', '', '   ', 'Editor.bin']) {
      expect(looksLikeUrl(text), JSON.stringify(text)).toBe(false);
    }
  });
});
