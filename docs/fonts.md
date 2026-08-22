# Font Management

The v9 vendor uses an **indexed font catalog**: the editor does not load fonts
by file name, it loads them by numeric index through the registries declared
in `public/sdkjs/common/AllFonts.js`.

## How the catalog works

Three registries in `AllFonts.js` drive everything:

- `__fonts_files` — an array of file names (e.g. `"072"`). The editor fetches
  `public/fonts/<name>` when a font at that **array position** is requested.
  Note: the array is not identity-ordered; position 75 may hold the string
  `"072"`.
- `__fonts_infos` — one row per font family:
  `[family, regularPos, regularFace, italicPos, italicFace, boldPos, boldFace,
boldItalicPos, boldItalicFace]`, where each `Pos` is a **position in
  `__fonts_files`** and `-1` means that face is missing. Multiple rows may
  point at the same file — that is how aliases work.
- `__fonts_ranges` — unicode-range hints for fallback picking.

To find the file for a family: locate its row in `__fonts_infos`, take the
face position, then read `__fonts_files[position]`. Example (current vendor):
`["Arial",75,0,79,0,77,0,78,0]` → `__fonts_files[75]` = `"072"` → the regular
face lives at `public/fonts/072`.

## The wire format (files are not plain TTFs)

Every file under `public/fonts/` is a raw TTF/OTF whose **first 32 bytes are
XOR-obfuscated with a fixed 16-byte key**. Dropping a plain TTF into
`public/fonts/` will NOT work — the editor decodes the prefix on load and
would corrupt a plain file's header.

Use the repo script to convert both ways (the transform is symmetric):

```bash
# raw TTF -> catalog wire format
node bin/font-catalog.mjs encode MyFont.ttf public/fonts/267

# catalog file -> raw TTF (inspection)
node bin/font-catalog.mjs decode public/fonts/072 /tmp/arial.ttf

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

## PDF export fonts (x2t path)

`packages/converter` writes fonts into the x2t WASM FS (`/working/fonts/`)
before PDF conversion; without them PDF text renders blank. It reuses the
same indexed catalog files: `PDF_FONT_MANIFEST` in
`packages/converter/src/document-converter.ts` maps catalog indexes to the
alias file names x2t matches (Arial and other western families stay on their
own files — aliasing them onto the CJK fallback garbles latin text; SimSun /
Microsoft YaHei carry their zh display names as extra aliases). The bytes are
XOR-decoded with the same key before being written.

## Licensing

Only add fonts you may redistribute (open-source licensed or licensed to
you). Font name references may remain in `AllFonts.js` for document
compatibility even when the corresponding file is not shipped -- that is
exactly how the substitution below works.

`test/unit/font-catalog-licensing.test.ts` reads every catalog file's own name
table on each run, so a vendor bump that brings proprietary faces back in turns
the suite red. [font-licenses.md](font-licenses.md) lists what is shipped, under
what license, and which document font names each face answers to.

### The proprietary faces are gone (2026-08-22)

The vendor bundle arrived with the font set an OnlyOffice Docs _server_ would
have picked up from its host: Microsoft's core web fonts, Monotype's
Arial/Times/Courier, and ~150 MB of Chinese faces owned by SinoType, Founder,
ZhongYi, GreatWall and Stone -- 79 files, 171 MB, redistributed from a public
repository and a public origin.

`bin/font-license-sweep.mjs` replaced all of them. Documents that name "Arial"
or "宋体" still resolve; they land on Liberation Sans and Noto Serif SC.
Nothing was renamed and no font file was edited: the swap is in the registry,
not in the bytes.

```bash
node bin/font-license-sweep.mjs --check   # report the plan, touch nothing
node bin/font-license-sweep.mjs           # apply
```

The source faces live in `vendor-fonts/` (gitignored -- they are a second copy
of bytes the catalog already holds). The CJK pair is instanced from the Noto
Sans/Serif SC variable fonts and then subset, because the full faces are 16 and
24 MB and every Chinese document would pay for them:

```bash
# Static instances at 400 and 700. --update-name-table is not optional: without
# it both instances keep the variable font's default name ("Noto Sans SC Thin"),
# so the two weights collide and nothing identifies the bold as bold.
python3 -m fontTools.varLib.instancer --update-name-table NotoSansSC.ttf wght=400 -o sans-400.ttf
python3 -m fontTools.varLib.instancer --update-name-table NotoSansSC.ttf wght=700 -o sans-700.ttf

