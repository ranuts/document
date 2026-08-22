#!/usr/bin/env node
/**
 * Replace every proprietary face in the vendor font catalog with an open one,
 * and give each script a single family to fall back to.
 *
 * Why this exists
 * ---------------
 * The vendor's offline bundle ships the font set an OnlyOffice Docs *server*
 * would have picked up from its host: Microsoft's core web fonts, Monotype's
 * Arial/Times/Courier, and ~150 MB of Chinese faces owned by SinoType,
 * Founder, ZhongYi and others. Redistributing those from a public repository
 * and a public origin is not something their licenses allow.
 *
 * The one rule this file exists to respect
 * ----------------------------------------
 * The catalog has three parallel structures. `__fonts_files` is a positional
 * array of file names; `__fonts_infos` rows reference faces by *position* in
 * it; `g_fonts_selection_bin` carries the metrics the matcher scores names
 * against. The engine ties them together by the font's OWN family name: when
 * it shapes a run it reads `m_pFaceInfo.family_name` off the loaded face and
 * resolves *that* through the matcher (sdk-all.js, `StringShaper.Shape`). So
 * the invariant every referenced position must satisfy is:
 *
 *   the family name inside the file at position P must belong to a row that
 *   points at P.
 *
 * The pristine vendor catalog satisfies it for all 267 positions. Break it --
 * by writing a replacement's *file name* into a proprietary slot, which is
 * what the first attempt at this sweep did (PR #170) -- and the engine shapes
 * with one face and rasterises with another: every glyph comes out shifted,
 * `Hello` renders as `Ebiil`. Honour it and substitution just works.
 *
 * So this script never copies file names between positions. It re-points the
 * proprietary family's row at the position the replacement already occupies
 * (Arial's regular face becomes Liberation Sans's position, not a copy of
 * Liberation Sans's bytes under Arial's file name). One file, one position,
 * one download, and the name inside the file still belongs to a row that
 * points there.
 *
 * Nothing is removed from `g_fonts_selection_bin` -- the records it carries for
 * the faces being deleted are the metrics existing documents were laid out
 * against, and every one of those names still resolves, to an open file now.
 * Faces this sweep *adds* do get a record appended (see bin/lib/selection-bin.mjs):
 * a family the matcher cannot find by name is a family the shaper resolves to
 * something else, which is the same shifted-glyph failure by another route.
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
import { readNames, xorPrefix } from './lib/sfnt.mjs';
import { decode, encode, buildRecord } from './lib/selection-bin.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_DIR = path.join(ROOT, 'public/fonts');
const SOURCE_DIR = path.join(ROOT, 'vendor-fonts');
const ALL_FONTS = path.join(ROOT, 'public/sdkjs/common/AllFonts.js');
const CHECK_ONLY = process.argv.includes('--check');

/**
 * Faces this sweep adds, as `family: [regular, bold]` source file names in
 * vendor-fonts/. The family name is the one inside the file -- nothing is
 * renamed, so the OFL's reserved-name clause and the trademarks on the names
 * being replaced are both left alone.
 *
 * The CJK faces are Noto Sans/Serif SC, instanced from the variable fonts at
 * weight 400 and 700 and then subset (the exact invocations are in
 * docs/fonts.md). Two properties of that pipeline are not optional:
 *
 *   - **TrueType outlines, not CFF.** The pan-CJK OTFs (Noto Sans CJK SC and
 *     friends) render fine in the editor but export to PDF as *nothing*: x2t
 *     embeds no glyphs for them and the Chinese comes out blank while the
 *     Latin survives. Measured, both ways round, on the same document.
 *   - **Subset.** The full faces are 16 and 24 MB and every Chinese document
 *     would pay for them.
 *
 * The two subsets are cut differently on purpose:
 *
 *   sans  -- the whole CJK repertoire (unified, extension A, compatibility,
 *            kana, bopomofo, fullwidth), 9.9 MB. Every CJK fallback range
 *            points here, and a fallback face with holes in it renders blanks:
 *            the picker consults the range table once and does not look
 *            further.
 *   serif -- GB2312 plus the punctuation and kana, 3.6 MB. It backs the Song /
 *            Fangsong / Kai families a document names explicitly, which is
 *            everyday Chinese; the rare characters it lacks fall through to
 *            the sans above rather than to nothing.
 */
