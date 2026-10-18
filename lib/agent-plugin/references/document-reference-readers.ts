/** Standalone, read-only OOXML extraction. Never opens or mutates an editor. */
export const DOCUMENT_INPUT_LIMIT = 20 * 1024 * 1024;
const INFLATED_LIMIT = 32 * 1024 * 1024;
const OUTPUT_LIMIT = 262144;
const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  return value >>> 0;
});
const fail = (code = 'source-corrupt'): never => {
  throw new Error(code);
};
export async function readOfficeReference(bytes: Uint8Array, type: string, signal?: AbortSignal): Promise<string> {
  const deadline = performance.now() + 15000;
  const check = () => {
    signal?.throwIfAborted();
    if (performance.now() > deadline) fail('source-timeout');
  };
  check();
  if (bytes.length > DOCUMENT_INPUT_LIMIT) fail('source-too-large');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (p: number) => {
    if (p < 0 || p + 2 > bytes.length) fail();
    return view.getUint16(p, true);
  };
  const u32 = (p: number) => {
    if (p < 0 || p + 4 > bytes.length) fail();
    return view.getUint32(p, true);
  };
  let end = bytes.length - 22;
  while (end >= Math.max(0, bytes.length - 65557) && u32(end) !== 0x06054b50) end--;
  if (end < 0 || u32(end) !== 0x06054b50 || u16(end + 4) || u16(end + 6)) fail();
  const count = u16(end + 10);
  if (count > 2000) fail('source-too-large');
  const entries = new Map<string, { start: number; size: number; method: number; crc: number; expanded: number }>();
  let cursor = u32(end + 16);
  for (let i = 0; i < count; i++) {
    check();
    if (u32(cursor) !== 0x02014b50) fail();
    if (u16(cursor + 8) & 1) fail('source-encrypted');
    const method = u16(cursor + 10),
      size = u32(cursor + 20),
      expanded = u32(cursor + 24);
    if (expanded > INFLATED_LIMIT) fail('source-too-large');
    const n = u16(cursor + 28),
      local = u32(cursor + 42);
    const name = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(cursor + 46, cursor + 46 + n));
    if (entries.has(name) || name.includes('..') || name.startsWith('/')) fail();
    if (u32(local) !== 0x04034b50 || u16(local + 8) !== method || u16(local + 6) !== u16(cursor + 8)) fail();
    const localName = new TextDecoder().decode(bytes.subarray(local + 30, local + 30 + u16(local + 26)));
    if (localName !== name) fail();
    const crc = u32(cursor + 16);
    if (!(u16(local + 6) & 8) && (u32(local + 14) !== crc || u32(local + 18) !== size || u32(local + 22) !== expanded))
      fail();
    const start = local + 30 + u16(local + 26) + u16(local + 28);
    if (start + size > cursor || ![0, 8].includes(method)) fail();
    entries.set(name, { start, size, method, crc, expanded });
    cursor += 46 + n + u16(cursor + 30) + u16(cursor + 32);
  }
  let inflated = 0,
    nodes = 1,
    paragraphs = 0,
    cells = 0,
    outputBytes = 0;
  const output: string[] = [];
  const append = (text: string) => {
    check();
    outputBytes += new TextEncoder().encode(text).length + (output.length ? 1 : 0);
    if (outputBytes > OUTPUT_LIMIT) fail('source-too-large');
    if (text) output.push(text);
  };
  async function xml(name: string): Promise<Document> {
    check();
    const entry = entries.get(name) ?? fail();
    let position = entry.start;
    let stream: ReadableStream<Uint8Array<ArrayBuffer>> = new ReadableStream<Uint8Array<ArrayBuffer>>({
      pull(controller) {
        if (position >= entry.start + entry.size) {
          controller.close();
          return;
        }
        const end = Math.min(position + 65536, entry.start + entry.size);
        controller.enqueue(bytes.slice(position, end));
        position = end;
      },
    });
    if (entry.method === 8) {
      if (typeof DecompressionStream !== 'function') fail('source-unsupported');
      stream = stream.pipeThrough<Uint8Array<ArrayBuffer>>(new DecompressionStream('deflate-raw'));
    }
    const reader = stream.getReader();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let crc = 0xffffffff,
      actual = 0;
    let text = '';
    const abort = () => {
      void reader.cancel();
    };
    signal?.addEventListener('abort', abort, { once: true });
    try {
      while (true) {
        check();
        const chunk = await reader.read();
        check();
        if (chunk.done) break;
        inflated += chunk.value.length;
        actual += chunk.value.length;
        for (const byte of chunk.value) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 255];
        if (inflated > INFLATED_LIMIT) fail('source-too-large');
        text += decoder.decode(chunk.value, { stream: true });
        if (actual % 1048576 < chunk.value.length) {
          await new Promise((resolve) => setTimeout(resolve, 0));
          check();
        }
      }
      text += decoder.decode();
      if ((crc ^ 0xffffffff) >>> 0 !== entry.crc || actual !== entry.expanded) fail();
    } finally {
      signal?.removeEventListener('abort', abort);
      await reader.cancel().catch(() => undefined);
    }
    if (/<!DOCTYPE|<!ENTITY/i.test(text)) fail();
    for (const _ of text.matchAll(/<!--|<\?|<!\[CDATA\[|<[^!?/]|>[^<]+/g)) {
      if (++nodes > 100000) fail('source-too-large');
      if (nodes % 1000 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
        check();
      }
    }
    check();
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) fail();
    return doc;
  }
  const namespaces = new Set([
    '',
    'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    'http://schemas.openxmlformats.org/drawingml/2006/main',
    'http://schemas.openxmlformats.org/presentationml/2006/main',
    'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
    'http://schemas.openxmlformats.org/package/2006/relationships',
    'http://purl.oclc.org/ooxml/wordprocessingml/main',
    'http://purl.oclc.org/ooxml/drawingml/main',
    'http://purl.oclc.org/ooxml/presentationml/main',
    'http://purl.oclc.org/ooxml/spreadsheetml/main',
  ]);
  const elements = (root: Document | Element, name: string) =>
    Array.from(root.getElementsByTagNameNS('*', name)).filter((node) => namespaces.has(node.namespaceURI ?? ''));
  const relationshipId = (element: Element) =>
    element.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ??
    element.getAttributeNS('http://purl.oclc.org/ooxml/officeDocument/relationships', 'id') ??
    '';
  const paragraphText = (root: Document) => {
    paragraphs += elements(root, 'p').length;
    if (paragraphs > 10000) fail('source-too-large');
    let previous: Element | null = null,
      text = '';
    for (const t of elements(root, '*')) {
      if (!['t', 'tab', 'br'].includes(t.localName)) continue;
      let p = t.parentElement;
      while (p && p.localName !== 'p') p = p.parentElement;
      if (p !== previous) {
        append(text);
        text = '';
        previous = p;
      }
      text += t.localName === 'tab' ? '\t' : t.localName === 'br' ? '\n' : (t.textContent ?? '');
    }
    append(text);
  };
  async function relationships(path: string) {
    const rels = await xml(path);
    const map = new Map<string, string>();
    for (const r of elements(rels, 'Relationship')) {
      if (r.getAttribute('TargetMode') === 'External') continue;
      const target = r.getAttribute('Target') ?? '';
      if (target.includes(':') || target.includes('\\') || target.includes('?') || target.includes('#')) fail();
      const segments: string[] = target.startsWith('/') ? [] : [path.split('/')[0]];
      for (const segment of target.split('/')) {
        if (!segment || segment === '.') continue;
        if (segment === '..') {
          if (!segments.length) fail();
          segments.pop();
        } else segments.push(segment);
      }
      map.set(r.getAttribute('Id') ?? '', segments.join('/'));
    }
    return map;
  }
  if (type === 'docx') paragraphText(await xml('word/document.xml'));
  else if (type === 'pptx') {
    const doc = await xml('ppt/presentation.xml');
    const rels = await relationships('ppt/_rels/presentation.xml.rels');
    for (const slide of elements(doc, 'sldId')) {
      const target = rels.get(relationshipId(slide)) ?? fail();
      paragraphText(await xml(target));
    }
  } else if (type === 'xlsx') {
    const doc = await xml('xl/workbook.xml'),
      rels = await relationships('xl/_rels/workbook.xml.rels');
    const sheets = elements(doc, 'sheet');
    if (sheets.length > 20) fail('source-too-large');
    const strings = entries.has('xl/sharedStrings.xml')
      ? elements(await xml('xl/sharedStrings.xml'), 'si').map((si) =>
          elements(si, 't')
            .map((t) => t.textContent ?? '')
            .join(''),
        )
      : [];
    for (const sheet of sheets) {
      const target = rels.get(relationshipId(sheet)) ?? fail();
      append(sheet.getAttribute('name') ?? '');
      for (const row of elements(await xml(target), 'row')) {
        const values: string[] = [];
        for (const cell of elements(row, 'c')) {
          check();
          if (++cells > 10000) fail('source-too-large');
          const value = elements(cell, 'v')[0]?.textContent ?? '';
          const address = cell.getAttribute('r') ?? '';
          if (address && !/^[A-Z]{1,3}[1-9][0-9]{0,6}$/.test(address)) fail();
          values.push(
            (address ? address + ': ' : '') +
              (cell.getAttribute('t') === 's'
                ? (strings[Number(value)] ?? '')
                : cell.getAttribute('t') === 'inlineStr'
                  ? elements(cell, 't')
                      .map((t) => t.textContent ?? '')
                      .join('')
                  : value),
          );
        }
        append(values.join('\t'));
      }
    }
  } else fail('source-unsupported');
  check();
  const result = output.join('\n');
  if (!result.trim()) fail('source-empty');
  return result;
}
