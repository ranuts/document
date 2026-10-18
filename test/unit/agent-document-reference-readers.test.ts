import { zip } from '../fixtures/helpers/reference-files';
import { expect, it, vi } from 'vitest';
import { readOfficeReference } from '../../lib/agent-plugin/references/document-reference-readers';

it('extracts paragraphs and table paragraphs in DOCX document order', async () => {
  const xml =
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>First</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Cell</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:p><w:r><w:t>Last</w:t></w:r></w:p></w:body></w:document>';
  expect(await readOfficeReference(zip({ 'word/document.xml': xml }), 'docx')).toBe('First\nCell\nLast');
});
it('rejects malformed archives, excessive XML nodes, cancellation and output overflow', async () => {
  await expect(readOfficeReference(new Uint8Array([1, 2]), 'docx')).rejects.toThrow('source-corrupt');
  await expect(
    readOfficeReference(zip({ 'word/document.xml': '<x>' + '<a/>'.repeat(100001) + '</x>' }), 'docx'),
  ).rejects.toThrow('source-too-large');
  await expect(
    readOfficeReference(zip({ 'word/document.xml': '<x><p><t>' + 'x'.repeat(262145) + '</t></p></x>' }), 'docx'),
  ).rejects.toThrow('source-too-large');
  const controller = new AbortController();
  controller.abort();
  await expect(readOfficeReference(zip({}), 'docx', controller.signal)).rejects.toThrow();
});
it('reads real deflated entries and rejects inflated limits even when header sizes lie', async () => {
  expect(await readOfficeReference(zip({ 'word/document.xml': '<x><p><t>Deflated</t></p></x>' }, true), 'docx')).toBe(
    'Deflated',
  );
  const huge = zip({ 'word/document.xml': '<x>' + ' '.repeat(32 * 1024 * 1024) + '</x>' }, true);
  // Untrusted size metadata must not bypass actual expansion accounting.
  const v = new DataView(huge.buffer);
  v.setUint32(22, 1, true);
  for (let i = 0; i < huge.length - 46; i++)
    if (v.getUint32(i, true) === 0x02014b50) {
      v.setUint32(i + 24, 1, true);
      break;
    }
  await expect(readOfficeReference(huge, 'docx')).rejects.toThrow('source-too-large');
});
it('uses presentation relationship order rather than lexical slide names or masters', async () => {
  const entries = {
    'ppt/presentation.xml':
      '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId r:id="b"/><p:sldId r:id="a"/></p:sldIdLst></p:presentation>',
    'ppt/_rels/presentation.xml.rels':
      '<Relationships><Relationship Id="a" Target="slides/slide1.xml"/><Relationship Id="b" Target="slides/slide10.xml"/></Relationships>',
    'ppt/slides/slide1.xml': '<x><p><t>One</t></p></x>',
    'ppt/slides/slide10.xml': '<x><p><t>Ten</t></p></x>',
    'ppt/slideMasters/slide1.xml': '<x><p><t>Ignore master</t></p></x>',
  };
  expect(await readOfficeReference(zip(entries), 'pptx')).toBe('Ten\nOne');
});
it('reads all workbook sheets, inline/shared strings and cached values without evaluating formulas', async () => {
  const entries = {
    'xl/workbook.xml':
      '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet A" r:id="a"/><sheet name="Sheet B" r:id="b"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':
      '<Relationships><Relationship Id="a" Target="worksheets/sheet1.xml"/><Relationship Id="b" Target="worksheets/sheet2.xml"/></Relationships>',
    'xl/sharedStrings.xml': '<sst><si><t>Shared</t></si></sst>',
    'xl/worksheets/sheet1.xml':
      '<worksheet><row><c t="s"><v>0</v></c><c t="inlineStr"><is><t>Inline</t></is></c><c><f>HYPERLINK("https://example.com")</f><v>3</v></c></row></worksheet>',
    'xl/worksheets/sheet2.xml': '<worksheet><row><c><v>4</v></c></row></worksheet>',
  };
  expect(await readOfficeReference(zip(entries), 'xlsx')).toBe('Sheet A\nShared\tInline\t3\nSheet B\n4');
  entries['xl/worksheets/sheet2.xml'] = '<worksheet><row>' + '<c><v>4</v></c>'.repeat(10001) + '</row></worksheet>';
  await expect(readOfficeReference(zip(entries), 'xlsx')).rejects.toThrow('source-too-large');
});
it('stops after cancellation during the XML budget scan and respects extraction deadline', async () => {
  const controller = new AbortController();
  const pending = readOfficeReference(
    zip({ 'word/document.xml': '<x>' + '<p><t>word</t></p>'.repeat(5000) + '</x>' }),
    'docx',
    controller.signal,
  );
  setTimeout(() => controller.abort(), 0);
  await expect(pending).rejects.toThrow();
});
it('rejects corrupted ZIP CRC and mismatched local entry names', async () => {
  const bytes = zip({ 'word/document.xml': '<x><p><t>original</t></p></x>' });
  const changed = bytes.slice();
  const where = Buffer.from(changed).indexOf('original');
  changed[where] = 65;
  await expect(readOfficeReference(changed, 'docx')).rejects.toThrow('source-corrupt');
  const mismatch = bytes.slice();
  mismatch[30] = 65;
  await expect(readOfficeReference(mismatch, 'docx')).rejects.toThrow('source-corrupt');
});
it('does not duplicate text in nested text-box paragraphs', async () => {
  expect(
    await readOfficeReference(
      zip({ 'word/document.xml': '<x><p><t>Outer</t><box><p><t>Inner</t></p></box><t>End</t></p></x>' }),
      'docx',
    ),
  ).toBe('Outer\nInner\nEnd');
});
it('rejects entry, compressed input, paragraph, sheet and entity budgets', async () => {
  await expect(readOfficeReference(new Uint8Array(20 * 1024 * 1024 + 1), 'docx')).rejects.toThrow('source-too-large');
  const count = zip({});
  new DataView(count.buffer).setUint16(10, 2001, true);
  await expect(readOfficeReference(count, 'docx')).rejects.toThrow('source-too-large');
  await expect(
    readOfficeReference(zip({ 'word/document.xml': '<x>' + '<p><t>x</t></p>'.repeat(10001) + '</x>' }), 'docx'),
  ).rejects.toThrow('source-too-large');
  await expect(
    readOfficeReference(
      zip({ 'word/document.xml': '<!DOCTYPE x [<!ENTITY e "unsafe">]><x><p><t>&e;</t></p></x>' }),
      'docx',
    ),
  ).rejects.toThrow('source-corrupt');
  await expect(
    readOfficeReference(
      zip({
        'xl/workbook.xml': '<x>' + '<sheet/>'.repeat(21) + '</x>',
        'xl/_rels/workbook.xml.rels': '<Relationships/>',
      }),
      'xlsx',
    ),
  ).rejects.toThrow('source-too-large');
});
it('rejects encrypted entries and empty documents', async () => {
  const bytes = zip({ 'word/document.xml': '<x/>' });
  const v = new DataView(bytes.buffer);
  for (let i = 0; i < bytes.length - 46; i++)
    if (v.getUint32(i, true) === 0x02014b50) {
      v.setUint16(i + 8, 1, true);
      break;
    }
  await expect(readOfficeReference(bytes, 'docx')).rejects.toThrow('source-encrypted');
  await expect(readOfficeReference(zip({ 'word/document.xml': '<x/>' }), 'docx')).rejects.toThrow('source-empty');
});
it('keeps sparse cell addresses and accepts package-root relationships', async () => {
  expect(
    await readOfficeReference(
      zip({
        'xl/workbook.xml':
          '<x xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheet name="Sparse" r:id="a"/></x>',
        'xl/_rels/workbook.xml.rels':
          '<Relationships><Relationship Id="a" Target="/xl/worksheets/sheet1.xml"/></Relationships>',
        'xl/worksheets/sheet1.xml':
          '<worksheet><row r="3"><c r="A3"><v>1</v></c><c r="C3"><v>3</v></c></row></worksheet>',
      }),
      'xlsx',
    ),
  ).toBe('Sparse\nA3: 1\tC3: 3');
});
it('rejects mismatched local expanded size', async () => {
  const bytes = zip({ 'word/document.xml': '<x><p><t>Text</t></p></x>' });
  new DataView(bytes.buffer).setUint32(22, 1, true);
  await expect(readOfficeReference(bytes, 'docx')).rejects.toThrow('source-corrupt');
});
it('enforces cumulative inflation across separate workbook parts', async () => {
  const padding = ' '.repeat(17 * 1024 * 1024);
  const bytes = zip(
    {
      'xl/workbook.xml':
        '<x xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheet name="A" r:id="a"/></x>',
      'xl/_rels/workbook.xml.rels':
        '<Relationships><Relationship Id="a" Target="worksheets/sheet1.xml"/></Relationships>',
      'xl/sharedStrings.xml': '<sst>' + padding + '</sst>',
      'xl/worksheets/sheet1.xml': '<worksheet>' + padding + '</worksheet>',
    },
    true,
  );
  await expect(readOfficeReference(bytes, 'xlsx')).rejects.toThrow('source-too-large');
}, 15000);
it('enforces the extraction deadline during a yielding XML scan', async () => {
  let now = 0;
  const clock = vi.spyOn(performance, 'now').mockImplementation(() => now);
  try {
    const pending = readOfficeReference(
      zip({ 'word/document.xml': '<x>' + '<p><t>word</t></p>'.repeat(5000) + '</x>' }),
      'docx',
    );
    setTimeout(() => {
      now = 15001;
    }, 0);
    await expect(pending).rejects.toThrow('source-timeout');
  } finally {
    clock.mockRestore();
  }
});
it('preserves Word and DrawingML breaks while ignoring extension namespaces', async () => {
  expect(
    await readOfficeReference(
      zip({
        'word/document.xml':
          '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:e="urn:extension"><w:p><w:t>First</w:t><w:tab/><w:t>Second</w:t><w:br/><w:t>Third</w:t><e:t>Ignore</e:t></w:p></w:document>',
      }),
      'docx',
    ),
  ).toBe('First\tSecond\nThird');
});
it('resolves relationship IDs by namespace URI with arbitrary prefixes', async () => {
  expect(
    await readOfficeReference(
      zip({
        'ppt/presentation.xml':
          '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:rel="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldId rel:id="a"/></p:presentation>',
        'ppt/_rels/presentation.xml.rels':
          '<Relationships><Relationship Id="a" Target="/ppt/slides/slide1.xml"/></Relationships>',
        'ppt/slides/slide1.xml':
          '<a:x xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:p><a:r><a:t>First</a:t></a:r><a:br/><a:r><a:t>Second</a:t></a:r></a:p></a:x>',
      }),
      'pptx',
    ),
  ).toBe('First\nSecond');
});
