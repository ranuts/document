/**
 * `g_fonts_selection_bin` -- the index the vendor's font matcher scores names
 * against, shipped as base64 in AllFonts.js.
 *
 * It is generated on the packaging host by OnlyOffice's allfontsgen and has no
 * published format, so it was long treated as untouchable ("clear it and every
 * character turns into tofu", which is true). It is not untouchable: the
 * reader is right there in sdk-all.js (`CFontSelectFormat.fromStream`), and
 * this module implements the same layout in both directions.
 *
 * Two facts keep it honest, both checked by test/unit/font-selection-bin.test.ts:
 *
 *   - decode -> encode reproduces the shipped base64 byte for byte (273 records);
 *   - a record rebuilt from a font file's own OS/2 + head + post tables equals
 *     the shipped record for all 188 catalog files that map to exactly one --
 *     which is what makes it safe to append records for faces we add.
 *
 * Record layout (AllFonts.js version 2), little-endian throughout:
 *
 *   int32   record byte length, counted from this field
 *   str     family name          (int32 byte length + UTF-8)
 *   int32   alternate name count, then that many str
 *   str     source path on the packaging host
 *   int32   face index, italic, bold, fixed-pitch
 *   int32   panose length (10), then that many uint8
 *   uint32  unicode range 1..4, code page range 1..2
 *   uint16  weight, width, family class, format, average width,
 *           ascent, descent, line gap, x-height, cap height, fsType
 *
 * The metrics are the font's typographic ones scaled to a 1000-unit em with C
 * integer truncation -- rounding instead is off by one on a third of the
 * catalog.
 */
import { readNames, faceMetrics } from './sfnt.mjs';

export function decode(base64) {
  const buf = Buffer.from(base64, 'base64');
  let p = 0;
  const int32 = () => {
    const v = buf.readInt32LE(p);
    p += 4;
    return v;
  };
  const uint32 = () => {
    const v = buf.readUInt32LE(p);
    p += 4;
    return v;
  };
  const uint16 = () => {
    const v = buf.readUInt16LE(p);
    p += 2;
    return v;
  };
  const str = () => {
    const n = int32();
    const s = buf.toString('utf8', p, p + n);
    p += n;
    return s;
  };
  const count = int32();
  const records = [];
  for (let i = 0; i < count; i++) {
    const start = p;
    const size = int32();
    const name = str();
    const altNames = [];
    for (let k = int32(); k > 0; k--) altNames.push(str());
    const record = {
      name,
      altNames,
      path: str(),
      index: int32(),
      italic: int32(),
      bold: int32(),
      fixed: int32(),
    };
    record.panose = Array.from({ length: int32() }, () => buf[p++]);
    record.unicodeRange = [uint32(), uint32(), uint32(), uint32()];
    record.codePageRange = [uint32(), uint32()];
    record.weight = uint16();
    record.width = uint16();
    record.familyClass = uint16();
    record.format = uint16();
    record.avgCharWidth = uint16();
    record.ascent = uint16();
    record.descent = uint16();
    record.lineGap = uint16();
    record.xHeight = uint16();
    record.capHeight = uint16();
    record.type = uint16();
    // Anything a future generator appends inside the record stays put.
    record.trailing = buf.subarray(p, start + size);
    p = start + size;
    records.push(record);
  }
  return { records, tail: buf.subarray(p) };
}

export function encode({ records, tail = Buffer.alloc(0) }) {
  const header = Buffer.alloc(4);
  header.writeInt32LE(records.length, 0);
  const parts = [header];
  for (const r of records) {
    const chunks = [];
    const int32 = (v) => {
      const b = Buffer.alloc(4);
      b.writeInt32LE(v, 0);
      chunks.push(b);
    };
    const uint32 = (v) => {
      const b = Buffer.alloc(4);
      b.writeUInt32LE(v >>> 0, 0);
      chunks.push(b);
    };
    const uint16 = (v) => {
      const b = Buffer.alloc(2);
      b.writeUInt16LE(v & 0xffff, 0);
      chunks.push(b);
    };
    const str = (s) => {
      const b = Buffer.from(s, 'utf8');
      int32(b.length);
      chunks.push(b);
    };
    str(r.name);
    int32(r.altNames.length);
    for (const alt of r.altNames) str(alt);
    str(r.path);
    int32(r.index);
    int32(r.italic);
    int32(r.bold);
    int32(r.fixed);
    int32(r.panose.length);
    chunks.push(Buffer.from(r.panose));
    for (const v of r.unicodeRange) uint32(v);
    for (const v of r.codePageRange) uint32(v);
    for (const v of [
      r.weight,
      r.width,
      r.familyClass,
      r.format,
      r.avgCharWidth,
      r.ascent,
      r.descent,
      r.lineGap,
      r.xHeight,
      r.capHeight,
      r.type,
    ]) {
      uint16(v);
    }
    if (r.trailing?.length) chunks.push(Buffer.from(r.trailing));
    const body = Buffer.concat(chunks);
    const size = Buffer.alloc(4);
    size.writeInt32LE(body.length + 4, 0);
    parts.push(size, body);
  }
  parts.push(Buffer.from(tail));
  return Buffer.concat(parts).toString('base64');
}

/**
 * Build the record allfontsgen would have written for this face. `path` is the
 * source path the generator recorded; nothing in the browser build reads it,
 * but keeping the shape consistent costs nothing.
 */
export function buildRecord(buf, { path }) {
  const m = faceMetrics(buf);
  // C integer division, not rounding: that is what the shipped records show.
  const scale = (v) => Math.trunc((v * 1000) / m.unitsPerEm) & 0xffff;
  return {
    name: readNames(buf)[1],
    altNames: [],
    path,
    index: 0,
    italic: (m.fsSelection & 0x01) !== 0 || (m.macStyle & 2) !== 0 ? 1 : 0,
    bold: (m.fsSelection & 0x20) !== 0 || (m.macStyle & 1) !== 0 ? 1 : 0,
    fixed: m.isFixedPitch ? 1 : 0,
    panose: m.panose,
    unicodeRange: m.unicodeRange,
    codePageRange: m.codePageRange,
    weight: m.weight,
    width: m.width,
    familyClass: m.familyClass & 0xffff,
    format: m.isCFF ? 2 : 1,
    avgCharWidth: scale(m.avgCharWidth),
    ascent: scale(m.typoAscender),
    descent: scale(m.typoDescender),
    lineGap: scale(m.typoLineGap),
    xHeight: scale(m.xHeight),
    capHeight: scale(m.capHeight),
    type: m.fsType,
    trailing: Buffer.alloc(0),
  };
}
