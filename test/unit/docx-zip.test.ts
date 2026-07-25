import { deflateRawSync } from 'node:zlib';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { readZipEntries, readZipEntry } from 'ranuts/utils';
import { extractDocxMediaUrls, preprocessPptx, preprocessXlsxLineBreaks } from '@ranuts/converter';

/**
 * OOXML 就是 ZIP，所以这些函数处理的是真实二进制。构造真归档来测，而不是打桩：
 * DEFLATE 条目、STORED 条目、以及「本地头里填 0、真值在数据描述符里」这种流式写入器
 * 产物都要覆盖到——最后一种正是手写 ZIP 解析器最容易翻车的地方。
 */

const enc = new TextEncoder();

interface FixtureEntry {
  name: string;
  content: string | Uint8Array;
  /** 压缩存储（method 8）；默认 STORED */
  deflate?: boolean;
  /** 模拟流式写入器：本地头写 0，真值只留在中央目录 */
  streamed?: boolean;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

const crc32 = (data: Uint8Array): number => {
  let c = 0xffffffff;
  for (const byte of data) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

/** 组装一个真正的 ZIP（本地头 + 中央目录 + EOCD）。 */
const buildZip = (entries: FixtureEntry[]): Uint8Array => {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const raw = typeof entry.content === 'string' ? enc.encode(entry.content) : entry.content;
    const stored = entry.deflate ? new Uint8Array(deflateRawSync(raw)) : raw;
    const nameBytes = enc.encode(entry.name);
    const crc = crc32(raw);
    const method = entry.deflate ? 8 : 0;
    // 流式写入器：本地头置 0 并打上通用位 3，真值只出现在中央目录
    const flags = entry.streamed ? 0x08 : 0;

    const local = new Uint8Array(30 + nameBytes.length + stored.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, flags, true);
    lv.setUint16(8, method, true);
    lv.setUint32(14, entry.streamed ? 0 : crc, true);
    lv.setUint32(18, entry.streamed ? 0 : stored.length, true);
    lv.setUint32(22, entry.streamed ? 0 : raw.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(stored, 30 + nameBytes.length);
    locals.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, flags, true);
    cv.setUint16(10, method, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, stored.length, true);
    cv.setUint32(24, raw.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centrals.push(central);

    offset += local.length;
  }

  const centralSize = centrals.reduce((n, c) => n + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const total = offset + centralSize + eocd.length;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const part of [...locals, ...centrals, eocd]) {
    out.set(part, pos);
    pos += part.length;
  }
  return out;
};

const textOf = async (zip: Uint8Array, name: string): Promise<string> => {
  const data = await readZipEntry(zip, name);
  return data ? new TextDecoder().decode(data) : '';
};

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 5, 6, 7, 8]);

beforeAll(() => {
  // jsdom 没有实现 createObjectURL
  if (!URL.createObjectURL) {
    Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:stub'), configurable: true });
  }
});

describe('extractDocxMediaUrls', () => {
  it('提取 DOCX 的 word/media 条目（DEFLATE 压缩）', async () => {
    const zip = buildZip([
      { name: 'word/document.xml', content: '<w:document/>' },
      { name: 'word/media/image1.png', content: PNG, deflate: true },
    ]);
    const urls = await extractDocxMediaUrls(zip);
    expect(Object.keys(urls)).toEqual(['media/image1.png']);
  });

  it('同样覆盖 XLSX 与 PPTX 的媒体目录', async () => {
    const xlsx = buildZip([{ name: 'xl/media/image2.jpg', content: PNG }]);
    const pptx = buildZip([{ name: 'ppt/media/image3.gif', content: PNG }]);
    expect(Object.keys(await extractDocxMediaUrls(xlsx))).toEqual(['media/image2.jpg']);
    expect(Object.keys(await extractDocxMediaUrls(pptx))).toEqual(['media/image3.gif']);
  });

  it('读取流式写入器产物：本地头是 0，尺寸要从中央目录取', async () => {
    // 回归护栏：照本地头读尺寸会拿到 0 字节，媒体全部丢失
    const zip = buildZip([{ name: 'word/media/image1.png', content: PNG, deflate: true, streamed: true }]);
    expect(Object.keys(await extractDocxMediaUrls(zip))).toEqual(['media/image1.png']);
  });

  it('忽略目录条目与非媒体文件', async () => {
    const zip = buildZip([
      { name: 'word/media/', content: '' },
      { name: 'word/document.xml', content: '<w:document/>' },
    ]);
    expect(await extractDocxMediaUrls(zip)).toEqual({});
  });

  it('对不是 ZIP 的输入返回空而不是抛错', async () => {
    expect(await extractDocxMediaUrls(enc.encode('not a zip at all'))).toEqual({});
  });
});

