#!/usr/bin/env node
/**
 * Replace every proprietary face in the vendor font catalog with an
 * open-licensed one, and give each script a single family to fall back to.
 *
 * Why this exists
 * ---------------
 * The vendor's offline bundle ships the font set an OnlyOffice Docs *server*
 * would have picked up from its host: Microsoft's core web fonts, Monotype's
 * Arial/Times/Courier, and ~150 MB of Chinese faces owned by SinoType,
 * Founder, ZhongYi and others. Redistributing those from a public repository
 * and a public origin is not something their licenses allow.
 *
 * The same swap fixes two rendering problems.
 *
 * 1. CJK was stitched across three unrelated families -- ideographs fell to
 *    Droid Sans Fallback, the fullwidth comma to SimSun, the ideographic full
 *    stop to Microsoft YaHei -- so one line of Chinese was set in three
 *    typefaces at three stroke weights, and Droid Sans Fallback has no bold
 *    at all. Every CJK block now resolves to Noto Sans CJK SC, whose one file
 *    carries Simplified Chinese, Traditional Chinese, Japanese and Korean.
 *
 * 2. Calibri was single-handedly covering Arabic, Armenian, Georgian, Hebrew
 *    and Cyrillic Supplement. Swapping it for metric-compatible Carlito, which
 *    has none of those scripts, would have turned all five into tofu. Each is
 *    routed at a face that actually has the glyphs -- and Syriac and Thaana,
 *    which no catalog font covered at all, now have one too.
 *
 * How the swap works
 * ------------------
 * `__fonts_files` is a *positional* array: `__fonts_infos` rows reference a
 * face by its index in it, not by name. So this does not delete entries --
 * it overwrites the slot of a proprietary file with the name of its
 * replacement. Every document that names "SimSun" or "Arial" keeps resolving,
 * and lands on the open face instead. That is the same metric-compatible
 * substitution LibreOffice ships (Liberation for Arial/Times/Courier,
 * Carlito for Calibri), so line and page breaks do not move.
 *
 * `g_fonts_selection_bin` is deliberately left alone: it is the undocumented
 * binary behind the font picker and its metrics, and the family names it
 * carries are exactly the aliases we want to keep answering to.
 *
 * Source faces are not committed -- they are a second copy of bytes the
 * catalog already holds. Fetch them into vendor-fonts/ per docs/fonts.md.
 *
 * Usage:
 *   node bin/font-license-sweep.mjs --check   # report, touch nothing
 *   node bin/font-license-sweep.mjs           # apply
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_DIR = path.join(ROOT, 'public/fonts');
const SOURCE_DIR = path.join(ROOT, 'vendor-fonts');
const ALL_FONTS = path.join(ROOT, 'public/sdkjs/common/AllFonts.js');
const CHECK_ONLY = process.argv.includes('--check');

/** The catalog wire format: a TTF/OTF whose first 32 bytes are XOR'd. */
const XOR_KEY = [160, 102, 214, 32, 20, 150, 71, 250, 149, 105, 184, 80, 176, 65, 73, 72];
const xorPrefix = (buf) => {
  const out = Buffer.from(buf);
  for (let i = 0; i < Math.min(32, out.length); i++) out[i] ^= XOR_KEY[i % XOR_KEY.length];
  return out;
};

/**
 * Faces this sweep adds, as `family: [regularSource, boldSource]`. Slots are
 * assigned in order from the end of the existing catalog.
 *
 * The CJK pair is the language-specific Noto CJK build (SIL OFL 1.1): one
 * file per weight covering Simplified Chinese, Traditional Chinese, Japanese
 * and Korean, so a Japanese or Korean document falls back to the same family
 * a Chinese one does instead of to whichever partial face happened to cover
 * the block. The rest are per-script Noto faces, together under 2 MB, that
 * take over the scripts Calibri used to carry.
 */
