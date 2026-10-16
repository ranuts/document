import { deflateRawSync } from 'node:zlib';
function crc32(bytes: Uint8Array) {
  const table = Array.from({ length: 256 }, (_, value) => {
    for (let i = 0; i < 8; i++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
    return value >>> 0;
  });
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ table[(crc ^ byte) & 255];
  return (crc ^ 0xffffffff) >>> 0;
}
export function zip(entries: Record<string, string>, deflated = false) {
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, value] of Object.entries(entries)) {
    const n = new TextEncoder().encode(name),
      raw = new TextEncoder().encode(value),
      body = deflated ? deflateRawSync(raw) : raw;
    const header = new Uint8Array(30 + n.length),
      h = new DataView(header.buffer);
    h.setUint32(0, 0x04034b50, true);
    h.setUint16(8, deflated ? 8 : 0, true);
    h.setUint32(14, crc32(raw), true);
    h.setUint32(18, body.length, true);
    h.setUint32(22, raw.length, true);
    h.setUint16(26, n.length, true);
    header.set(n, 30);
    const c = new Uint8Array(46 + n.length),
      d = new DataView(c.buffer);
    d.setUint32(0, 0x02014b50, true);
    d.setUint16(10, deflated ? 8 : 0, true);
    d.setUint32(16, crc32(raw), true);
    d.setUint32(20, body.length, true);
    d.setUint32(24, raw.length, true);
    d.setUint16(28, n.length, true);
    d.setUint32(42, offset, true);
    c.set(n, 46);
    chunks.push(header, body);
    central.push(c);
    offset += header.length + body.length;
  }
  const end = new Uint8Array(22),
    e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(10, central.length, true);
  e.setUint32(
    12,
    central.reduce((s, c) => s + c.length, 0),
    true,
  );
  e.setUint32(16, offset, true);
  return new Uint8Array(Buffer.concat([...chunks, ...central, end]));
}
export function textPdf(text: string) {
  const stream = `BT /F1 12 Tf 30 100 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let output = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, i) => {
    offsets.push(output.length);
    output += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const start = output.length;
  output +=
    'xref\n0 6\n0000000000 65535 f \n' +
    offsets
      .slice(1)
      .map((n) => `${String(n).padStart(10, '0')} 00000 n \n`)
      .join('') +
    `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return Buffer.from(output);
}
