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
