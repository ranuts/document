/**
 * Minimal OOXML builders for E2E fixtures (docs/superpowers/plans/2026-08-15-v9-test-coverage-strategy.md,
 * section 2 tier 3: synthetic corpus). Runs in Node; hand the bytes to the
 * page as base64 (Playwright serializes strings cheaply) and rebuild the
 * ArrayBuffer there. Stored (uncompressed) zip so no dependency is needed
 * and no binary fixture lives in the repo.
 */

import { createZip, readZipEntries, readZipEntry } from 'ranuts/utils';

/**
 * Archive plumbing comes from ranuts (`createZip` / `readZipEntries` /
 * `readZipEntry`): ecosystem first, and its reader takes sizes from the
 * central directory, which is what makes it survive streaming-written
 * archives. Only the OOXML-shaped helpers live here.
 */
export const makeStoredZip = (entries: ReadonlyArray<{ name: string; data: Uint8Array | string }>): Uint8Array =>
  createZip(entries);

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

/**
 * A one-paragraph .docx (or, with `bodyXml`, an arbitrary <w:body> content).
 * `opts.headerText` / `opts.footerText` add a default header/footer part
 * wired through sectPr.
 */
export function buildDocx(
  text: string,
  bodyXml?: string,
  opts: { headerText?: string; footerText?: string } = {},
): Uint8Array {
  const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const hf = (tag: 'hdr' | 'ftr', t: string) =>
    XML_HEAD + `<w:${tag} xmlns:w="${W}"><w:p><w:r><w:t>${t}</w:t></w:r></w:p></w:${tag}>`;
  const extraOverrides =
    (opts.headerText
      ? '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>'
      : '') +
    (opts.footerText
      ? '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>'
      : '');
  const docRels =
    (opts.headerText ? `<Relationship Id="rIdH1" Type="${REL}/header" Target="header1.xml"/>` : '') +
    (opts.footerText ? `<Relationship Id="rIdF1" Type="${REL}/footer" Target="footer1.xml"/>` : '');
  const sectPr =
    opts.headerText || opts.footerText
      ? '<w:sectPr>' +
        (opts.headerText ? '<w:headerReference w:type="default" r:id="rIdH1"/>' : '') +
        (opts.footerText ? '<w:footerReference w:type="default" r:id="rIdF1"/>' : '') +
        '<w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>'
      : '';
  const extraParts: Array<{ name: string; data: string }> = [];
  if (opts.headerText) extraParts.push({ name: 'word/header1.xml', data: hf('hdr', opts.headerText) });
  if (opts.footerText) extraParts.push({ name: 'word/footer1.xml', data: hf('ftr', opts.footerText) });
  if (docRels) {
    extraParts.push({
      name: 'word/_rels/document.xml.rels',
      data:
        XML_HEAD +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        docRels +
        '</Relationships>',
    });
  }
  return makeStoredZip([
    {
      name: '[Content_Types].xml',
      data:
        XML_HEAD +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
        extraOverrides +
        '</Types>',
    },
    {
      name: '_rels/.rels',
      data:
        XML_HEAD +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
        '</Relationships>',
    },
    {
      name: 'word/document.xml',
      data:
        XML_HEAD +
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        `<w:body>${bodyXml ?? `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`}${sectPr}</w:body></w:document>`,
    },
    ...extraParts,
  ]);
}

export function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

