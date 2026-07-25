import { readZipEntries, readZipEntry, rewriteZip, zipHasEntry } from 'ranuts/utils';
import type { ZipEntry } from 'ranuts/utils';

// OOXML (DOCX / XLSX / PPTX) 就是 ZIP。ZIP 本身的读写——中央目录解析、DEFLATE 解压、
// CRC、重建归档——已经由 ranuts 提供，这里只留 OOXML 特有的部分：媒体文件的 MIME 映射，
// 以及三个针对 OnlyOffice 的预处理。
//
// 注意 ranuts 的 readZipEntries 从**中央目录**取尺寸与 CRC，而不是本地头：流式写入器
// 会在本地头里填 0 并把真值放在数据描述符里（通用位 3），照本地头读是手写 ZIP 解析器
// 在真实文件上翻车最常见的原因。

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

/**
 * `rewriteZip` 的适配层：本文件两个预处理器都以「解码后的 XML 字符串」为单位工作，
 * 而 ranuts 的 transform 收到的是原始字节。签名保持不变，两个预处理器的函数体一行未动。
 */
const rewriteXmlEntries = (
  bytes: Uint8Array,
  shouldProcess: (name: string) => boolean,
  transform: (xml: string, name: string) => string | null,
  inject?: Array<{ name: string; data: Uint8Array }>,
): Promise<Uint8Array> =>
  rewriteZip(bytes, {
    filter: (entry: ZipEntry) => shouldProcess(entry.name),
    transform: (data: Uint8Array, entry: ZipEntry) => transform(new TextDecoder().decode(data), entry.name),
    inject,
  });

export async function preprocessXlsxLineBreaks(xlsxBytes: Uint8Array): Promise<Uint8Array> {
  return rewriteXmlEntries(
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
  const hasAppXml = zipHasEntry(pptxBytes, 'docProps/app.xml');
  const hasCoreXml = zipHasEntry(pptxBytes, 'docProps/core.xml');

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

  return rewriteXmlEntries(
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
  // 覆盖三种 OOXML 的媒体目录：word/（DOCX）、xl/（XLSX）、ppt/（PPTX）
  const MEDIA_PREFIXES = ['word/media/', 'xl/media/', 'ppt/media/'];

  for (const entry of readZipEntries(docxBytes)) {
    const prefix = MEDIA_PREFIXES.find((p) => entry.name.startsWith(p));
    if (!prefix) continue;
    const baseName = entry.name.slice(prefix.length);
    if (!baseName || baseName.endsWith('/')) continue;

    try {
      // 不支持的压缩方式与损坏条目由 readZipEntry 返回 null，跳过即可
      const fileData = await readZipEntry(docxBytes, entry);
      if (!fileData) continue;

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