const ADDED_FAMILIES = [
  { family: 'Noto Sans CJK SC', faces: ['NotoSansCJKsc-Regular.otf', 'NotoSansCJKsc-Bold.otf'] },
  { family: 'Noto Serif CJK SC', faces: ['NotoSerifCJKsc-Regular.otf', 'NotoSerifCJKsc-Bold.otf'] },
  { family: 'Noto Sans', faces: ['NotoSans-Regular.ttf', 'NotoSans-Bold.ttf'] },
  { family: 'Noto Sans Hebrew', faces: ['NotoSansHebrew-Regular.ttf', 'NotoSansHebrew-Bold.ttf'] },
  { family: 'Noto Sans Armenian', faces: ['NotoSansArmenian-Regular.ttf', 'NotoSansArmenian-Bold.ttf'] },
  { family: 'Noto Sans Georgian', faces: ['NotoSansGeorgian-Regular.ttf', 'NotoSansGeorgian-Bold.ttf'] },
  { family: 'Noto Sans Thaana', faces: ['NotoSansThaana-Regular.ttf', 'NotoSansThaana-Bold.ttf'] },
  { family: 'Noto Sans Syriac', faces: ['NotoSansSyriac-Regular.ttf', null] },
];

/**
 * Chinese families that read as serif -- Song/Ming, Fangsong and the Kai
 * (brush-regular) faces, which carry stroke terminals. These are what a
 * Chinese document's body text is normally set in, so they get the serif
 * face rather than being flattened into a sans.
 *
 * The strings are catalog data, not UI copy: they are the exact family names
 * `__fonts_infos` carries, and a document referencing one has to keep
 * resolving. They cannot be translated or normalised away.
 */
const SERIF_CJK_FAMILIES = new Set([
  'SimSun',
  'NSimSun',
  '宋体',
  '新宋体',
  'STSong',
  '华文宋体',
  'STZhongsong',
  '华文中宋',
  'FangSong',
  'STFangsong',
  '华文仿宋',
  '仿宋',
  '仿宋_GB2312',
  '方正仿宋简体',
  'XiaoBiaoSong',
  '小标宋',
  '方正小标宋简体',
  'KaiTi',
  'STKaiti',
  '华文楷体',
  '楷体',
  '楷体_GB2312',
]);

/**
 * Chinese families that read as sans -- the Hei (gothic) and rounded faces --
 * plus the display faces (Libian, Shuti, Yaoti, Caiyun, Hupo, Xingkai,
 * Xinwei). No open font imitates a display face; sending them to the sans
 * keeps the text complete and legible, which beats falling through to a
 * partial face and losing glyphs.
 */
const SANS_CJK_FAMILIES = new Set([
  'SimHei',
  '黑体',
  '方正黑体简体',
  'STXihei',
  '华文细黑',
  'Microsoft YaHei',
  '微软雅黑',
  '等线',
  'YouYuan',
  '幼圆',
  'LiSu',
  '隶书',
  'STLiti',
  '华文隶书',
  'FZShuTi',
  '方正舒体',
  'FZYaoTi',
  '方正姚体',
  'STCaiyun',
  '华文彩云',
  'STHupo',
  '华文琥珀',
  'STXingkai',
  '华文行楷',
  'STXinwei',
  '华文新魏',
]);

/**
 * Latin replacements. The first four are metric-compatible by design -- same
 * advance widths, so a document's line and page breaks do not move. The rest
 * have no metric twin; DejaVu is the closest open face with the coverage.
 */
const LATIN_REPLACEMENTS = {
  Arial: 'Liberation Sans',
  'Arial Black': 'Liberation Sans:bold',
  'Andale Mono': 'Liberation Mono',
  Calibri: 'Carlito',
  'Courier New': 'Liberation Mono',
  'Times New Roman': 'Liberation Serif',
  'Comic Sans MS': 'DejaVu Sans',
  Georgia: 'DejaVu Serif',
  Impact: 'DejaVu Sans:bold',
  'Trebuchet MS': 'DejaVu Sans',
  Verdana: 'DejaVu Sans',
  Webdings: 'OpenSymbol',
};

/**
 * Where each script's fallback goes, as [first, last, family]. Ranges outside
 * this table keep whatever `__fonts_ranges` already said -- they were already
 * answered by an open face, and the slot swap above carries them over
 * untouched (Latin and Cyrillic ride Arial's slots into Liberation Sans).
 *
 * Every entry here was measured against the catalog rather than assumed: the
 * script's block was scored across all 193 families and the winner picked.
 * Greek stays on DejaVu Sans, which covers it better than Noto Sans does
 * (94% vs 84% of the block).
 */