/** A one-slide .pptx with a single title text box (minimal master/layout chain). */
export function buildPptx(title: string): Uint8Array {
  const NS =
    'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
    'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
  const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const CT = 'application/vnd.openxmlformats-officedocument.presentationml';
  const shapeTree = (extra: string) =>
    '<p:cSld><p:spTree>' +
    '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
    '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>' +
    extra +
    '</p:spTree></p:cSld>';
  const theme =
    XML_HEAD +
    '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office"><a:themeElements>' +
    '<a:clrScheme name="Office"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>' +
    '<a:dk2><a:srgbClr val="1F497D"/></a:dk2><a:lt2><a:srgbClr val="EEECE1"/></a:lt2><a:accent1><a:srgbClr val="4F81BD"/></a:accent1>' +
    '<a:accent2><a:srgbClr val="C0504D"/></a:accent2><a:accent3><a:srgbClr val="9BBB59"/></a:accent3><a:accent4><a:srgbClr val="8064A2"/></a:accent4>' +
    '<a:accent5><a:srgbClr val="4BACC6"/></a:accent5><a:accent6><a:srgbClr val="F79646"/></a:accent6><a:hlink><a:srgbClr val="0000FF"/></a:hlink>' +
    '<a:folHlink><a:srgbClr val="800080"/></a:folHlink></a:clrScheme>' +
    '<a:fontScheme name="Office"><a:majorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>' +
    '<a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>' +
    '<a:fmtScheme name="Office"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>' +
    '<a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="25400"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="38100"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>' +
    '<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>' +
    '<a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>' +
    '</a:fmtScheme></a:themeElements></a:theme>';
  const escaped = title.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const slide =
    XML_HEAD +
    `<p:sld ${NS}>` +
    shapeTree(
      '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title 1"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>' +
        '<p:spPr><a:xfrm><a:off x="685800" y="457200"/><a:ext cx="7772400" cy="1143000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>' +
        `<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>${escaped}</a:t></a:r></a:p></p:txBody></p:sp>`,
    ) +
    '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>';
  const layout =
    XML_HEAD +
    `<p:sldLayout ${NS} type="title" preserve="1">` +
    shapeTree('') +
    '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>';
  const master =
    XML_HEAD +
    `<p:sldMaster ${NS}>` +
    shapeTree('') +
    '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>' +
    '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>' +
    '<p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr sz="4400"/></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr><a:defRPr sz="3200"/></a:lvl1pPr></p:bodyStyle><p:otherStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:otherStyle></p:txStyles>' +
    '</p:sldMaster>';
  const presentation =
    XML_HEAD +
    `<p:presentation ${NS} saveSubsetFonts="1">` +
    '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>' +
    '<p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst>' +
    '<p:sldSz cx="9144000" cy="6858000" type="screen4x3"/><p:notesSz cx="6858000" cy="9144000"/>' +
    '</p:presentation>';
  const rels = (items: Array<[string, string, string]>) =>
    XML_HEAD +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    items.map(([id, type, target]) => `<Relationship Id="${id}" Type="${REL}/${type}" Target="${target}"/>`).join('') +
    '</Relationships>';
  return makeStoredZip([
    {
      name: '[Content_Types].xml',
      data:
        XML_HEAD +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        `<Override PartName="/ppt/presentation.xml" ContentType="${CT}.presentation.main+xml"/>` +
        `<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="${CT}.slideMaster+xml"/>` +
        `<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="${CT}.slideLayout+xml"/>` +
        `<Override PartName="/ppt/slides/slide1.xml" ContentType="${CT}.slide+xml"/>` +
        '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>' +
        '</Types>',
    },
    { name: '_rels/.rels', data: rels([['rId1', 'officeDocument', 'ppt/presentation.xml']]) },
    { name: 'ppt/presentation.xml', data: presentation },
    {
      name: 'ppt/_rels/presentation.xml.rels',
      data: rels([
        ['rId1', 'slideMaster', 'slideMasters/slideMaster1.xml'],
        ['rId2', 'slide', 'slides/slide1.xml'],
      ]),
    },
    { name: 'ppt/slideMasters/slideMaster1.xml', data: master },
    {
      name: 'ppt/slideMasters/_rels/slideMaster1.xml.rels',
      data: rels([
        ['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'],
        ['rId2', 'theme', '../theme/theme1.xml'],
      ]),
    },
    { name: 'ppt/slideLayouts/slideLayout1.xml', data: layout },
    {
      name: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
      data: rels([['rId1', 'slideMaster', '../slideMasters/slideMaster1.xml']]),
    },
    { name: 'ppt/slides/slide1.xml', data: slide },
    {
      name: 'ppt/slides/_rels/slide1.xml.rels',
      data: rels([['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml']]),
    },
    { name: 'ppt/theme/theme1.xml', data: theme },
  ]);
}

/** Entry names of a zip (central directory walk); enough for L1 checks. */
export function zipEntryNames(bytes: Uint8Array): string[] {
  return readZipEntries(bytes).map((e) => e.name);
}

/** Decoded text of one zip entry (stored or deflated) -- for L2 content checks on OOXML parts. */
export async function zipEntryText(bytes: Uint8Array, name: string): Promise<string | null> {
  const data = await readZipEntry(bytes, name);
  return data ? new TextDecoder().decode(data) : null;
}

const XML_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
export function decodeXmlEntities(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, ent: string) => {
    if (ent[0] === '#')
      return String.fromCodePoint(ent[1] === 'x' ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10));
    return ent in XML_ENTITIES ? XML_ENTITIES[ent] : m;
  });
}

/** Concatenated, entity-decoded text of all <w:t>/<a:t> runs in an OOXML part. */
export function ooxmlText(xml: string): string {
  return Array.from(xml.matchAll(/<(?:w|a):t(?:\s[^>]*)?>([^<]*)<\/(?:w|a):t>/g), (m) => decodeXmlEntities(m[1])).join(
    '',
  );
}

/**
 * A hand-built .xlsx with inline strings, optional frozen panes and an
 * optional autofilter (SheetJS CE writes neither).
 */
