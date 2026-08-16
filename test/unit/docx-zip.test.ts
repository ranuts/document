import { deflateRawSync } from 'node:zlib';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { readZipEntries, readZipEntry } from 'ranuts/utils';
import {
  extractDocxMediaUrls,
  preprocessDocxRuby,
  preprocessPptx,
  preprocessXlsxLineBreaks,
  unwrapRubyXml,
} from '@ranuts/converter';

/**
 * OOXML files are ZIP archives, so these functions operate on real binaries.
 * Hence real archives as fixtures rather than stubs, covering DEFLATE entries,
 * STORED entries, and streaming-writer output (zeros in the local header, real
 * values only in the data descriptor) — that last case being exactly where
 * hand-rolled ZIP parsers tend to break.
 */

const enc = new TextEncoder();

interface FixtureEntry {
  name: string;
  content: string | Uint8Array;
  /** Store the entry DEFLATE-compressed (method 8); defaults to STORED. */
  deflate?: boolean;
  /** Mimic a streaming writer: zeros in the local header, real values only in the central directory. */
  streamed?: boolean;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

const crc32 = (data: Uint8Array): number => {
  let c = 0xffffffff;
  for (const byte of data) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

/** Assemble a genuine ZIP archive (local headers + central directory + EOCD). */
const buildZip = (entries: FixtureEntry[]): Uint8Array => {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const raw = typeof entry.content === 'string' ? enc.encode(entry.content) : entry.content;
    const stored = entry.deflate ? new Uint8Array(deflateRawSync(raw)) : raw;
    const nameBytes = enc.encode(entry.name);
    const crc = crc32(raw);
    const method = entry.deflate ? 8 : 0;
    // Streaming writer: zero the local header, set general-purpose bit 3, and
    // leave the real values only in the central directory.
    const flags = entry.streamed ? 0x08 : 0;

    const local = new Uint8Array(30 + nameBytes.length + stored.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, flags, true);
    lv.setUint16(8, method, true);
    lv.setUint32(14, entry.streamed ? 0 : crc, true);
    lv.setUint32(18, entry.streamed ? 0 : stored.length, true);
    lv.setUint32(22, entry.streamed ? 0 : raw.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(stored, 30 + nameBytes.length);
    locals.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, flags, true);
    cv.setUint16(10, method, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, stored.length, true);
    cv.setUint32(24, raw.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centrals.push(central);

    offset += local.length;
  }

  const centralSize = centrals.reduce((n, c) => n + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const total = offset + centralSize + eocd.length;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const part of [...locals, ...centrals, eocd]) {
    out.set(part, pos);
    pos += part.length;
  }
  return out;
};

const textOf = async (zip: Uint8Array, name: string): Promise<string> => {
  const data = await readZipEntry(zip, name);
  return data ? new TextDecoder().decode(data) : '';
};

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 5, 6, 7, 8]);

beforeAll(() => {
  // jsdom does not implement createObjectURL.
  if (!URL.createObjectURL) {
    Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:stub'), configurable: true });
  }
});

describe('extractDocxMediaUrls', () => {
  it('extracts word/media entries from a DOCX (DEFLATE-compressed)', async () => {
    const zip = buildZip([
      { name: 'word/document.xml', content: '<w:document/>' },
      { name: 'word/media/image1.png', content: PNG, deflate: true },
    ]);
    const urls = await extractDocxMediaUrls(zip);
    expect(Object.keys(urls)).toEqual(['media/image1.png']);
  });

  it('covers the XLSX and PPTX media directories too', async () => {
    const xlsx = buildZip([{ name: 'xl/media/image2.jpg', content: PNG }]);
    const pptx = buildZip([{ name: 'ppt/media/image3.gif', content: PNG }]);
    expect(Object.keys(await extractDocxMediaUrls(xlsx))).toEqual(['media/image2.jpg']);
    expect(Object.keys(await extractDocxMediaUrls(pptx))).toEqual(['media/image3.gif']);
  });

  it('reads streaming-writer output: local header is 0, sizes come from the central directory', async () => {
    // Regression guard: reading sizes from the local header yields 0 bytes and
    // silently loses every media file.
    const zip = buildZip([{ name: 'word/media/image1.png', content: PNG, deflate: true, streamed: true }]);
    expect(Object.keys(await extractDocxMediaUrls(zip))).toEqual(['media/image1.png']);
  });

  it('ignores directory entries and non-media files', async () => {
    const zip = buildZip([
      { name: 'word/media/', content: '' },
      { name: 'word/document.xml', content: '<w:document/>' },
    ]);
    expect(await extractDocxMediaUrls(zip)).toEqual({});
  });

  it('returns empty instead of throwing on input that is not a ZIP', async () => {
    expect(await extractDocxMediaUrls(enc.encode('not a zip at all'))).toEqual({});
  });
});

