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

// ---- Shared ZIP rewrite infrastructure ----

interface ZipEntry {
  name: string;
  nameBytes: Uint8Array;
  compression: number;
  crc: number;
  compressedSize: number;
  uncompressedSize: number; // from CD offset 24
  modTime: number; // from CD offset 12
  modDate: number; // from CD offset 14
  localOffset: number;
  cdEntryStart: number;
  cdEntryEnd: number;
  dataStart: number;
  modifiedData?: Uint8Array;
  newCrc?: number;
}

// Returns true if the ZIP contains an entry with the given name.
function checkZipHasEntry(bytes: Uint8Array, targetName: string): boolean {
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65558); i--) {
    if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) return false;
  const cdCount = u16(bytes, eocd + 10);
  const cdOffset = u32(bytes, eocd + 16);
  let cdPos = cdOffset;
  const dec = new TextDecoder('utf-8', { fatal: false });
  for (let i = 0; i < cdCount; i++) {
    if (cdPos + 46 > bytes.length) break;
    if (!(bytes[cdPos] === 0x50 && bytes[cdPos + 1] === 0x4b && bytes[cdPos + 2] === 0x01 && bytes[cdPos + 3] === 0x02))
      break;
    const fnLen = u16(bytes, cdPos + 28);
    const exLen = u16(bytes, cdPos + 30);
    const cmLen = u16(bytes, cdPos + 32);
    if (dec.decode(bytes.slice(cdPos + 46, cdPos + 46 + fnLen)) === targetName) return true;
    cdPos += 46 + fnLen + exLen + cmLen;
  }
  return false;
}