const ADDED_FAMILIES = [
  { family: 'Noto Sans SC', faces: ['NotoSansSC-Regular-cjk.ttf', 'NotoSansSC-Bold-cjk.ttf'] },
  { family: 'Noto Serif SC', faces: ['NotoSerifSC-Regular-gb.ttf', 'NotoSerifSC-Bold-gb.ttf'] },
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
 * this table keep whatever `__fonts_ranges` already said.
 *
 * Every entry was measured against the catalog rather than assumed: the
 * script's block was scored across all families and the winner picked. Greek
 * stays on DejaVu Sans, which covers it better than Noto Sans does (94% vs
 * 84% of the block).
 */
const SCRIPT_ROUTES = [
  // CJK: one family for ideographs, kana, hangul, bopomofo and the
  // punctuation and fullwidth forms that used to be split off from them.
  [0x2e80, 0x2fdf, 'Noto Sans SC'], // CJK and Kangxi radicals
  [0x3000, 0x303f, 'Noto Sans SC'], // CJK symbols and punctuation
  [0x3040, 0x30ff, 'Noto Sans SC'], // Hiragana, Katakana
  [0x3100, 0x312f, 'Noto Sans SC'], // Bopomofo
  [0x3190, 0x319f, 'Noto Sans SC'], // Kanbun
  [0x31c0, 0x31ff, 'Noto Sans SC'], // CJK strokes, Katakana extensions
  [0x3200, 0x33ff, 'Noto Sans SC'], // Enclosed CJK, CJK compatibility
  [0x3400, 0x4dbf, 'Noto Sans SC'], // CJK extension A
  [0x4e00, 0x9fff, 'Noto Sans SC'], // CJK unified ideographs
  [0xf900, 0xfaff, 'Noto Sans SC'], // CJK compatibility ideographs
  [0xfe10, 0xfe1f, 'Noto Sans SC'], // Vertical forms
  [0xfe30, 0xfe4f, 'Noto Sans SC'], // CJK compatibility forms
  [0xff00, 0xffef, 'Noto Sans SC'], // Halfwidth and fullwidth forms
  // Korean is deliberately absent: the sans subset above is cut to the Chinese
  // and Japanese repertoire, and hangul syllables alone are 11k glyphs. The
  // catalog's NanumGothic (OFL) already answers both jamo and syllables, which
  // is what the untouched ranges leave them pointing at.
  //
  // Scripts Calibri used to carry on its own.
  [0x0370, 0x03ff, 'DejaVu Sans'], // Greek: 94% of the block, against 88% for
  // Liberation Sans, which is where Arial's slots now land and where the
  // vendor's table used to send it.
  [0x0500, 0x052f, 'Noto Sans'], // Cyrillic Supplement
  [0x0530, 0x058f, 'Noto Sans Armenian'],
  [0x0590, 0x05ff, 'Noto Sans Hebrew'],
  [0x0600, 0x06ff, 'Noto Naskh Arabic'],
  [0x0750, 0x077f, 'Noto Naskh Arabic'], // Arabic Supplement
  [0x1e00, 0x1eff, 'Noto Sans'], // Latin Extended Additional (Vietnamese)
  [0x10a0, 0x10ff, 'Noto Sans Georgian'],
  [0xfb50, 0xfdff, 'Noto Naskh Arabic'], // Arabic Presentation Forms-A
  // Scripts no catalog font covered at all -- these were tofu before.
  [0x0700, 0x074f, 'Noto Sans Syriac'],
  [0x0780, 0x07bf, 'Noto Sans Thaana'],
];

const namesOfSlot = new Map();
const slotNames = (slot) => {
  if (!namesOfSlot.has(slot)) {
    const file = path.join(CATALOG_DIR, slot);
    namesOfSlot.set(slot, fs.existsSync(file) ? readNames(xorPrefix(fs.readFileSync(file))) : {});
  }
  return namesOfSlot.get(slot);
};

// --- license classification, read from each file's own name table ----------

/** Evidence of an open license in nameID 0 (copyright) / 13 / 14. */
const OPEN_LICENSE =
  /scripts\.sil\.org\/ofl|open font license|ofl 1\.1|apache licen|gnu general public|\bgpl\b|gnu©|ubuntu font licen|public domain|bitstream|arphic|ipafont|nhncorp|navercorp|free software|liberation fonts license|allowed to distribute/i;
/** Families whose open license is well known but not stated in the file. */
const OPEN_FAMILY =
  /^(AR PL|Takao|Nanum|나눔|Droid|Lohit|Noto|OpenSymbol|ASCW|Symbola|DejaVu|Liberation|Carlito|Caladea|Open Sans|Free(Mono|Sans|Serif)|Kacst|mry_Kacst|Samyak|Rekha|padmaa|padmmaa|Pothana|Vemana|Jamrul|Likhan|Abyssinica|Asana|Ubuntu|Mitra|Ani|Khmer OS|Tibetan Machine|Padauk|WenQuanYi)/i;

function isProprietary(slot) {
  const names = slotNames(slot);
  if (!names[1] && !names[0]) return false;
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
const selectionAt = (() => {
  const marker = 'window["g_fonts_selection_bin"] = "';
  const start = source.indexOf(marker) + marker.length;
  return { start, end: source.indexOf('"', start) };
})();
const selectionBase64 = source.slice(selectionAt.start, selectionAt.end);

const proprietary = new Set(files.filter((slot) => fs.existsSync(path.join(CATALOG_DIR, slot)) && isProprietary(slot)));
const bytesOf = (slot) => fs.statSync(path.join(CATALOG_DIR, slot)).size;

// --- plan the face swaps ---------------------------------------------------

/** face name -> index into an __fonts_infos row */
const FACE_SLOT = { reg: 1, ital: 3, bold: 5, bi: 7 };
const rowOf = (family) => infos.findIndex((row) => row[0] === family);

/** Positions the added faces will occupy, appended after the existing ones. */
const nextSlot = (() => {
  let n = Math.max(...files.map(Number).filter(Number.isFinite));
  return () => String(++n).padStart(3, '0');
})();
// Re-running the sweep must not append a second copy of a family that is
// already there: after the first pass there is nothing proprietary left to
// swap, but the families would still be added.
const toAdd = ADDED_FAMILIES.filter(({ family }) => !infos.some((row) => row[0] === family));
if (!toAdd.length && !proprietary.size) {
  console.log('catalog is already swept: no proprietary faces, no families to add');
  process.exit(0);
}

const added = toAdd.map(({ family, faces }) => ({
  family,
  faces: faces.map((sourceName) => (sourceName ? { sourceName, slot: nextSlot(), position: -1 } : null)),
}));

// Positions are assigned before the swaps are planned so a swap can point at
// a face this run is adding.
for (const entry of added) {
  for (const face of entry.faces) if (face) face.position = files.push(face.slot) - 1;
  const [reg, bold] = entry.faces;
  entry.row = infos.push([entry.family, reg.position, 0, -1, -1, (bold ?? reg).position, 0, -1, -1]) - 1;
  // Some upstream builds ship a bold whose nameID 1 is "<family> Bold" rather
  // than the RIBBI "<family>" + subfamily "Bold" (Noto Sans Georgian Bold is
  // one). The engine resolves the name *inside* the file, so that face needs
  // a row of its own carrying that name -- otherwise bold text shapes against
  // whatever the matcher falls back to. This is a registry row, not a file
  // edit: the font itself is shipped exactly as upstream published it.
  for (const face of entry.faces) {
    if (!face) continue;
    const inside = readNames(fs.readFileSync(path.join(SOURCE_DIR, face.sourceName)))[1];
    if (inside && inside !== entry.family) {
      infos.push([inside, face.position, 0, -1, -1, -1, -1, -1, -1]);
    }
  }
}

/** Resolve "Liberation Sans" / "DejaVu Sans:bold" to [position, faceIndex]. */
function replacementFace(spec, face) {
  const [family, forced] = spec.split(':');
  const row = infos[rowOf(family)];
  if (!row) throw new Error(`replacement family not in catalog: ${family}`);
  const want = forced ?? face;
  const slot = row[FACE_SLOT[want]] >= 0 ? FACE_SLOT[want] : FACE_SLOT.reg;
  return [row[slot], row[slot + 1]];
}

const swaps = [];
for (const row of infos) {
  const family = row[0];
  for (const [face, idx] of Object.entries(FACE_SLOT)) {
    const pos = row[idx];
    if (pos < 0 || !proprietary.has(files[pos])) continue;
    let target;
    if (SERIF_CJK_FAMILIES.has(family)) target = replacementFace('Noto Serif SC', face);
    else if (SANS_CJK_FAMILIES.has(family)) target = replacementFace('Noto Sans SC', face);
    else if (LATIN_REPLACEMENTS[family]) target = replacementFace(LATIN_REPLACEMENTS[family], face);
    else throw new Error(`no replacement mapped for proprietary family "${family}" (${face})`);
    swaps.push({ row, idx, face, family, from: files[pos], fromPos: pos, to: target });
  }
}

/**
 * Give the Chinese families a real bold. Every one of them ships regular-only
 * in this catalog, so bold Chinese has always been the renderer smearing the
 * regular face; the Noto CJK pair has a drawn bold and it costs nothing to
 * point at it. Only families this sweep is already re-pointing are touched.
 */
const boldAdditions = [];
for (const s of swaps) {
  if (s.face !== 'reg' || s.row[FACE_SLOT.bold] >= 0) continue;
  const isSerif = SERIF_CJK_FAMILIES.has(s.family);
  if (!isSerif && !SANS_CJK_FAMILIES.has(s.family)) continue;
  const [position, faceIndex] = replacementFace(isSerif ? 'Noto Serif SC' : 'Noto Sans SC', 'bold');
  boldAdditions.push({ row: s.row, idx: FACE_SLOT.bold, family: s.family, to: [position, faceIndex] });
}

// --- report ----------------------------------------------------------------

const totalMb = (list) => (list.reduce((sum, f) => sum + bytesOf(f), 0) / 1048576).toFixed(1);
const addedMb = (
  added
    .flatMap((a) => a.faces)
    .filter(Boolean)
    .reduce(
      (sum, f) =>
        sum +
        (fs.existsSync(path.join(SOURCE_DIR, f.sourceName))
          ? fs.statSync(path.join(SOURCE_DIR, f.sourceName)).size
          : 0),
      0,
    ) / 1048576
).toFixed(1);
console.log(`catalog: ${files.length} positions, ${infos.length} families, ${flatRanges.length / 3} fallback ranges`);
console.log(`proprietary faces: ${proprietary.size} files, ${totalMb([...proprietary])} MB`);
console.log(`replacements added: ${added.length} families, ${addedMb} MB`);
console.log(`swaps planned: ${swaps.length} faces across ${new Set(swaps.map((s) => s.family)).size} families`);
console.log(`bold faces gained: ${boldAdditions.length} Chinese families that shipped regular-only`);
if (CHECK_ONLY) {
  for (const s of swaps) {
    console.log(`  ${s.family.padEnd(22)} ${s.face.padEnd(5)} ${s.from} -> position ${s.to[0]} (${files[s.to[0]]})`);
  }
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

for (const s of [...swaps, ...boldAdditions]) {
  s.row[s.idx] = s.to[0];
  s.row[s.idx + 1] = s.to[1];
}

/**
 * Rewrite the fallback table. `__fonts_ranges` is a flat run of
 * [first, last, familyRow] triples -- the third number indexes
 * `__fonts_infos` directly (both consumers, sdkjs and the PDF engine, do
 * `infos[triple[2]][0]`). A run can straddle a script boundary, so a route is
 * applied by *splitting* the runs it overlaps rather than overwriting them
 * whole -- otherwise routing Hebrew would drag its neighbours along with it.
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

// --- the invariant, checked before anything is written ---------------------

const removed = new Set(proprietary);
for (const [position, slot] of files.entries()) {
  const referencedBy = infos.filter((row) => [1, 3, 5, 7].some((i) => row[i] === position));
  if (!referencedBy.length) continue;
  if (removed.has(slot)) throw new Error(`position ${position} (${slot}) is still referenced but is being deleted`);
  const inside = slotNames(slot)[1] ?? readNames(xorPrefix(fs.readFileSync(path.join(SOURCE_DIR, sourceOf(slot)))))[1];
  if (!referencedBy.some((row) => row[0] === inside)) {
    throw new Error(
      `position ${position} (${slot}) holds "${inside}" but no row pointing at it carries that name ` +
        `(rows: ${referencedBy.map((r) => r[0]).join(', ')}). The engine would shape with one face and ` +
        `rasterise with another.`,
    );
  }
}
function sourceOf(slot) {
  const face = added.flatMap((a) => a.faces).find((f) => f && f.slot === slot);
  if (!face) throw new Error(`unknown slot ${slot}`);
  return face.sourceName;
}

/**
 * Give the added faces a record in `g_fonts_selection_bin`. A family that has
 * no record there cannot be matched by name: the shaper reads the family name
 * off the loaded face, asks the matcher for it, gets whatever the penalty
 * function likes instead, and shapes against a different font than it draws
 * with. Latin substitution survives without this (the replacements already had
 * records of their own); the added CJK faces do not -- that is exactly how the
 * first run of this rewrite still came out garbled.
 *
 * Nothing is removed. The records of the faces this sweep deletes describe the
 * metrics documents were laid out against, and every one of those names still
 * resolves -- to an open file now.
 */
const selection = decode(selectionBase64);
for (const { faces } of added) {
  for (const face of faces) {
    if (!face) continue;
    const buf = fs.readFileSync(path.join(SOURCE_DIR, face.sourceName));
    selection.records.push(buildRecord(buf, { path: `/usr/share/fonts/fonts/${face.sourceName}` }));
  }
}

const rendered = {
  files: `\n${files.map((f) => `"${f}"`).join(',\n')}\n`,
  infos: `\n${infos.map((r) => JSON.stringify(r)).join(',\n')}\n`,
  ranges: `\n${merged.flatMap((r) => [r.first, r.last, r.row]).join(',')}\n`,
};
// Replace back-to-front so the earlier offsets stay valid: the selection blob
// sits after the three arrays.
let out = source.slice(0, selectionAt.start) + encode(selection) + source.slice(selectionAt.end);
for (const key of ['ranges', 'infos', 'files']) {
  out = out.slice(0, at[key].bodyStart) + rendered[key] + out.slice(at[key].bodyEnd);
}
fs.writeFileSync(ALL_FONTS, out);
console.log(
  `rewrote AllFonts.js: ${swaps.length} faces re-pointed, ${added.length} families added, ` +
    `${merged.length} fallback ranges (${rerouted >= 0 ? '+' : ''}${rerouted}), ` +
    `${selection.records.length} selection records (+${selection.records.length - decode(selectionBase64).records.length})`,
);

let freed = 0;
for (const slot of proprietary) {
  freed += bytesOf(slot);
  fs.unlinkSync(path.join(CATALOG_DIR, slot));
}
console.log(`removed ${proprietary.size} proprietary faces, ${(freed / 1048576).toFixed(1)} MB`);
