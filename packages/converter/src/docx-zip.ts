import { readZipEntries, readZipEntry, rewriteZip, zipHasEntry } from 'ranuts/utils';
import type { ZipEntry } from 'ranuts/utils';

// OOXML (DOCX / XLSX / PPTX) files are ZIP archives. The ZIP plumbing itself —
// central-directory parsing, DEFLATE inflation, CRC, archive rebuilding — comes
// from ranuts, so all that is left here is the OOXML-specific part: the MIME map
// for embedded media, plus three OnlyOffice-specific preprocessing passes.
//
// Note that ranuts' readZipEntries takes sizes and CRCs from the **central
// directory**, not the local headers: streaming writers leave zeros in the local
// header and put the real values in the data descriptor (general-purpose bit 3),
// and trusting the local header is the single most common way hand-rolled ZIP
// parsers break on real-world files.

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
 * Adapter over `rewriteZip`: both preprocessors in this file work on *decoded XML
 * strings*, whereas ranuts' `transform` hands over raw bytes. Keeping the
 * signature here means neither preprocessor body has to care about decoding.
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
  // Covers the media directory of all three OOXML formats: word/ (DOCX),
  // xl/ (XLSX) and ppt/ (PPTX).
  const MEDIA_PREFIXES = ['word/media/', 'xl/media/', 'ppt/media/'];

  for (const entry of readZipEntries(docxBytes)) {
    const prefix = MEDIA_PREFIXES.find((p) => entry.name.startsWith(p));
    if (!prefix) continue;
    const baseName = entry.name.slice(prefix.length);
    if (!baseName || baseName.endsWith('/')) continue;

    try {
      // readZipEntry returns null for unsupported compression methods and for
      // corrupt entries — skipping them is the right behaviour.
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

/**
 * Unwrap phonetic guides (<w:ruby>: Japanese furigana, Chinese pinyin) into
 * their base text before the editor imports a DOCX. The vendor importer drops
 * the whole ruby element -- guide AND base word -- so a document that reads
 * "東京" with とうきょう above it comes back without "東京" at all. Keeping
 * the base run loses only the annotation. A ruby sits inside a run
 * (<w:r><w:rPr/><w:ruby>...<w:rubyBase><w:r>..</w:r></w:rubyBase></w:ruby></w:r>),
 * so the element is replaced by "close run, base runs, reopen run" to keep the
 * enclosing run balanced without nesting runs.
 */
export function unwrapRubyXml(xml: string): string | null {
  if (!xml.includes('<w:ruby')) return null;
  const next = xml.replace(/<w:ruby(?:\s[^>]*)?>[\s\S]*?<\/w:ruby>/g, (ruby) => {
    const base = /<w:rubyBase(?:\s[^>]*)?>([\s\S]*?)<\/w:rubyBase>/.exec(ruby);
    return `</w:r>${base ? base[1] : ''}<w:r>`;
  });
  return next !== xml ? next : null;
}

export async function preprocessDocxRuby(docxBytes: Uint8Array): Promise<Uint8Array> {
  // Cheap gate: only rebuild the archive when the main story actually has one.
  const main = await readZipEntry(docxBytes, 'word/document.xml');
  const hasRubyMain = main ? new TextDecoder().decode(main).includes('<w:ruby') : false;
  if (!hasRubyMain) return docxBytes;
  return rewriteXmlEntries(
    docxBytes,
    (name) => name.startsWith('word/') && name.endsWith('.xml'),
    (xml) => unwrapRubyXml(xml),
  );
}
