/**
 * The little bit of sfnt (TTF/OTF) parsing the font tooling needs: the table
 * directory, the name table, and the OS/2 + head + post fields the vendor's
 * font matcher indexes.
 *
 * Shared by bin/font-license-sweep.mjs and the font unit tests so both read a
 * face the same way the engine does -- in particular the name the engine
 * matches on, which is the Windows English one when a file has several.
 */

/** The catalog wire format: a TTF/OTF whose first 32 bytes are XOR'd. */
export const XOR_KEY = [160, 102, 214, 32, 20, 150, 71, 250, 149, 105, 184, 80, 176, 65, 73, 72];

/** Symmetric: the same call encodes a raw face and decodes a catalog slot. */
export function xorPrefix(buf) {
  const out = Buffer.from(buf);
  for (let i = 0; i < Math.min(32, out.length); i++) out[i] ^= XOR_KEY[i % XOR_KEY.length];
  return out;
}

const SFNT_MAGICS = new Set(['00010000', '4f54544f', '74727565', '74746366']);

/** Accept either a raw face or a catalog slot; return the raw face. */
export function asFace(buf) {
  return SFNT_MAGICS.has(buf.subarray(0, 4).toString('hex')) ? buf : xorPrefix(buf);
}

export function tables(buf, offset = 0) {
  if (buf.subarray(offset, offset + 4).toString('latin1') === 'ttcf') {
    return tables(buf, buf.readUInt32BE(offset + 12));
  }
  const count = buf.readUInt16BE(offset + 4);
  const out = {};
  for (let i = 0; i < count; i++) {
    const p = offset + 12 + i * 16;
    out[buf.subarray(p, p + 4).toString('latin1')] = { off: buf.readUInt32BE(p + 8), len: buf.readUInt32BE(p + 12) };
  }
  return out;
}

/**
 * nameID -> string, resolved the way FreeType resolves `family_name`: the
 * Windows English record wins, then any Windows record, then Unicode, then
 * the Mac English one. Getting this order wrong reads a localized name as the
 * family name and makes consistent catalogs look broken.
 */
export function readNames(buf) {
  const face = asFace(buf);
  const t = tables(face);
  if (!t.name) return {};
  const o = t.name.off;
  const count = face.readUInt16BE(o + 2);
  const strings = o + face.readUInt16BE(o + 4);
  const records = [];
  for (let i = 0; i < count; i++) {
    const p = o + 6 + i * 12;
    const platformId = face.readUInt16BE(p);
    const encodingId = face.readUInt16BE(p + 2);
    const languageId = face.readUInt16BE(p + 4);
    const nameId = face.readUInt16BE(p + 6);
    const len = face.readUInt16BE(p + 8);
    const at = face.readUInt16BE(p + 10);
    try {
      const raw = face.subarray(strings + at, strings + at + len);
      // Platform 1 (Mac) is a byte encoding; 0 (Unicode) and 3 (Windows) are UTF-16BE.
      const value = platformId === 1 ? raw.toString('latin1') : Buffer.from(raw).swap16().toString('utf16le');
      records.push({ platformId, encodingId, languageId, nameId, value });
    } catch {
      // A malformed record is not a reason to misread the whole file.
    }
  }
  const rank = (r) =>
    r.platformId === 3 && r.encodingId === 1 && r.languageId === 0x409
      ? 0
      : r.platformId === 3 && r.languageId === 0x409
        ? 1
        : r.platformId === 3
          ? 2
          : r.platformId === 0
            ? 3
            : r.platformId === 1 && r.languageId === 0
              ? 4
              : 5;
  const out = {};
  for (const nameId of new Set(records.map((r) => r.nameId))) {
    out[nameId] = records.filter((r) => r.nameId === nameId).sort((a, b) => rank(a) - rank(b))[0].value;
  }
  out.records = records;
  return out;
}

