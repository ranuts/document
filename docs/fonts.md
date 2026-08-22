# Font Management

The v9 vendor uses an **indexed font catalog**: the editor does not load fonts
by file name, it loads them by numeric index through the registries declared
in `public/sdkjs/common/AllFonts.js`.

## How the catalog works

Three registries in `AllFonts.js` drive everything:

- `__fonts_files` — an array of file names (e.g. `"062"`). The editor fetches
  `public/fonts/<name>` when a font at that **array position** is requested.
  Note: the array is not identity-ordered; position 75 may hold the string
  `"062"`. Slot names also get _reused_: bin/font-license-sweep.mjs replaces a
  proprietary face by overwriting its slot with the replacement's name, so the
  same position can point somewhere new after a sweep.
- `__fonts_infos` — one row per font family:
  `[family, regularPos, regularFace, italicPos, italicFace, boldPos, boldFace,
boldItalicPos, boldItalicFace]`, where each `Pos` is a **position in
  `__fonts_files`** and `-1` means that face is missing. Multiple rows may
  point at the same file — that is how aliases work.
- `__fonts_ranges` — unicode-range hints for fallback picking.

To find the file for a family: locate its row in `__fonts_infos`, take the
face position, then read `__fonts_files[position]`. Example (current vendor):
`["Arial",75,0,79,0,77,0,78,0]` → `__fonts_files[75]` → the regular face lives
at `public/fonts/<that name>`. Do not memorise the number: the slot behind
"Arial" changed when bin/font-license-sweep.mjs swapped the proprietary faces
out, and it will change again on a vendor bump. Read it from the file.

## The wire format (files are not plain TTFs)

Every file under `public/fonts/` is a raw TTF/OTF whose **first 32 bytes are
XOR-obfuscated with a fixed 16-byte key**. Dropping a plain TTF into
`public/fonts/` will NOT work — the editor decodes the prefix on load and
would corrupt a plain file's header.

Use the repo script to convert both ways (the transform is symmetric):

```bash
# raw TTF -> catalog wire format (pick a name past the current highest)
node bin/font-catalog.mjs encode MyFont.ttf public/fonts/282

# catalog file -> raw TTF (inspection)
node bin/font-catalog.mjs decode public/fonts/062 /tmp/liberation-sans.ttf

# sanity-check an existing catalog file
node bin/font-catalog.mjs verify public/fonts/000
```

## Adding a font

1. Encode the TTF: `node bin/font-catalog.mjs encode MyFont.ttf
public/fonts/<new-name>` (pick an unused file name; by convention a
   zero-padded number).
2. In `AllFonts.js`, append `"<new-name>"` to `__fonts_files` and note its
   array position `P`.
3. Add one `__fonts_infos` row per name documents may reference:
   `["My Font", P, 0, -1, -1, -1, -1, -1, -1]`. Add extra alias rows (for
   example a localized display name) pointing at the same `P` so documents
   using either name resolve to the file.

## Script fallback (`__fonts_ranges`)

When a document names a font that has no glyph for some character, the editor
picks the family `__fonts_ranges` assigns to that code point. Each triple is
`[first, last, familyRow]`, where `familyRow` is an index into
**`__fonts_infos`** — not into `__fonts_files`. Getting that wrong is easy and
silent: the arrays are similar lengths, so a mistaken lookup still resolves to
_a_ font.

The table the vendor shipped answered CJK from whatever face happened to cover
each block, so one line of Chinese was set in four typefaces at four stroke
weights:

| code point            | vendor default      | now              |
| --------------------- | ------------------- | ---------------- |
| `一` U+4E00 ideograph | Droid Sans Fallback | Noto Sans CJK SC |
| `。` U+3002 full stop | Microsoft YaHei     | Noto Sans CJK SC |
| `，` U+FF0C fullwidth | SimSun              | Noto Sans CJK SC |
| `あ` U+3042 hiragana  | SimSun              | Noto Sans CJK SC |
| `가` U+AC00 hangul    | NanumGothic         | Noto Sans CJK SC |

Every CJK block now resolves to one family, which also gives CJK a real bold
(Droid Sans Fallback has no bold face at all — it was being synthesised).

The same table is why removing Calibri needed care: it was the _only_ face
covering Arabic, Armenian, Georgian, Hebrew and Cyrillic Supplement, and its
metric-compatible replacement Carlito has none of them. Those blocks are
routed explicitly, as are Syriac and Thaana, which no catalog font covered at
all. See `SCRIPT_ROUTES` in `bin/font-license-sweep.mjs`.

