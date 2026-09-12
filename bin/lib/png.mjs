/**
 * Just enough PNG to keep the font-picker sprites honest.
 *
 * Each sprite ships twice: a run-length alpha mask (`*.png.bin`) that every
 * browser reads, and an RGBA PNG that only the ONLYOFFICE desktop shell reads
 * (`supportBinaryFormat` is false only when `Desktop.isActive()`). Two
 * encodings of one picture drift unless something regenerates one from the
 * other, which is what this is for -- and what `test/unit/font-catalog-licensing.test.ts`
 * checks by decoding both and comparing.
 *
 * Only the one shape those files use: 8-bit RGBA, no interlacing, one IDAT.
 */
import { deflateSync, inflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

/**
 * An alpha mask as the sprites store it: a pixel of coverage `a` is drawn as
 * grey `255 - a` at opacity `a`, which is what the `.bin` reader does
 * (`d[i] = d[i+1] = d[i+2] = 255 - l; d[i+3] = l`). Same rule both ways, so
 * the two files describe the same picture.
 */
export function encodeAlphaPng(alpha, width, height) {
  const raw = Buffer.alloc(height * (1 + width * 4));
  let at = 0;
  for (let y = 0; y < height; y++) {
    raw[at++] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const a = alpha[y * width + x];
      raw[at++] = 255 - a;
      raw[at++] = 255 - a;
      raw[at++] = 255 - a;
      raw[at++] = a;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** The alpha channel back out, for checking one file against the other. */
export function decodeAlphaPng(bytes) {
  if (!bytes.subarray(0, 8).equals(SIGNATURE)) throw new Error('not a PNG');
  let offset = 8;
  let width = 0;
  let height = 0;
  const idat = [];
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString('latin1');
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[9] !== 6 || data[12] !== 0) {
        throw new Error(`unsupported PNG: depth ${data[8]}, colour ${data[9]}, interlace ${data[12]}`);
      }
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const alpha = new Uint8Array(width * height);
  const line = Buffer.alloc(stride);
  const previous = Buffer.alloc(stride);
  let at = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[at++];
    // Filter 0 is what encodeAlphaPng writes, and reconstructing it byte by
    // byte is pure cost: read the alpha channel straight out of the row. These
    // sprites are ~17 million pixels across the set, so the difference is the
    // difference between a check that runs in CI and one that times out.
    if (filter === 0) {
      const row = y * width;
      for (let x = 0; x < width; x++) alpha[row + x] = raw[at + x * 4 + 3];
      raw.copy(previous, 0, at, at + stride);
      at += stride;
      continue;
    }
    raw.copy(line, 0, at, at + stride);
    at += stride;
    // The five filters PNG defines; the encoder above only ever writes 0, but
    // the vendor's files are not ours to assume about.
    for (let i = 0; i < stride; i++) {
      const a = i >= 4 ? line[i - 4] : 0;
      const b = previous[i];
      const c = i >= 4 ? previous[i - 4] : 0;
      switch (filter) {
        case 1:
          line[i] = (line[i] + a) & 0xff;
          break;
        case 2:
          line[i] = (line[i] + b) & 0xff;
          break;
        case 3:
          line[i] = (line[i] + ((a + b) >> 1)) & 0xff;
          break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          line[i] = (line[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
          break;
        }
        default:
          break;
      }
    }
    for (let x = 0; x < width; x++) alpha[y * width + x] = line[x * 4 + 3];
    line.copy(previous);
  }
  return { width, height, alpha };
}