# sans: the whole CJK repertoire -- every CJK fallback range points at it, and
# a fallback face with holes renders blanks rather than falling through again
python3 -m fontTools.subset sans-400.ttf \
  --output-file=vendor-fonts/NotoSansSC-Regular-cjk.ttf \
  --unicodes="U+0000-2FFF,U+3000-33FF,U+3400-4DBF,U+4E00-9FFF,U+F900-FAFF,U+FE10-FE1F,U+FE30-FE4F,U+FF00-FFEF" \
  --name-IDs='*' --layout-features='*' --no-hinting

# serif: GB2312 plus punctuation and kana, for the Song/Fangsong/Kai names a
# document asks for by name (vendor-fonts/cjk-subset-codepoints.txt holds the
# GB2312 code points; regenerate by decoding every two-byte GB2312 sequence)
python3 -m fontTools.subset serif-400.ttf \
  --output-file=vendor-fonts/NotoSerifSC-Regular-gb.ttf \
  --unicodes-file=vendor-fonts/cjk-subset-codepoints.txt \
  --unicodes="U+0000-2FFF,U+3000-33FF,U+FE10-FE1F,U+FE30-FE4F,U+FF00-FFEF" \
  --name-IDs='*' --layout-features='*' --no-hinting
```

**TrueType outlines, not CFF.** The obvious choice for these is the pan-CJK
family (Noto Sans CJK SC and friends), and it renders perfectly in the editor
-- but it exports to PDF as nothing at all: x2t embeds no glyphs for a
CFF-flavoured face, so an exported PDF has its Chinese blank and its Latin
intact. `test/e2e/pdf-cjk-export.spec.ts` measures exactly that.

### The one rule substitution has to respect

The engine does not trust the registry alone. When it shapes a run it reads
`m_pFaceInfo.family_name` off the face it loaded -- the name inside the FILE --
and resolves that name through the matcher again (`sdk-all.js`,
`StringShaper.Shape`). So:

> The family name inside the file at position P must belong to a row that
> points at P.

The pristine vendor catalog satisfies this for all 267 of its referenced
positions. The first attempt at this sweep (PR #170, reverted by #174) broke it
by writing a replacement's **file name** into the proprietary position, so
position 75 -- which Arial's row points at -- held a file calling itself
"Liberation Sans", a name that belongs to position 65. The engine shaped with
one face and rasterised with another and every glyph came out shifted: typing
`Hello` put `Fcjjm` on the page.

The fix is not to copy file names between positions but to point the row at the
position the replacement already occupies. `test/unit/font-catalog-licensing.ts`
pins the invariant; `test/e2e/font-substitution.spec.ts` renders the same string
under both names and requires the two to be pixel-identical.

### Adding a family needs three things, not one

A new family is a position in `__fonts_files`, a row in `__fonts_infos` **and a
record in `g_fonts_selection_bin`**. Miss the third and the matcher cannot find
the family by name, which lands you back in the shifted-glyph failure by a
different route (this is what the added CJK families hit first).

`g_fonts_selection_bin` used to be treated as unmodifiable. It is not: its
reader is in `sdk-all.js`, and `bin/lib/selection-bin.mjs` implements the same
layout in both directions. `test/unit/font-selection-bin.test.ts` checks that
decode -> encode reproduces the shipped blob byte for byte, and that a record
rebuilt from a font's own OS/2 + head + post tables equals the record the
vendor's generator wrote for that file (188 of them do map one to one).

### What still is not verifiable from the suite alone

The visual E2E cases compare a document against its own save round trip, so a
font fault that affects both sides equally is invisible to them. When you touch
the catalog, look at real rendering with text that goes past U+00A0 -- and drive
it with `pluginMethod_PasteHtml`, not `page.keyboard.type`, which drops
characters often enough to look like a font bug.
