// Minimal ZIP parser for extracting word/media/* images from DOCX bytes.
// Uses DecompressionStream (available in all modern browsers) for DEFLATE entries.
// Returns a map of { "media/image1.png": blobUrl, ... } matching the filenames
// the OnlyOffice SDK will request via /media/word/media/<name>.

const MIME_MAP: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
  tiff: 'image/tiff',
  tif: 'image/tiff',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  emf: 'image/x-emf',
  wmf: 'image/x-wmf',
  // Video
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  wmv: 'video/x-ms-wmv',
  mkv: 'video/x-matroska',
  m4v: 'video/mp4',
  // Audio
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  wma: 'audio/x-ms-wma',
  flac: 'audio/flac',
};

async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();
  void (writer as WritableStreamDefaultWriter<Uint8Array<ArrayBuffer>>).write(data as Uint8Array<ArrayBuffer>);
  writer.close();
  const chunks: Uint8Array[] = [];
  let done = false;
  while (!done) {
    const result = await reader.read();
    done = result.done;
    if (!done && result.value) chunks.push(result.value);
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

function u16(buf: Uint8Array, off: number) {
  return buf[off] | (buf[off + 1] << 8);
}
function u32(buf: Uint8Array, off: number) {
  return (buf[off] | (buf[off + 1] << 8) | (buf[off + 2] << 16) | (buf[off + 3] << 24)) >>> 0;
}

// CRC32 lookup table (IEEE polynomial), computed once at module load.
const CRC32_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = (CRC32_TABLE[(c ^ data[i]) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Normalise XLSX line-break escapes before handing raw OOXML to asc_openDocumentFromBytes.
//
// Some tools (Excel-compatible exporters) store cell newlines as the literal
// 5-character text "&#10;" by writing "&amp;#10;" in the XML.  A strict XML
// parser returns the text "&#10;" — which the SDK displays verbatim.  x2t (used
// in v7.5) normalised this to a real LF byte; we replicate that here.
//
// Strategy: parse the XLSX ZIP, decompress every xl/*.xml file, replace the 9-byte
// byte sequence &amp;#10; → &#10; (a proper XML numeric character reference that
// the SDK's parser will decode to U+000A), then rebuild the ZIP with those entries
// stored uncompressed (STORED, method=0) while keeping all other entries verbatim.
export async function preprocessXlsxLineBreaks(xlsxBytes: Uint8Array): Promise<Uint8Array> {
  // &amp;#10; UTF-8 bytes
  const AMP10 = new Uint8Array([0x26, 0x61, 0x6d, 0x70, 0x3b, 0x23, 0x31, 0x30, 0x3b]);
  // &#10;  UTF-8 bytes (proper XML entity → will decode to LF)
  const HASH10 = new Uint8Array([0x26, 0x23, 0x31, 0x30, 0x3b]);

  // ---- Find EOCD ----
  let eocd = -1;
  for (let i = xlsxBytes.length - 22; i >= Math.max(0, xlsxBytes.length - 65558); i--) {
    if (xlsxBytes[i] === 0x50 && xlsxBytes[i + 1] === 0x4b && xlsxBytes[i + 2] === 0x05 && xlsxBytes[i + 3] === 0x06) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) return xlsxBytes;

  const cdCount = u16(xlsxBytes, eocd + 10);
  const cdOffset = u32(xlsxBytes, eocd + 16);

  // ---- Collect all central-directory entries ----
  interface ZipEntry {
    name: string;
    nameBytes: Uint8Array;
    compression: number;
    crc: number;
    compressedSize: number;
    localOffset: number;
    cdEntryStart: number;
    cdEntryEnd: number;
    dataStart: number;
    modifiedData?: Uint8Array;
    newCrc?: number;
  }

  const entries: ZipEntry[] = [];
  let cdPos = cdOffset;

  for (let i = 0; i < cdCount; i++) {
    if (cdPos + 46 > xlsxBytes.length) break;
    if (!(xlsxBytes[cdPos] === 0x50 && xlsxBytes[cdPos + 1] === 0x4b && xlsxBytes[cdPos + 2] === 0x01 && xlsxBytes[cdPos + 3] === 0x02)) break;

    const compression = u16(xlsxBytes, cdPos + 10);
    const crc = u32(xlsxBytes, cdPos + 16);
    const compressedSize = u32(xlsxBytes, cdPos + 20);
    const cdFnLen = u16(xlsxBytes, cdPos + 28);
    const cdExtraLen = u16(xlsxBytes, cdPos + 30);
    const cdCommentLen = u16(xlsxBytes, cdPos + 32);
    const localOffset = u32(xlsxBytes, cdPos + 42);

    const nameBytes = xlsxBytes.slice(cdPos + 46, cdPos + 46 + cdFnLen);
    const name = new TextDecoder('utf-8', { fatal: false }).decode(nameBytes);

    const localFnLen = localOffset + 30 <= xlsxBytes.length ? u16(xlsxBytes, localOffset + 26) : 0;
    const localExtraLen = localOffset + 30 <= xlsxBytes.length ? u16(xlsxBytes, localOffset + 28) : 0;
    const dataStart = localOffset + 30 + localFnLen + localExtraLen;

    const cdEntryStart = cdPos;
    cdPos += 46 + cdFnLen + cdExtraLen + cdCommentLen;

    entries.push({ name, nameBytes, compression, crc, compressedSize, localOffset, cdEntryStart, cdEntryEnd: cdPos, dataStart });
  }

  // ---- Decompress & patch xl/*.xml entries ----
  let hasChanges = false;

  for (const entry of entries) {
    if (!entry.name.startsWith('xl/') || !entry.name.endsWith('.xml')) continue;
    if (entry.dataStart + entry.compressedSize > xlsxBytes.length) continue;

    try {
      const compressed = xlsxBytes.slice(entry.dataStart, entry.dataStart + entry.compressedSize);
      let xml: Uint8Array;
      if (entry.compression === 0) xml = compressed;
      else if (entry.compression === 8) xml = await deflateRaw(compressed);
      else continue;

      // Quick scan for the pattern before doing costly replacement
      let found = false;
      for (let i = 0; i <= xml.length - AMP10.length; i++) {
        let ok = true;
        for (let j = 0; j < AMP10.length; j++) {
          if (xml[i + j] !== AMP10[j]) { ok = false; break; }
        }
        if (ok) { found = true; break; }
      }
      if (!found) continue;

      // Count occurrences (to pre-size output)
      let count = 0;
      for (let i = 0; i <= xml.length - AMP10.length; ) {
        let ok = true;
        for (let j = 0; j < AMP10.length; j++) {
          if (xml[i + j] !== AMP10[j]) { ok = false; break; }
        }
        if (ok) { count++; i += AMP10.length; } else i++;
      }

      const newSize = xml.length - count * (AMP10.length - HASH10.length);
      const modified = new Uint8Array(newSize);
      let src = 0, dst = 0;
      while (src < xml.length) {
        if (src + AMP10.length <= xml.length) {
          let ok = true;
          for (let j = 0; j < AMP10.length; j++) {
            if (xml[src + j] !== AMP10[j]) { ok = false; break; }
          }
          if (ok) {
            modified.set(HASH10, dst);
            src += AMP10.length;
            dst += HASH10.length;
            continue;
          }
        }
        modified[dst++] = xml[src++];
      }

      entry.modifiedData = modified;
      entry.newCrc = crc32(modified);
      hasChanges = true;
    } catch {
      // leave unchanged on error
    }
  }

  if (!hasChanges) return xlsxBytes;

  // ---- Rebuild ZIP ----
  const chunks: Uint8Array[] = [];
  const newOffsets: number[] = [];
  let offset = 0;

  // Local file headers + data
  for (const entry of entries) {
    newOffsets.push(offset);
    if (entry.modifiedData !== undefined && entry.newCrc !== undefined) {
      const sz = entry.modifiedData.length;
      const hdr = new Uint8Array(30 + entry.nameBytes.length);
      const dv = new DataView(hdr.buffer);
      dv.setUint32(0, 0x04034b50, true);
      dv.setUint16(4, 20, true);
      dv.setUint16(6, 0, true);
      dv.setUint16(8, 0, true); // STORED
      dv.setUint16(10, 0, true);
      dv.setUint16(12, 0, true);
      dv.setUint32(14, entry.newCrc, true);
      dv.setUint32(18, sz, true);
      dv.setUint32(22, sz, true);
      dv.setUint16(26, entry.nameBytes.length, true);
      dv.setUint16(28, 0, true);
      hdr.set(entry.nameBytes, 30);
      chunks.push(hdr);
      chunks.push(entry.modifiedData);
      offset += 30 + entry.nameBytes.length + sz;
    } else {
      const end = entry.dataStart + entry.compressedSize;
      chunks.push(xlsxBytes.slice(entry.localOffset, end));
      offset += end - entry.localOffset;
    }
  }

  // Central directory
  const cdStart = offset;
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (entry.modifiedData !== undefined && entry.newCrc !== undefined) {
      const sz = entry.modifiedData.length;
      const cd = new Uint8Array(46 + entry.nameBytes.length);
      const dv = new DataView(cd.buffer);
      dv.setUint32(0, 0x02014b50, true);
      dv.setUint16(4, 20, true);
      dv.setUint16(6, 20, true);
      dv.setUint16(8, 0, true);
      dv.setUint16(10, 0, true); // STORED
      dv.setUint16(12, 0, true);
      dv.setUint16(14, 0, true);
      dv.setUint32(16, entry.newCrc, true);
      dv.setUint32(20, sz, true);
      dv.setUint32(24, sz, true);
      dv.setUint16(28, entry.nameBytes.length, true);
      dv.setUint16(30, 0, true);
      dv.setUint16(32, 0, true);
      dv.setUint16(34, 0, true);
      dv.setUint16(36, 0, true);
      dv.setUint32(38, 0, true);
      dv.setUint32(42, newOffsets[i]!, true);
      cd.set(entry.nameBytes, 46);
      chunks.push(cd);
      offset += cd.length;
    } else {
      const orig = xlsxBytes.slice(entry.cdEntryStart, entry.cdEntryEnd);
      const copy = new Uint8Array(orig);
      new DataView(copy.buffer).setUint32(42, newOffsets[i]!, true);
      chunks.push(copy);
      offset += copy.length;
    }
  }

  // EOCD
  const eocdRec = new Uint8Array(22);
  const ev = new DataView(eocdRec.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, offset - cdStart, true);
  ev.setUint32(16, cdStart, true);
  ev.setUint16(20, 0, true);
  chunks.push(eocdRec);

  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) { out.set(c, pos); pos += c.length; }
  return out;
}

// Parse DOCX (ZIP) bytes and return { "media/image1.png": blobUrl } for all
// word/media/* entries.  Blob URLs must be revoked by the caller when no longer needed.
export async function extractDocxMediaUrls(docxBytes: Uint8Array): Promise<Record<string, string>> {
  const result: Record<string, string> = {};

  // Find End of Central Directory (EOCD) record — last occurrence of PK\x05\x06.
  let eocd = -1;
  // Search backwards; EOCD is at least 22 bytes.
  for (let i = docxBytes.length - 22; i >= Math.max(0, docxBytes.length - 65558); i--) {
    if (docxBytes[i] === 0x50 && docxBytes[i + 1] === 0x4b && docxBytes[i + 2] === 0x05 && docxBytes[i + 3] === 0x06) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) return result;

  const cdCount = u16(docxBytes, eocd + 10);
  const cdOffset = u32(docxBytes, eocd + 16);

  // Walk central directory entries (PK\x01\x02).
  let cdPos = cdOffset;
  for (let i = 0; i < cdCount; i++) {
    if (cdPos + 46 > docxBytes.length) break;
    if (!(docxBytes[cdPos] === 0x50 && docxBytes[cdPos + 1] === 0x4b && docxBytes[cdPos + 2] === 0x01 && docxBytes[cdPos + 3] === 0x02)) break;

    const compression = u16(docxBytes, cdPos + 10);
    const compressedSize = u32(docxBytes, cdPos + 20);
    const fnLen = u16(docxBytes, cdPos + 28);
    const extraLen = u16(docxBytes, cdPos + 30);
    const commentLen = u16(docxBytes, cdPos + 32);
    const localOffset = u32(docxBytes, cdPos + 42);

    const nameBytes = docxBytes.slice(cdPos + 46, cdPos + 46 + fnLen);
    const name = new TextDecoder('utf-8', { fatal: false }).decode(nameBytes);
    cdPos += 46 + fnLen + extraLen + commentLen;

    // Support all OOXML media paths: word/ (DOCX), xl/ (XLSX), ppt/ (PPTX)
    const MEDIA_PREFIXES = ['word/media/', 'xl/media/', 'ppt/media/'];
    const prefix = MEDIA_PREFIXES.find((p) => name.startsWith(p));
    if (!prefix) continue;
    const baseName = name.slice(prefix.length);
    if (!baseName || baseName.endsWith('/')) continue;

    // Read local file header for exact data offset.
    if (localOffset + 30 > docxBytes.length) continue;
    const localFnLen = u16(docxBytes, localOffset + 26);
    const localExtraLen = u16(docxBytes, localOffset + 28);
    const dataStart = localOffset + 30 + localFnLen + localExtraLen;

    const compressedData = docxBytes.slice(dataStart, dataStart + compressedSize);

    try {
      let fileData: Uint8Array;
      if (compression === 0) {
        fileData = compressedData;
      } else if (compression === 8) {
        fileData = await deflateRaw(compressedData);
      } else {
        continue; // unsupported compression
      }

      const ext = baseName.split('.').pop()?.toLowerCase() ?? '';
      const mime = MIME_MAP[ext] ?? 'application/octet-stream';
      const ab: ArrayBuffer = fileData.buffer instanceof ArrayBuffer
        ? fileData.buffer.slice(fileData.byteOffset, fileData.byteOffset + fileData.byteLength)
        : new Uint8Array(fileData).buffer;
      const blob = new Blob([ab], { type: mime });
      result[`media/${baseName}`] = URL.createObjectURL(blob);
    } catch {
      // ignore corrupt entries
    }
  }

  return result;
}