const SCRIPT_ROUTES = [
  // CJK: one family for ideographs, kana, hangul, bopomofo and the
  // punctuation and fullwidth forms that used to be split off from them.
  [0x2e80, 0x2fdf, 'Noto Sans CJK SC'], // CJK and Kangxi radicals
  [0x3000, 0x303f, 'Noto Sans CJK SC'], // CJK symbols and punctuation
  [0x3040, 0x30ff, 'Noto Sans CJK SC'], // Hiragana, Katakana
  [0x3100, 0x312f, 'Noto Sans CJK SC'], // Bopomofo
  [0x3130, 0x318f, 'Noto Sans CJK SC'], // Hangul compatibility jamo
  [0x3190, 0x319f, 'Noto Sans CJK SC'], // Kanbun
  [0x31c0, 0x31ff, 'Noto Sans CJK SC'], // CJK strokes, Katakana extensions
  [0x3200, 0x33ff, 'Noto Sans CJK SC'], // Enclosed CJK, CJK compatibility
  [0x3400, 0x4dbf, 'Noto Sans CJK SC'], // CJK extension A
  [0x4e00, 0x9fff, 'Noto Sans CJK SC'], // CJK unified ideographs
  [0xa960, 0xa97f, 'Noto Sans CJK SC'], // Hangul jamo extended-B
  [0xac00, 0xd7af, 'Noto Sans CJK SC'], // Hangul syllables
  [0xf900, 0xfaff, 'Noto Sans CJK SC'], // CJK compatibility ideographs
  [0xfe10, 0xfe1f, 'Noto Sans CJK SC'], // Vertical forms
  [0xfe30, 0xfe4f, 'Noto Sans CJK SC'], // CJK compatibility forms
  [0xff00, 0xffef, 'Noto Sans CJK SC'], // Halfwidth and fullwidth forms
  // Scripts Calibri used to carry on its own.
  [0x0370, 0x03ff, 'DejaVu Sans'], // Greek: 94% of the block, vs 88% for
  // Carlito and Liberation Sans, which is where the Calibri and Arial slots
  // now land. Left on DejaVu rather than moved to Noto Sans, which has 84%.
  [0x0500, 0x052f, 'Noto Sans'], // Cyrillic Supplement
  [0x0530, 0x058f, 'Noto Sans Armenian'],
  [0x0590, 0x05ff, 'Noto Sans Hebrew'],
  [0x0600, 0x06ff, 'Noto Naskh Arabic'],
  [0x0750, 0x077f, 'Noto Naskh Arabic'], // Arabic Supplement
  [0x1e00, 0x1eff, 'Noto Sans'], // Latin Extended Additional (Vietnamese)
  [0x10a0, 0x10ff, 'Noto Sans Georgian'],
  [0xfb50, 0xfdff, 'Noto Naskh Arabic'], // Arabic Presentation Forms-A
  [0xfe70, 0xfeff, 'mry_KacstQurn'], // Arabic Presentation Forms-B
  // Scripts no catalog font covered at all -- these were tofu before.
  [0x0700, 0x074f, 'Noto Sans Syriac'],
  [0x0780, 0x07bf, 'Noto Sans Thaana'],
];

// --- license classification, read from each file's own name table ----------

/** Evidence of an open license in nameID 0 (copyright) / 13 / 14. */
const OPEN_LICENSE =
  /scripts\.sil\.org\/ofl|open font license|ofl 1\.1|apache licen|gnu general public|\bgpl\b|gnu©|ubuntu font licen|public domain|bitstream|arphic|ipafont|nhncorp|navercorp|free software|liberation fonts license|allowed to distribute/i;
/** Families whose open license is well known but not stated in the file. */
const OPEN_FAMILY =
  /^(AR PL|Takao|Nanum|나눔|Droid|Lohit|Noto|OpenSymbol|ASCW|Symbola|DejaVu|Liberation|Carlito|Caladea|Open Sans|Free(Mono|Sans|Serif)|Kacst|mry_Kacst|Samyak|Rekha|padmaa|padmmaa|Pothana|Vemana|Jamrul|Likhan|Abyssinica|Asana|Ubuntu|Mitra|Ani|Khmer OS|Tibetan Machine|Padauk|WenQuanYi)/i;