describe('preprocessXlsxLineBreaks', () => {
  it('restores double-escaped line breaks back to &#10;', async () => {
    const zip = buildZip([
      { name: 'xl/sharedStrings.xml', content: '<t>a&amp;#10;b</t>', deflate: true },
      { name: 'xl/workbook.xml', content: '<workbook/>' },
    ]);
    const out = await preprocessXlsxLineBreaks(zip);
    expect(await textOf(out, 'xl/sharedStrings.xml')).toBe('<t>a&#10;b</t>');
  });

  it('leaves other entries untouched and keeps the archive readable', async () => {
    const zip = buildZip([
      { name: 'xl/sharedStrings.xml', content: '<t>a&amp;#10;b</t>' },
      { name: 'xl/workbook.xml', content: '<workbook/>' },
      { name: 'docProps/core.xml', content: '<core/>' },
    ]);
    const out = await preprocessXlsxLineBreaks(zip);
    expect(
      readZipEntries(out)
        .map((e) => e.name)
        .sort(),
    ).toEqual(['docProps/core.xml', 'xl/sharedStrings.xml', 'xl/workbook.xml']);
    expect(await textOf(out, 'xl/workbook.xml')).toBe('<workbook/>');
  });

  it('returns the input as-is when there is nothing to rewrite', async () => {
    const zip = buildZip([{ name: 'xl/workbook.xml', content: '<workbook/>' }]);
    expect(await preprocessXlsxLineBreaks(zip)).toBe(zip);
  });
});

describe('preprocessPptx', () => {
  const RELS =
    '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://x/officeDocument" Target="ppt/presentation.xml"/>' +
    '</Relationships>';

  it('injects app.xml / core.xml when missing and adds their relationships to .rels', async () => {
    const zip = buildZip([
      { name: '_rels/.rels', content: RELS },
      { name: 'ppt/presentation.xml', content: '<p:presentation/>' },
    ]);
    const out = await preprocessPptx(zip);
    const names = readZipEntries(out).map((e) => e.name);
    expect(names).toContain('docProps/app.xml');
    expect(names).toContain('docProps/core.xml');

    const rels = await textOf(out, '_rels/.rels');
    expect(rels).toContain('docProps/app.xml');
    expect(rels).toContain('docProps/core.xml');
    // New relationship ids must avoid the already-used rId1.
    expect(rels).toContain('rId2');
    expect(rels).toContain('rId3');
  });

  it('does not re-inject when app.xml / core.xml already exist', async () => {
    const zip = buildZip([
      { name: '_rels/.rels', content: RELS },
      { name: 'docProps/app.xml', content: '<Properties/>' },
      { name: 'docProps/core.xml', content: '<cp:coreProperties/>' },
      { name: 'ppt/notesSlides/notesSlide1.xml', content: '<p:notes showMasterPhAnim="1"/>' },
    ]);
    const out = await preprocessPptx(zip);
    const names = readZipEntries(out).map((e) => e.name);
    expect(names.filter((n) => n === 'docProps/app.xml')).toHaveLength(1);
    expect(await textOf(out, '_rels/.rels')).toBe(RELS);
  });

  it('strips showMasterPhAnim from notes slides', async () => {
    const zip = buildZip([
      { name: '_rels/.rels', content: RELS },
      { name: 'docProps/app.xml', content: '<Properties/>' },
      { name: 'docProps/core.xml', content: '<cp:coreProperties/>' },
      {
        name: 'ppt/notesSlides/notesSlide1.xml',
        content: '<p:notes showMasterPhAnim="1"><x/></p:notes>',
        deflate: true,
      },
    ]);
    const out = await preprocessPptx(zip);
    expect(await textOf(out, 'ppt/notesSlides/notesSlide1.xml')).toBe('<p:notes><x/></p:notes>');
  });

  it('keeps every entry of the rebuilt archive decodable to its original content', async () => {
    const zip = buildZip([
      { name: '_rels/.rels', content: RELS },
      { name: 'ppt/presentation.xml', content: '<p:presentation/>', deflate: true },
      { name: 'ppt/media/image1.png', content: PNG, deflate: true },
    ]);
    const out = await preprocessPptx(zip);
    expect(await textOf(out, 'ppt/presentation.xml')).toBe('<p:presentation/>');
    const media = await readZipEntry(out, 'ppt/media/image1.png');
    expect(media && Array.from(media)).toEqual(Array.from(PNG));
  });
});