export function buildXlsx(opts: {
  rows: Array<Array<string | number>>;
  freeze?: { rows: number; cols: number };
  autoFilterRef?: string;
}): Uint8Array {
  const colName = (i: number) => {
    let n = i + 1;
    let out = '';
    while (n > 0) {
      const r = (n - 1) % 26;
      out = String.fromCharCode(65 + r) + out;
      n = Math.floor((n - 1) / 26);
    }
    return out;
  };
  const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const sheetData = opts.rows
    .map((row, r) => {
      const cells = row
        .map((v, c) => {
          const ref = `${colName(c)}${r + 1}`;
          return typeof v === 'number'
            ? `<c r="${ref}"><v>${v}</v></c>`
            : `<c r="${ref}" t="inlineStr"><is><t>${esc(v)}</t></is></c>`;
        })
        .join('');
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join('');
  const lastRef = `${colName(Math.max(...opts.rows.map((r) => r.length)) - 1)}${opts.rows.length}`;
  let pane = '';
  if (opts.freeze) {
    const { rows, cols } = opts.freeze;
    const topLeft = `${colName(cols)}${rows + 1}`;
    pane =
      `<pane${cols ? ` xSplit="${cols}"` : ''}${rows ? ` ySplit="${rows}"` : ''} topLeftCell="${topLeft}" activePane="bottomRight" state="frozen"/>` +
      `<selection pane="bottomRight" activeCell="${topLeft}" sqref="${topLeft}"/>`;
  }
  const sheet =
    XML_HEAD +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<dimension ref="A1:${lastRef}"/>` +
    `<sheetViews><sheetView tabSelected="1" workbookViewId="0">${pane}</sheetView></sheetViews>` +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    `<sheetData>${sheetData}</sheetData>` +
    (opts.autoFilterRef ? `<autoFilter ref="${opts.autoFilterRef}"/>` : '') +
    '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>' +
    '</worksheet>';
  const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  return makeStoredZip([
    {
      name: '[Content_Types].xml',
      data:
        XML_HEAD +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '</Types>',
    },
    {
      name: '_rels/.rels',
      data:
        XML_HEAD +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        `<Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/>` +
        '</Relationships>',
    },
    {
      name: 'xl/workbook.xml',
      data:
        XML_HEAD +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<sheets><sheet name="Frozen" sheetId="1" r:id="rId1"/></sheets></workbook>',
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data:
        XML_HEAD +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        `<Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/>` +
        '</Relationships>',
    },
    { name: 'xl/worksheets/sheet1.xml', data: sheet },
  ]);
}

/**
 * All <w:t>/<a:t> text of the main story parts of a docx (document.xml) or
 * pptx (every slide). Shapes flagged hidden="1" are skipped: template
 * fingerprints and other invisible off-slide text boxes that OnlyOffice
 * drops on save (vendor behavior, not user-visible content).
 */
export async function ooxmlDocumentText(bytes: Uint8Array): Promise<string> {
  const names = zipEntryNames(bytes);
  const parts = names.includes('word/document.xml')
    ? ['word/document.xml']
    : names.filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort();
  const withoutHidden = (xml: string) =>
    xml.replace(/<p:sp>[\s\S]*?<\/p:sp>/g, (block) => (/<p:cNvPr[^>]*\shidden="1"/.test(block) ? '' : block));
  // Fields (slide number, date) carry a cached value that legitimately
  // changes on save ("<#>" placeholder -> "11"); compare the static text only.
  const withoutFields = (xml: string) =>
    xml
      .replace(/<a:fld\b[\s\S]*?<\/a:fld>/g, '')
      .replace(/<w:fldSimple\b[\s\S]*?<\/w:fldSimple>/g, '')
      // Ruby guide text (<w:rt>) is a known loss on save (the base word is
      // preserved by preprocessDocxRuby); compare base text only.
      .replace(/<w:rt\b[\s\S]*?<\/w:rt>/g, '');
  const texts = await Promise.all(
    parts.map(async (n) => ooxmlText(withoutFields(withoutHidden((await zipEntryText(bytes, n)) || '')))),
  );
  return texts.join('\n');
}

/**
 * How much of `before`'s text survives in `after`, as the fraction of
 * 20-char shingles of `before` (whitespace-normalized) found in `after`.
 * 1 = nothing lost. Robust to small insertions (a typed "QA") and to
 * run/paragraph re-splitting on save.
 */
export function textCoverage(before: string, after: string, shingle = 20): { coverage: number; shingles: number } {
  // Whitespace is dropped entirely: whitespace-only runs without
  // xml:space="preserve" are legitimately not significant and the editor
  // re-splits runs freely; text loss is what we are after, not spacing.
  const norm = (t: string) => t.replace(/\s+/g, '');
  const a = norm(before);
  const b = norm(after);
  if (a.length <= shingle) return { coverage: b.includes(a) ? 1 : 0, shingles: 1 };
  let hit = 0;
  let total = 0;
  for (let i = 0; i + shingle <= a.length; i += Math.max(1, Math.floor(shingle / 2))) {
    total++;
    if (b.includes(a.slice(i, i + shingle))) hit++;
  }
  return { coverage: total ? hit / total : 1, shingles: total };
}