/** Read nameID -> string from an sfnt buffer. */
function readNames(buf) {
  let off = 0;
  if (buf.readUInt32BE(0) === 0x74746366) off = buf.readUInt32BE(12); // ttcf
  const numTables = buf.readUInt16BE(off + 4);
  let nameOff = null;
  for (let i = 0; i < numTables; i++) {
    const p = off + 12 + i * 16;
    if (buf.toString('latin1', p, p + 4) === 'name') nameOff = buf.readUInt32BE(p + 8);
  }
  if (nameOff === null) return {};
  const count = buf.readUInt16BE(nameOff + 2);
  const strOff = nameOff + buf.readUInt16BE(nameOff + 4);
  const out = {};
  for (let i = 0; i < count; i++) {
    const r = nameOff + 6 + i * 12;
    const platformId = buf.readUInt16BE(r);
    const nameId = buf.readUInt16BE(r + 6);
    const len = buf.readUInt16BE(r + 8);
    const o = buf.readUInt16BE(r + 10);
    try {
      const raw = buf.subarray(strOff + o, strOff + o + len);
      const s = platformId === 1 ? raw.toString('latin1') : Buffer.from(raw).swap16().toString('utf16le');
      if (out[nameId] === undefined || platformId === 3) out[nameId] = s;
    } catch {
      // A malformed record is not a reason to misclassify the whole file.
    }
  }
  return out;
}

function isProprietary(slot) {
  const file = path.join(CATALOG_DIR, slot);
  if (!fs.existsSync(file)) return false;
  const names = readNames(xorPrefix(fs.readFileSync(file)));
  const evidence = `${names[0] ?? ''} ${names[13] ?? ''} ${names[14] ?? ''}`;
  if (OPEN_LICENSE.test(evidence)) return false;
  return !OPEN_FAMILY.test(names[1] ?? '');
}

// --- registry parsing ------------------------------------------------------

const source = fs.readFileSync(ALL_FONTS, 'utf8');
function locate(key) {
  const marker = `window["${key}"] = [`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`${key} not found in AllFonts.js`);
  const bodyStart = start + marker.length;
  return { bodyStart, bodyEnd: source.indexOf('];', bodyStart) };
}
const at = { files: locate('__fonts_files'), infos: locate('__fonts_infos'), ranges: locate('__fonts_ranges') };
const files = JSON.parse(`[${source.slice(at.files.bodyStart, at.files.bodyEnd)}]`);
const infos = JSON.parse(`[${source.slice(at.infos.bodyStart, at.infos.bodyEnd).replace(/\n/g, '')}]`);
const flatRanges = JSON.parse(`[${source.slice(at.ranges.bodyStart, at.ranges.bodyEnd)}]`);

const proprietary = new Set(files.filter(isProprietary));
const bytesOf = (slot) => fs.statSync(path.join(CATALOG_DIR, slot)).size;

// --- plan the face swaps ---------------------------------------------------

/** face name -> index into an __fonts_infos row */
const FACE_SLOT = { reg: 1, ital: 3, bold: 5, bi: 7 };
const rowOf = (family) => infos.findIndex((row) => row[0] === family);

/** Slots the added faces will occupy, assigned from the end of the catalog. */
const nextSlot = (() => {
  let n = Math.max(...files.map(Number).filter(Number.isFinite));
  return () => String(++n).padStart(3, '0');
})();
const added = ADDED_FAMILIES.map(({ family, faces }) => ({
  family,
  faces: faces.map((sourceName) => (sourceName ? { sourceName, slot: nextSlot() } : null)),
}));
const addedSlot = (family, face) => {
  const entry = added.find((a) => a.family === family);
  const pick = face === 'bold' || face === 'bi' ? (entry.faces[1] ?? entry.faces[0]) : entry.faces[0];
  return pick.slot;
};

/** Resolve "Liberation Sans" / "DejaVu Sans:bold" to an existing catalog file. */
function latinFace(spec, face) {
  const [family, forced] = spec.split(':');
  const row = infos[rowOf(family)];
  if (!row) throw new Error(`replacement family not in catalog: ${family}`);
  const want = forced ?? face;
  const pos = row[FACE_SLOT[want]] >= 0 ? row[FACE_SLOT[want]] : row[FACE_SLOT.reg];
  return files[pos];
}

const swaps = [];
for (const row of infos) {
  const family = row[0];
  for (const [face, idx] of Object.entries(FACE_SLOT)) {
    const pos = row[idx];
    if (pos < 0 || !proprietary.has(files[pos])) continue;
    let to;
    if (SERIF_CJK_FAMILIES.has(family)) to = addedSlot('Noto Serif CJK SC', face);
    else if (SANS_CJK_FAMILIES.has(family)) to = addedSlot('Noto Sans CJK SC', face);
    else if (LATIN_REPLACEMENTS[family]) to = latinFace(LATIN_REPLACEMENTS[family], face);
    else throw new Error(`no replacement mapped for proprietary family "${family}" (${face})`);
    swaps.push({ pos, from: files[pos], to, family, face });
  }
}

