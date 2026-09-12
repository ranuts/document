# The font list crashed the editor, and it was ours

2026-09-12 — GitHub #218

## What users saw

Open the font dropdown, scroll to the bottom, and the editor stops working.

```
Uncaught RangeError: Invalid typed array length: 33600
    at new Uint8ClampedArray (<anonymous>)
    at m.getImage (app.js:8:679950)
    at n.updateVisibleFontsTiles (app.js:8:691239)
```

And again on every scroll after that. The document cannot be edited any more.

## Why

The dropdown does not draw font names as text. Each row is a tile cut out of a
sprite, indexed by the font's position in the catalog:

```js
// ComboBoxFonts.updateVisibleFontsTiles
s = Math.floor(store.at(n).get('imgidx') / r);
var m = this.spriteThumbs.getImage(s);

// the sprite's getImage
s.data.set(new Uint8ClampedArray(this.data.buffer, i * a, a)); // a = 4 * width * heightOne
```

`a = 4 × 300 × 28 = 33600` — the number in the error. The view runs past the end
of the buffer as soon as `i` reaches the sprite's tile count, and a `RangeError`
is what a typed-array view does instead of degrading.

Counted:

|                                           | families in `__fonts_infos` | tiles in `fonts_thumbnail*.png.bin` |
| ----------------------------------------- | --------------------------- | ----------------------------------- |
| this site                                 | **202**                     | **193**                             |
| a reference deployment of the same vendor | 144                         | 144                                 |

The nine past the end are exactly the ones the font licensing sweep appended
(`d0beb29`, PR #184):

```
Noto Sans SC, Noto Serif SC, Noto Sans, Noto Sans Hebrew, Noto Sans Armenian,
Noto Sans Georgian, Noto Sans Georgian Bold, Noto Sans Thaana, Noto Sans Syriac
```

`git log` on the two files says the rest: `AllFonts.js` was last written by that
commit; `fonts_thumbnail.png.bin` has not been touched since the vendor tree
landed.

So this is our regression, not the vendor's.

## Why upstream cannot hit it

Worth writing down, because it explains the whole shape of the bug. ONLYOFFICE
generates the catalog and the sprites in one pass: `allfontsgen`, invoked by
`documentserver-generate-allfonts.sh`, walks a font directory and writes
`AllFonts.js`, `font_selection.bin` **and** `fonts_thumbnail*` together. A
deployment that takes the official image and runs that script — checked: 144
families, 144 tiles — cannot drift.

We do not run it. The catalog is edited by hand because the vendor bundle
arrived with 79 proprietary faces we had to replace
(docs/changelogs/2026-08-22-font-licensing.md), and hand-editing one half of a
generated pair is exactly how the halves come apart.

CLAUDE.md's rule was "a new family = a slot + an `__fonts_infos` row + a
`g_fonts_selection_bin` record, all three". It was missing a fourth: **and a
tile in every sprite.**

## The fix

`bin/font-thumbnails.mjs` appends the missing tiles. It is idempotent — the 193
that came with the vendor are never re-rendered, only appended to — and it
writes all ten sprites (`fonts_thumbnail` and `fonts_thumbnail_ea`, at ratios 1
/ 1.25 / 1.5 / 1.75 / 2), because the picker indexes every one of them by the
same font position.

Rendering happens in a headless Chromium: each name is drawn in its own face,
loaded from the catalog through the same XOR de-obfuscation `fetchFonts` does,
with the catalog's Noto Sans behind it for names whose own face has no Latin
(Thaana and Syriac). Metrics were measured off the vendor's own tiles rather
than guessed — `--calibrate` prints them:

```
vendor tile 7  (Arial)   minX 18  maxX 54   minY 7  maxY 19
new    tile 195 (Noto Sans)  minX 18  maxX 91   minY 7  maxY 20
```

Same left margin, same cap height, same baseline; the one-pixel difference at
the bottom is antialiasing.

The sprite format is worth recording, since nothing documents it: a 12-byte
big-endian header (`width`, `heightOne`, `count`) followed by an alpha mask
where a byte is one pixel's alpha, except `0`, which is followed by a one-byte
run length of fully transparent pixels.

Only the `.bin` files are written. The `.png` twins beside them are read only
when `supportBinaryFormat` is false, which requires
`Common.Controllers.Desktop.isActive()` — the ONLYOFFICE desktop shell. No
browser takes that path.

## Tests

`test/unit/font-catalog-licensing.test.ts` gains the invariant in three parts:
all ten sprites are present, every one has at least as many tiles as the catalog
has families, and each decodes to exactly `width × heightOne × count` pixels (a
truncated payload is the same crash by another route).

`test/e2e/font-picker-scroll.spec.ts` is the user's path: open a document, open
the font list, scroll it to the end, and require that the last row actually got
its name drawn. The L0 fixture fails the case on the uncaught `RangeError` by
itself; the assertion is what says the row is _readable_ rather than merely
not-crashing.

Reverse validation (convention 5): with the vendor's 193-tile sprites restored,
both the unit case and the E2E case fail —

```
AssertionError: fonts_thumbnail.png.bin has 193 tiles for 202 families:
  expected 193 to be greater than or equal to 202
```

## Next time the catalog changes

```
node bin/font-thumbnails.mjs          # append what is missing
node bin/font-thumbnails.mjs --check  # report drift, write nothing
```

The unit test is what makes forgetting it impossible.
