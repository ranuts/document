/**
 * Minimal OOXML builders for E2E fixtures (docs/superpowers/plans/2026-08-15-v9-test-coverage-strategy.md,
 * section 2 tier 3: synthetic corpus). Runs in Node; hand the bytes to the
 * page as base64 (Playwright serializes strings cheaply) and rebuild the
 * ArrayBuffer there. Stored (uncompressed) zip so no dependency is needed
 * and no binary fixture lives in the repo.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function makeStoredZip(entries: Array<{ name: string; data: Uint8Array | string }>): Uint8Array {
  const enc = new TextEncoder();
  const chunks: number[] = [];
  const central: number[] = [];
  const u16 = (arr: number[], v: number) => arr.push(v & 0xff, (v >> 8) & 0xff);
  const u32 = (arr: number[], v: number) => arr.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff);
  for (const { name, data } of entries) {
    const nameBytes = enc.encode(name);
    const bytes = typeof data === 'string' ? enc.encode(data) : data;
    const crc = crc32(bytes);
    const offset = chunks.length;
    u32(chunks, 0x04034b50);
    u16(chunks, 20);
    u16(chunks, 0);
    u16(chunks, 0);
    u32(chunks, 0);
    u32(chunks, crc);
    u32(chunks, bytes.length);
    u32(chunks, bytes.length);
    u16(chunks, nameBytes.length);
    u16(chunks, 0);
    chunks.push(...nameBytes, ...bytes);

    u32(central, 0x02014b50);
    u16(central, 20);
    u16(central, 20);
    u16(central, 0);
    u16(central, 0);
    u32(central, 0);
    u32(central, crc);
    u32(central, bytes.length);
    u32(central, bytes.length);
    u16(central, nameBytes.length);
    u16(central, 0);
    u16(central, 0);
    u16(central, 0);
    u16(central, 0);
    u32(central, 0);
    u32(central, offset);
    central.push(...nameBytes);
  }
  const centralOffset = chunks.length;
  chunks.push(...central);
  u32(chunks, 0x06054b50);
  u16(chunks, 0);
  u16(chunks, 0);
  u16(chunks, entries.length);
  u16(chunks, entries.length);
  u32(chunks, central.length);
  u32(chunks, centralOffset);
  u16(chunks, 0);
  return new Uint8Array(chunks);
}

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

/** A one-paragraph .docx. */
export function buildDocx(text: string): Uint8Array {
  return makeStoredZip([
    {
      name: '[Content_Types].xml',
      data:
        XML_HEAD +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
        '</Types>',
    },
    {
      name: '_rels/.rels',
      data:
        XML_HEAD +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
        '</Relationships>',
    },
    {
      name: 'word/document.xml',
      data:
        XML_HEAD +
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
        `<w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`,
    },
  ]);
}

export function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}