describe('ruby (phonetic guide) unwrapping', () => {
  const RUBY =
    '<w:p><w:r><w:rPr><w:sz w:val="22"/></w:rPr>' +
    '<w:ruby><w:rubyPr><w:lid w:val="ja-JP"/></w:rubyPr>' +
    '<w:rt><w:r><w:rPr><w:sz w:val="11"/></w:rPr><w:t>とうきょう</w:t></w:r></w:rt>' +
    '<w:rubyBase><w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t>東京</w:t></w:r></w:rubyBase>' +
    '</w:ruby></w:r><w:r><w:t>へ行く</w:t></w:r></w:p>';

  it('unwrapRubyXml keeps the base word, drops the guide, and leaves runs balanced', () => {
    const out = unwrapRubyXml(RUBY)!;
    expect(out).toContain('<w:t>東京</w:t>');
    expect(out).not.toContain('とうきょう');
    expect(out).not.toContain('<w:ruby');
    expect(out).toContain('<w:t>へ行く</w:t>');
    // Every <w:r> opened is closed and no run nests inside another.
    expect((out.match(/<w:r>|<w:r\s/g) || []).length).toBe((out.match(/<\/w:r>/g) || []).length);
    expect(out).not.toMatch(/<w:r>(?:(?!<\/w:r>)[\s\S])*<w:r>/);
  });

  it('unwrapRubyXml returns null when there is no ruby', () => {
    expect(unwrapRubyXml('<w:p><w:r><w:t>plain</w:t></w:r></w:p>')).toBeNull();
  });

  it('preprocessDocxRuby rewrites word/*.xml parts that carry ruby and returns the input as-is otherwise', async () => {
    const zip = buildZip([
      { name: 'word/document.xml', content: `<w:document><w:body>${RUBY}</w:body></w:document>`, deflate: true },
      { name: 'word/header1.xml', content: `<w:hdr>${RUBY}</w:hdr>` },
      { name: '[Content_Types].xml', content: '<Types/>' },
    ]);
    const out = await preprocessDocxRuby(zip);
    expect(await textOf(out, 'word/document.xml')).toContain('<w:t>東京</w:t>');
    expect(await textOf(out, 'word/document.xml')).not.toContain('<w:ruby');
    expect(await textOf(out, 'word/header1.xml')).not.toContain('<w:ruby');
    expect(await textOf(out, '[Content_Types].xml')).toBe('<Types/>');

    const plain = buildZip([{ name: 'word/document.xml', content: '<w:document><w:body/></w:document>' }]);
    expect(await preprocessDocxRuby(plain)).toBe(plain);
  });
});
