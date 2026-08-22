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
compatibility even when the corresponding file is not shipped.

### Known problem: 79 proprietary faces are still shipped

The vendor bundle arrived with the font set an OnlyOffice Docs _server_ would
have picked up from its host: Microsoft's core web fonts, Monotype's
Arial/Times/Courier, and ~150 MB of Chinese faces owned by SinoType, Founder,
ZhongYi, GreatWall and Stone. 79 files, 171 MB. This repository and its origin
are public, so shipping them is redistributing them. **This is unresolved.**

Replacing them was attempted on 2026-08-22 and reverted the same day (#170,
reverted by #174): production came back with every glyph shifted -- typing
"Hello" put "Fcjjm" on the page and CJK did not render at all.

**Read
[docs/explorations/2026-08-22-font-licensing-why-substitution-fails.md](explorations/2026-08-22-font-licensing-why-substitution-fails.md)
before trying again.** It records five approaches and how each one fails. The
short version:

- There is no small, local substitution. Family name, glyph indices, metrics
  and character coverage are tied together across four datasets --
  `__fonts_files`, `__fonts_infos`, `__fonts_ranges` and
  `g_fonts_selection_bin`. Changing one without the others breaks rendering.
- A _position_ in `__fonts_files` is a font identity, not just a path. Two
  families sharing one position renders from the wrong glyph indices; one file
  repeated across positions makes the engine treat it as several fonts.
- Metric compatibility is not glyph-order compatibility. Arial and Liberation
  Sans disagree on 844 of 939 codepoints checked; only basic ASCII happens to
  line up, which is why a `Hello`-only test says everything is fine.
- `sdk-all.js` hardcodes `Arial`, `Calibri`, `SimSun`, `Tahoma`, `Batang` and
  `MS Mincho`. Remove those names and the editor never finishes booting.
- `g_fonts_selection_bin` is load-bearing, not optional: blank it and every
  character becomes tofu.

The E2E suite cannot catch this class of bug -- its visual cases compare a
document against its own save round trip, and both sides render with the same
wrong font. Verify in a real browser, with text that goes past U+00A0.