const covered = new Set(swaps.map((s) => s.from));
const uncovered = [...proprietary].filter((f) => !covered.has(f));
if (uncovered.length) {
  throw new Error(`proprietary files no __fonts_infos row points at: ${uncovered.join(', ')}`);
}

// --- report ----------------------------------------------------------------

const totalMb = (list) => (list.reduce((sum, f) => sum + bytesOf(f), 0) / 1048576).toFixed(1);
console.log(`catalog: ${files.length} slots, ${infos.length} families, ${flatRanges.length / 3} fallback ranges`);
console.log(`proprietary faces: ${proprietary.size} files, ${totalMb([...proprietary])} MB`);
console.log(`swaps planned: ${swaps.length} across ${new Set(swaps.map((s) => s.family)).size} families`);
if (CHECK_ONLY) {
  for (const s of swaps) console.log(`  ${s.family.padEnd(22)} ${s.face.padEnd(5)} ${s.from} -> ${s.to}`);
  process.exit(0);
}

// --- apply -----------------------------------------------------------------

for (const { family, faces } of added) {
  for (const face of faces) {
    if (!face) continue;
    const from = path.join(SOURCE_DIR, face.sourceName);
    if (!fs.existsSync(from)) throw new Error(`missing source face: ${from} (see docs/fonts.md)`);
    fs.writeFileSync(path.join(CATALOG_DIR, face.slot), xorPrefix(fs.readFileSync(from)));
    console.log(`encoded ${face.sourceName} -> public/fonts/${face.slot}  (${family})`);
  }
}

for (const s of swaps) files[s.pos] = s.to;
for (const { family, faces } of added) {
  const positions = faces.map((face) => (face ? files.push(face.slot) - 1 : -1));
  infos.push([family, positions[0], 0, -1, -1, positions[1], 0, -1, -1]);
}

/**
 * Rewrite the fallback table. `__fonts_ranges` is a flat run of
 * [first, last, familyRow] triples, and a run can straddle a script boundary,
 * so a route is applied by *splitting* the runs it overlaps rather than
 * overwriting them whole -- otherwise routing Hebrew would drag its
 * neighbours along with it.
 */
let runs = [];
for (let i = 0; i < flatRanges.length; i += 3) {
  runs.push({ first: flatRanges[i], last: flatRanges[i + 1], row: flatRanges[i + 2] });
}
for (const [first, last, family] of SCRIPT_ROUTES) {
  const row = rowOf(family);
  if (row < 0) throw new Error(`route target not in catalog: ${family}`);
  const next = [];
  for (const run of runs) {
    if (run.last < first || run.first > last) {
      next.push(run);
      continue;
    }
    if (run.first < first) next.push({ first: run.first, last: first - 1, row: run.row });
    if (run.last > last) next.push({ first: last + 1, last: run.last, row: run.row });
  }
  next.push({ first, last, row });
  runs = next;
}
runs.sort((a, b) => a.first - b.first);
// Merge neighbours that ended up pointing at the same family.
const merged = [];
for (const run of runs) {
  const prev = merged.at(-1);
  if (prev && prev.row === run.row && prev.last + 1 === run.first) prev.last = run.last;
  else merged.push(run);
}
const rerouted = merged.length - flatRanges.length / 3;

const rendered = {
  files: `\n${files.map((f) => `"${f}"`).join(',\n')}\n`,
  infos: `\n${infos.map((r) => JSON.stringify(r)).join(',\n')}\n`,
  ranges: `\n${merged.flatMap((r) => [r.first, r.last, r.row]).join(',')}\n`,
};
let out = source;
for (const key of ['ranges', 'infos', 'files']) {
  // Replace back-to-front so the earlier offsets stay valid.
  out = out.slice(0, at[key].bodyStart) + rendered[key] + out.slice(at[key].bodyEnd);
}
fs.writeFileSync(ALL_FONTS, out);
console.log(
  `rewrote AllFonts.js: ${swaps.length} slot swaps, ${added.length} families added, ` +
    `${merged.length} fallback ranges (${rerouted >= 0 ? '+' : ''}${rerouted})`,
);

let freed = 0;
for (const slot of proprietary) {
  freed += bytesOf(slot);
  fs.unlinkSync(path.join(CATALOG_DIR, slot));
}
console.log(`removed ${proprietary.size} proprietary faces, ${(freed / 1048576).toFixed(1)} MB`);