/** The OS/2 + head + hhea + post fields the selection index is built from. */
export function faceMetrics(buf) {
  const face = asFace(buf);
  const t = tables(face);
  const o = t['OS/2'].off;
  const head = t.head.off;
  const hhea = t.hhea.off;
  const version = face.readUInt16BE(o);
  return {
    unitsPerEm: face.readUInt16BE(head + 18),
    macStyle: face.readUInt16BE(head + 44),
    isCFF: face.subarray(0, 4).toString('latin1') === 'OTTO',
    isFixedPitch: t.post ? face.readUInt32BE(t.post.off + 12) !== 0 : false,
    avgCharWidth: face.readInt16BE(o + 2),
    weight: face.readUInt16BE(o + 4),
    width: face.readUInt16BE(o + 6),
    fsType: face.readUInt16BE(o + 8),
    familyClass: face.readInt16BE(o + 30),
    panose: Array.from(face.subarray(o + 32, o + 42)),
    unicodeRange: [
      face.readUInt32BE(o + 42),
      face.readUInt32BE(o + 46),
      face.readUInt32BE(o + 50),
      face.readUInt32BE(o + 54),
    ],
    fsSelection: face.readUInt16BE(o + 62),
    typoAscender: face.readInt16BE(o + 68),
    typoDescender: face.readInt16BE(o + 70),
    typoLineGap: face.readInt16BE(o + 72),
    codePageRange: version >= 1 ? [face.readUInt32BE(o + 78), face.readUInt32BE(o + 82)] : [0, 0],
    xHeight: version >= 2 ? face.readInt16BE(o + 86) : 0,
    capHeight: version >= 2 ? face.readInt16BE(o + 88) : 0,
    hheaAscender: face.readInt16BE(hhea + 4),
    hheaDescender: face.readInt16BE(hhea + 6),
  };
}

/** cmap subtables as {platform, encoding, format, off}. */
export function cmapSubtables(buf) {
  const face = asFace(buf);
  const t = tables(face);
  if (!t.cmap) return [];
  const o = t.cmap.off;
  const n = face.readUInt16BE(o + 2);
  const subs = [];
  for (let i = 0; i < n; i++) {
    const p = o + 4 + i * 8;
    const off = o + face.readUInt32BE(p + 4);
    subs.push({
      platform: face.readUInt16BE(p),
      encoding: face.readUInt16BE(p + 2),
      off,
      format: face.readUInt16BE(off),
    });
  }
  return subs;
}

/**
 * Glyph id for a codepoint, 0 when the face has no glyph for it. Formats 0, 4,
 * 6 and 12 cover everything in this catalog.
 */
export function glyphId(buf, codePoint, subtable) {
  const face = asFace(buf);
  const subs = cmapSubtables(face);
  const sub =
    subtable ??
    subs.find((s) => s.platform === 3 && s.encoding === 10) ??
    subs.find((s) => s.platform === 3 && s.encoding === 1) ??
    subs.find((s) => s.platform === 0) ??
    subs[0];
  if (!sub) return 0;
  const o = sub.off;
  const fmt = face.readUInt16BE(o);
  if (fmt === 0) return codePoint < 256 ? face.readUInt8(o + 6 + codePoint) : 0;
  if (fmt === 4) {
    const segX2 = face.readUInt16BE(o + 6);
    const endO = o + 14;
    const startO = endO + segX2 + 2;
    const deltaO = startO + segX2;
    const rangeO = deltaO + segX2;
    for (let i = 0; i < segX2 / 2; i++) {
      const end = face.readUInt16BE(endO + i * 2);
      if (codePoint > end) continue;
      const start = face.readUInt16BE(startO + i * 2);
      if (codePoint < start) return 0;
      const delta = face.readInt16BE(deltaO + i * 2);
      const rangeOffset = face.readUInt16BE(rangeO + i * 2);
      if (rangeOffset === 0) return (codePoint + delta) & 0xffff;
      const g = face.readUInt16BE(rangeO + i * 2 + rangeOffset + (codePoint - start) * 2);
      return g === 0 ? 0 : (g + delta) & 0xffff;
    }
    return 0;
  }
  if (fmt === 6) {
    const first = face.readUInt16BE(o + 6);
    const count = face.readUInt16BE(o + 8);
    return codePoint >= first && codePoint < first + count ? face.readUInt16BE(o + 10 + (codePoint - first) * 2) : 0;
  }
  if (fmt === 12) {
    const groups = face.readUInt32BE(o + 12);
    for (let i = 0; i < groups; i++) {
      const p = o + 16 + i * 12;
      const start = face.readUInt32BE(p);
      const end = face.readUInt32BE(p + 4);
      if (codePoint < start) return 0;
      if (codePoint <= end) return face.readUInt32BE(p + 8) + (codePoint - start);
    }
    return 0;
  }
  return 0;
}