// Parse a ZIP's central directory, apply `transform` to entries matching `shouldProcess`,
// and rebuild the ZIP with modified entries stored uncompressed (STORED, method=0).
// `inject` adds brand-new entries (STORED). Returns original bytes if nothing changed.
//
// IMPORTANT: The rebuilt ZIP always writes fresh local file headers with correct
// sizes/CRC taken from the central directory, discarding any original data-descriptor
// (general purpose bit 3) state. This is required for ZIPs created by streaming writers
// whose local headers contain crc=0/size=0 placeholders.
async function rewriteZipEntries(
  bytes: Uint8Array,
  shouldProcess: (name: string) => boolean,
  transform: (rawXml: string, name: string) => string | null,
  inject?: Array<{ name: string; data: Uint8Array }>,
): Promise<Uint8Array> {
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65558); i--) {
    if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) return bytes;

  const cdCount = u16(bytes, eocd + 10);
  const cdOffset = u32(bytes, eocd + 16);

  const entries: ZipEntry[] = [];
  let cdPos = cdOffset;

  for (let i = 0; i < cdCount; i++) {
    if (cdPos + 46 > bytes.length) break;
    if (!(bytes[cdPos] === 0x50 && bytes[cdPos + 1] === 0x4b && bytes[cdPos + 2] === 0x01 && bytes[cdPos + 3] === 0x02))
      break;

    const compression = u16(bytes, cdPos + 10);
    const modTime = u16(bytes, cdPos + 12);
    const modDate = u16(bytes, cdPos + 14);
    const crc = u32(bytes, cdPos + 16);
    const compressedSize = u32(bytes, cdPos + 20);
    const uncompressedSize = u32(bytes, cdPos + 24);
    const cdFnLen = u16(bytes, cdPos + 28);
    const cdExtraLen = u16(bytes, cdPos + 30);
    const cdCommentLen = u16(bytes, cdPos + 32);
    const localOffset = u32(bytes, cdPos + 42);

    const nameBytes = bytes.slice(cdPos + 46, cdPos + 46 + cdFnLen);
    const name = new TextDecoder('utf-8', { fatal: false }).decode(nameBytes);

    const localFnLen = localOffset + 30 <= bytes.length ? u16(bytes, localOffset + 26) : 0;
    const localExtraLen = localOffset + 30 <= bytes.length ? u16(bytes, localOffset + 28) : 0;
    const dataStart = localOffset + 30 + localFnLen + localExtraLen;

    const cdEntryStart = cdPos;
    cdPos += 46 + cdFnLen + cdExtraLen + cdCommentLen;

    entries.push({
      name,
      nameBytes,
      compression,
      crc,
      compressedSize,
      uncompressedSize,
      modTime,
      modDate,
      localOffset,
      cdEntryStart,
      cdEntryEnd: cdPos,
      dataStart,
    });
  }

  let hasChanges = false;
  const dec = new TextDecoder('utf-8', { fatal: false });
  const enc = new TextEncoder();

  for (const entry of entries) {
    if (!shouldProcess(entry.name)) continue;
    if (entry.dataStart + entry.compressedSize > bytes.length) continue;

    try {
      const compressed = bytes.slice(entry.dataStart, entry.dataStart + entry.compressedSize);
      let raw: Uint8Array;
      if (entry.compression === 0) raw = compressed;
      else if (entry.compression === 8) raw = await deflateRaw(compressed);
      else continue;

      const xmlStr = dec.decode(raw);
      const newStr = transform(xmlStr, entry.name);
      if (newStr === null || newStr === xmlStr) continue;

      entry.modifiedData = enc.encode(newStr);
      entry.newCrc = crc32(entry.modifiedData);
      hasChanges = true;
    } catch {
      // leave unchanged on error
    }
  }

  const hasInject = inject && inject.length > 0;
  if (!hasChanges && !hasInject) return bytes;

  // ---- Rebuild ZIP ----
  const chunks: Uint8Array[] = [];
  const newOffsets: number[] = [];
  let offset = 0;

  for (const entry of entries) {
    newOffsets.push(offset);
    if (entry.modifiedData !== undefined && entry.newCrc !== undefined) {
      // Modified: store as STORED (method=0) with fresh local header.
      const sz = entry.modifiedData.length;
      const hdr = new Uint8Array(30 + entry.nameBytes.length);
      const dv = new DataView(hdr.buffer);
      dv.setUint32(0, 0x04034b50, true);
      dv.setUint16(4, 20, true);
      dv.setUint16(6, 0, true); // bit 3 cleared
      dv.setUint16(8, 0, true); // STORED
      dv.setUint32(14, entry.newCrc, true);
      dv.setUint32(18, sz, true);
      dv.setUint32(22, sz, true);
      dv.setUint16(26, entry.nameBytes.length, true);
      hdr.set(entry.nameBytes, 30);
      chunks.push(hdr);
      chunks.push(entry.modifiedData);
      offset += 30 + entry.nameBytes.length + sz;
    } else {
      // Unchanged: write a fresh local header with correct sizes from the central
      // directory. Streaming-written ZIPs (bit 3 set) store crc/sizes as 0 in the
      // local header and append them as a data descriptor; our rebuilt ZIP has no
      // data descriptors, so we must provide correct values directly.
      const sz = entry.compressedSize;
      const hdr = new Uint8Array(30 + entry.nameBytes.length);
      const dv = new DataView(hdr.buffer);
      dv.setUint32(0, 0x04034b50, true);
      dv.setUint16(4, 20, true);
      dv.setUint16(6, 0, true); // bit 3 cleared
      dv.setUint16(8, entry.compression, true);
      dv.setUint16(10, entry.modTime, true);
      dv.setUint16(12, entry.modDate, true);
      dv.setUint32(14, entry.crc, true);
      dv.setUint32(18, sz, true);
      dv.setUint32(22, entry.uncompressedSize, true);
      dv.setUint16(26, entry.nameBytes.length, true);
      hdr.set(entry.nameBytes, 30);
      chunks.push(hdr);
      chunks.push(bytes.slice(entry.dataStart, entry.dataStart + sz));
      offset += 30 + entry.nameBytes.length + sz;
    }
  }

  // Injected entries (brand-new files appended to the file section).
  interface InjectedEntry {
    nameBytes: Uint8Array;
    data: Uint8Array;
    crc: number;
    localOffset: number;
  }
  const injected: InjectedEntry[] = [];
  if (inject) {
    for (const { name: iName, data: iData } of inject) {
      const iNameBytes = new TextEncoder().encode(iName);
      const iCrc = crc32(iData);
      injected.push({ nameBytes: iNameBytes, data: iData, crc: iCrc, localOffset: offset });
      const sz = iData.length;
      const hdr = new Uint8Array(30 + iNameBytes.length);
      const dv = new DataView(hdr.buffer);
      dv.setUint32(0, 0x04034b50, true);
      dv.setUint16(4, 20, true);
      dv.setUint32(14, iCrc, true);
      dv.setUint32(18, sz, true);
      dv.setUint32(22, sz, true);
      dv.setUint16(26, iNameBytes.length, true);
      hdr.set(iNameBytes, 30);
      chunks.push(hdr);
      chunks.push(iData);
      offset += 30 + iNameBytes.length + sz;
    }
  }

  // ---- Central directory ----
  const cdStart = offset;
  const totalEntries = entries.length + injected.length;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    if (entry.modifiedData !== undefined && entry.newCrc !== undefined) {
      const sz = entry.modifiedData.length;
      const cd = new Uint8Array(46 + entry.nameBytes.length);
      const dv = new DataView(cd.buffer);
      dv.setUint32(0, 0x02014b50, true);
      dv.setUint16(4, 20, true);
      dv.setUint16(6, 20, true);
      dv.setUint32(16, entry.newCrc, true);
      dv.setUint32(20, sz, true);
      dv.setUint32(24, sz, true);
      dv.setUint16(28, entry.nameBytes.length, true);
      dv.setUint32(42, newOffsets[i]!, true);
      cd.set(entry.nameBytes, 46);
      chunks.push(cd);
      offset += cd.length;
    } else {
      const orig = bytes.slice(entry.cdEntryStart, entry.cdEntryEnd);
      const copy = new Uint8Array(orig);
      new DataView(copy.buffer).setUint32(42, newOffsets[i]!, true);
      chunks.push(copy);
      offset += copy.length;
    }
  }

  for (const ie of injected) {
    const sz = ie.data.length;
    const cd = new Uint8Array(46 + ie.nameBytes.length);
    const dv = new DataView(cd.buffer);
    dv.setUint32(0, 0x02014b50, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(6, 20, true);
    dv.setUint32(16, ie.crc, true);
    dv.setUint32(20, sz, true);
    dv.setUint32(24, sz, true);
    dv.setUint16(28, ie.nameBytes.length, true);
    dv.setUint32(42, ie.localOffset, true);
    cd.set(ie.nameBytes, 46);
    chunks.push(cd);
    offset += cd.length;
  }

  const eocdRec = new Uint8Array(22);
  const ev = new DataView(eocdRec.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, totalEntries, true);
  ev.setUint16(10, totalEntries, true);
  ev.setUint32(12, offset - cdStart, true);
  ev.setUint32(16, cdStart, true);
  chunks.push(eocdRec);

  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

// Normalise XLSX line-break escapes before handing raw OOXML to asc_openDocumentFromBytes.
//
// Some tools (Excel-compatible exporters) store cell newlines as the literal
// 5-character text "&#10;" by writing "&amp;#10;" in the XML.  A strict XML
// parser returns the text "&#10;" — which the SDK displays verbatim.  x2t (used
// in v7.5) normalised this to a real LF byte; we replicate that here.
export async function preprocessXlsxLineBreaks(xlsxBytes: Uint8Array): Promise<Uint8Array> {
  return rewriteZipEntries(
    xlsxBytes,
    (name) => name.startsWith('xl/') && name.endsWith('.xml'),
    (xml) => {
      if (!xml.includes('&amp;#10;')) return null;
      const next = xml.replaceAll('&amp;#10;', '&#10;');
      return next !== xml ? next : null;
    },
  );
}

// Preprocess a PPTX before passing its bytes to asc_openDocumentFromBytes.
//
// Three fixes applied in a single ZIP rebuild pass:
//
// 1. showMasterPhAnim (SDK bug in 9.3.0 Web Mode): the notes-slide parser class
//    calls this.l8a() for this attribute, but l8a() is not defined on the notes
//    class. Stripping the attribute from ppt/notesSlides/ and ppt/notesMasters/
//    is visually harmless (it only controls whether master animations show in the
//    notes view).
//
// 2. Missing docProps/app.xml: some exporters omit this optional-but-expected file.
//    The SDK crashes at f.$Nf (sdk-all-min.js) when it tries to call .Ty() on a
//    null reader. We inject a minimal app.xml and add its relationship to _rels/.rels.
//
// 3. Missing docProps/core.xml: when absent, the SDK's changesError controller is
//    left partially uninitialised. A socket.io connection failure then triggers
//    onError(), which crashes with "Cannot read properties of undefined (reading
//    '$window')", disabling the entire toolbar. Injecting a minimal core.xml
//    and its core-properties relationship prevents this crash.
//
// Both notes-slide XMLs and _rels/.rels are typically DEFLATE-compressed, so the
// pattern check must happen after decompression — a raw-byte ZIP scan won't find them.
export async function preprocessPptx(pptxBytes: Uint8Array): Promise<Uint8Array> {
  const hasAppXml = checkZipHasEntry(pptxBytes, 'docProps/app.xml');
  const hasCoreXml = checkZipHasEntry(pptxBytes, 'docProps/core.xml');

  const enc = new TextEncoder();
  const inject: Array<{ name: string; data: Uint8Array }> = [];

  if (!hasAppXml) {
    inject.push({
      name: 'docProps/app.xml',
      data: enc.encode(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">' +
          '<Application>Microsoft Office PowerPoint</Application>' +
          '</Properties>',
      ),
    });
  }

  if (!hasCoreXml) {
    inject.push({
      name: 'docProps/core.xml',
      data: enc.encode(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<cp:coreProperties' +
          ' xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"' +
          ' xmlns:dc="http://purl.org/dc/elements/1.1/"' +
          ' xmlns:dcterms="http://purl.org/dc/terms/"' +
          ' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
          '<dc:title/><dc:creator/>' +
          '</cp:coreProperties>',
      ),
    });
  }

  const needsRels = !hasAppXml || !hasCoreXml;

  return rewriteZipEntries(
    pptxBytes,
    (name) =>
      ((name.startsWith('ppt/notesSlides/') || name.startsWith('ppt/notesMasters/')) && name.endsWith('.xml')) ||
      (needsRels && name === '_rels/.rels'),
    (xml, name) => {
      if (name === '_rels/.rels') {
        let out = xml;
        const end = out.lastIndexOf('</Relationships>');
        if (end === -1) return null;
        let n = 1;
        while (out.includes(`"rId${n}"`)) n++;
        if (!hasAppXml && !out.includes('extended-properties')) {
          const rel =
            `<Relationship Id="rId${n}" ` +
            `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" ` +
            `Target="docProps/app.xml"/>`;
          out = out.slice(0, end) + rel + out.slice(end);
          n++;
        }
        if (!hasCoreXml && !out.includes('core-properties')) {
          const rel =
            `<Relationship Id="rId${n}" ` +
            `Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" ` +
            `Target="docProps/core.xml"/>`;
          out =
            out.slice(0, out.lastIndexOf('</Relationships>')) + rel + out.slice(out.lastIndexOf('</Relationships>'));
        }
        return out === xml ? null : out;
      }
      if (!xml.includes('showMasterPhAnim')) return null;
      const next = xml.replace(/ showMasterPhAnim="[^"]*"/g, '');
      return next !== xml ? next : null;
    },
    inject.length > 0 ? inject : undefined,
  );
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
    if (
      !(
        docxBytes[cdPos] === 0x50 &&
        docxBytes[cdPos + 1] === 0x4b &&
        docxBytes[cdPos + 2] === 0x01 &&
        docxBytes[cdPos + 3] === 0x02
      )
    )
      break;

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
      const ab: ArrayBuffer =
        fileData.buffer instanceof ArrayBuffer
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