**If you add or replace a face, re-measure rather than assume.** Every route
in that table was picked by scoring the script's block against all families in
the catalog; Greek stayed on DejaVu Sans because it covers 94% of the block
where Noto Sans covers 84%.

## PDF export fonts (x2t path)

`packages/converter` writes fonts into the x2t WASM FS (`/working/fonts/`)
before PDF conversion; without them PDF text renders blank. It reuses the
same indexed catalog files: `PDF_FONT_MANIFEST` in
`packages/converter/src/document-converter.ts` maps catalog indexes to the
alias file names x2t matches. Latin families stay on latin faces — aliasing
them onto the CJK fallback garbles latin text — and the CJK entries carry both
the western and the zh display names. The bytes are XOR-decoded with the same
key before being written.

This list is **hand-maintained and references slots by number**, so it goes
stale the moment slots move. It already did once: after the license sweep it
still named 017 (SimSun) and 016 (Microsoft YaHei), which no longer existed,
and every CJK glyph in an exported PDF would have come out blank.
`test/unit/font-catalog-licensing.test.ts` now fails if any entry names a slot
that is not on disk.

## Licensing

**Only faces that may be redistributed belong in `public/fonts/`.** This
repository and its origin are public, so shipping a font is redistributing it.

The vendor bundle did not arrive that way. It carried the font set an
OnlyOffice Docs _server_ would have picked up from its host: Microsoft's core
web fonts, Monotype's Arial/Times/Courier, and ~150 MB of Chinese faces owned
by SinoType, Founder, ZhongYi, GreatWall and Stone — 79 files, 171 MB in all.
`bin/font-license-sweep.mjs` replaced them, and
`test/unit/font-catalog-licensing.test.ts` reads every file's own name table
(nameID 0/13/14) on each run, so a vendor bump that reintroduces one turns the
suite red before it ships.

### How the replacement works

`__fonts_files` is positional, so a proprietary file is **not** removed from
the array — its slot is overwritten with the name of the replacement. A
document that names "SimSun" or "Arial" still resolves; it lands on the open
face. The family names stay in `__fonts_infos` (and in
`g_fonts_selection_bin`, which is left alone — it is the undocumented binary
behind the font picker and its metrics) precisely so they keep answering.

Latin replacements are metric-compatible where one exists, so line and page
breaks do not move:

| named in documents                                   | ships as          |
| ---------------------------------------------------- | ----------------- |
| Arial, Arial Black                                   | Liberation Sans   |
| Times New Roman                                      | Liberation Serif  |
| Courier New, Andale Mono                             | Liberation Mono   |
| Calibri                                              | Carlito           |
| Georgia                                              | DejaVu Serif      |
| Verdana, Trebuchet, Comic Sans, Impact               | DejaVu Sans       |
| Webdings                                             | OpenSymbol        |
| Song/Ming, Fangsong, Kai                             | Noto Serif CJK SC |
| Hei, YaHei, DengXian, YouYuan, and the display faces | Noto Sans CJK SC  |

Chinese serif families get the serif face rather than being flattened into a
sans: Song is what a Chinese document's body text is normally set in. The
display faces (Libian, Shuti, Yaoti, Caiyun, Hupo, Xingkai, Xinwei) have no
open imitation, so they go to the sans — complete and legible beats falling
through to a partial face and losing glyphs.

### Faces added by the sweep

Sources are **not committed** — they would be a second copy of bytes the
catalog already holds. Fetch them into `vendor-fonts/` (gitignored) before
running the script:

| file                                                                                    | from                                                             |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `NotoSansCJKsc-{Regular,Bold}.otf`                                                      | notofonts/noto-cjk release `Sans2.004`, `08_NotoSansCJKsc.zip`   |
| `NotoSerifCJKsc-{Regular,Bold}.otf`                                                     | notofonts/noto-cjk release `Serif2.003`, `09_NotoSerifCJKsc.zip` |
| `NotoSans-{Regular,Bold}.ttf`, `NotoSans{Hebrew,Armenian,Georgian,Thaana,Syriac}-*.ttf` | notofonts/notofonts.github.io, `fonts/<Family>/hinted/ttf/`      |

All are SIL OFL 1.1. The CJK pair is the _language-specific_ build: one file
per weight carrying Simplified Chinese, Traditional Chinese, Japanese and
Korean, so a Japanese or Korean document falls back to the same family a
Chinese one does. Note the catalog only accepts single-face sfnt files —
`bin/font-catalog.mjs` rejects `ttcf`, so the Super OTC collections cannot be
dropped in as-is.

Then:

```bash
node bin/font-license-sweep.mjs --check   # report, touch nothing
node bin/font-license-sweep.mjs           # apply
```