describe('preprocessXlsxLineBreaks', () => {
  it('把双重转义的换行还原成 &#10;', async () => {
    const zip = buildZip([
      { name: 'xl/sharedStrings.xml', content: '<t>a&amp;#10;b</t>', deflate: true },
      { name: 'xl/workbook.xml', content: '<workbook/>' },
    ]);
    const out = await preprocessXlsxLineBreaks(zip);
    expect(await textOf(out, 'xl/sharedStrings.xml')).toBe('<t>a&#10;b</t>');
  });

  it('不动其它条目，且归档仍可读', async () => {
    const zip = buildZip([
      { name: 'xl/sharedStrings.xml', content: '<t>a&amp;#10;b</t>' },
      { name: 'xl/workbook.xml', content: '<workbook/>' },
      { name: 'docProps/core.xml', content: '<core/>' },
    ]);
    const out = await preprocessXlsxLineBreaks(zip);
    expect(
      readZipEntries(out)
        .map((e) => e.name)
        .sort(),
    ).toEqual(['docProps/core.xml', 'xl/sharedStrings.xml', 'xl/workbook.xml']);
    expect(await textOf(out, 'xl/workbook.xml')).toBe('<workbook/>');
  });

  it('没有需要改的内容时原样返回', async () => {
    const zip = buildZip([{ name: 'xl/workbook.xml', content: '<workbook/>' }]);
    expect(await preprocessXlsxLineBreaks(zip)).toBe(zip);
  });
});

describe('preprocessPptx', () => {
  const RELS =
    '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://x/officeDocument" Target="ppt/presentation.xml"/>' +
    '</Relationships>';

  it('缺 app.xml / core.xml 时注入，并在 .rels 里补上关系', async () => {
    const zip = buildZip([
      { name: '_rels/.rels', content: RELS },
      { name: 'ppt/presentation.xml', content: '<p:presentation/>' },
    ]);
    const out = await preprocessPptx(zip);
    const names = readZipEntries(out).map((e) => e.name);
    expect(names).toContain('docProps/app.xml');
    expect(names).toContain('docProps/core.xml');

    const rels = await textOf(out, '_rels/.rels');
    expect(rels).toContain('docProps/app.xml');
    expect(rels).toContain('docProps/core.xml');
    // 新关系 id 必须避开已用的 rId1
    expect(rels).toContain('rId2');
    expect(rels).toContain('rId3');
  });

  it('已有 app.xml / core.xml 时不重复注入', async () => {
    const zip = buildZip([
      { name: '_rels/.rels', content: RELS },
      { name: 'docProps/app.xml', content: '<Properties/>' },
      { name: 'docProps/core.xml', content: '<cp:coreProperties/>' },
      { name: 'ppt/notesSlides/notesSlide1.xml', content: '<p:notes showMasterPhAnim="1"/>' },
    ]);
    const out = await preprocessPptx(zip);
    const names = readZipEntries(out).map((e) => e.name);
    expect(names.filter((n) => n === 'docProps/app.xml')).toHaveLength(1);
    expect(await textOf(out, '_rels/.rels')).toBe(RELS);
  });

  it('剥掉 notes slide 上的 showMasterPhAnim', async () => {
    const zip = buildZip([
      { name: '_rels/.rels', content: RELS },
      { name: 'docProps/app.xml', content: '<Properties/>' },
      { name: 'docProps/core.xml', content: '<cp:coreProperties/>' },
      {
        name: 'ppt/notesSlides/notesSlide1.xml',
        content: '<p:notes showMasterPhAnim="1"><x/></p:notes>',
        deflate: true,
      },
    ]);
    const out = await preprocessPptx(zip);
    expect(await textOf(out, 'ppt/notesSlides/notesSlide1.xml')).toBe('<p:notes><x/></p:notes>');
  });

  it('重建后的归档所有条目仍可解出原内容', async () => {
    const zip = buildZip([
      { name: '_rels/.rels', content: RELS },
      { name: 'ppt/presentation.xml', content: '<p:presentation/>', deflate: true },
      { name: 'ppt/media/image1.png', content: PNG, deflate: true },
    ]);
    const out = await preprocessPptx(zip);
    expect(await textOf(out, 'ppt/presentation.xml')).toBe('<p:presentation/>');
    const media = await readZipEntry(out, 'ppt/media/image1.png');
    expect(media && Array.from(media)).toEqual(Array.from(PNG));
  });
});
