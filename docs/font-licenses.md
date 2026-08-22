# Fonts shipped in the catalog, and under what license

Every file under `public/fonts/` carries its own license in its sfnt name
table (nameID 0 for copyright, 13 for the license text, 14 for the license
URL). `test/unit/font-catalog-licensing.test.ts` reads all of them on every
run and fails if any file cannot show evidence of an open license, so this
page is a reader's summary rather than the source of truth.

Faces are stored in the vendor's XOR-obfuscated wire format; decode one with
`node bin/font-catalog.mjs decode public/fonts/<slot> /tmp/font.ttf` to read
its name table yourself.

## Added by the license sweep (2026-08-22)

These replaced the 79 proprietary faces the vendor bundle arrived with. They
are shipped exactly as published upstream -- no renaming, no edits to the name
table -- except for the CJK pair, which is a static instance (weight 400 and 700) of the upstream variable font, subset to keep the download in the same
range as the faces it replaces. Both steps are `fontTools`; the exact
invocations are in [fonts.md](fonts.md).

| Family                                            | License     | Upstream                                     |
| ------------------------------------------------- | ----------- | -------------------------------------------- |
| Noto Sans SC (regular, bold; instanced + subset)  | SIL OFL 1.1 | fonts.google.com/noto/specimen/Noto+Sans+SC  |
| Noto Serif SC (regular, bold; instanced + subset) | SIL OFL 1.1 | fonts.google.com/noto/specimen/Noto+Serif+SC |
| Noto Sans (regular, bold)                         | SIL OFL 1.1 | github.com/notofonts/notofonts.github.io     |
| Noto Sans Hebrew (regular, bold)                  | SIL OFL 1.1 | same                                         |
| Noto Sans Armenian (regular, bold)                | SIL OFL 1.1 | same                                         |
| Noto Sans Georgian (regular, bold)                | SIL OFL 1.1 | same                                         |
| Noto Sans Thaana (regular, bold)                  | SIL OFL 1.1 | same                                         |
| Noto Sans Syriac (regular)                        | SIL OFL 1.1 | same                                         |

The OFL text travels with each file (nameID 13) and is reproduced in full at
<https://openfontlicense.org/>. Noto is published without a Reserved Font Name,
which is what makes subsetting them legitimate; the subsets keep the original
family names, so nothing here claims to be a font it is not.

## The names those faces answer to

The substitution happens in the registry, not in the files: `__fonts_infos`
rows for the removed families point at the positions these faces occupy. A
document that names a proprietary family still resolves.

| Document says                                                            | It gets          |
| ------------------------------------------------------------------------ | ---------------- |
| Arial, Arial Black                                                       | Liberation Sans  |
| Times New Roman                                                          | Liberation Serif |
| Courier New, Andale Mono                                                 | Liberation Mono  |
| Calibri                                                                  | Carlito          |
| Georgia                                                                  | DejaVu Serif     |
| Verdana, Trebuchet MS, Comic Sans MS, Impact                             | DejaVu Sans      |
| Webdings                                                                 | OpenSymbol       |
| SimSun, 宋体, 新宋体, FangSong, 仿宋, KaiTi, 楷体, STSong, 华文宋体 …    | Noto Serif SC    |
| SimHei, 黑体, Microsoft YaHei, 微软雅黑, 等线, YouYuan, LiSu, 华文彩云 … | Noto Sans SC     |

Liberation, Carlito, DejaVu and OpenSymbol were already in the catalog; the
first four are metric-compatible with the names they now answer to, so line and
page breaks in an existing document do not move.

## Already in the vendor catalog

The rest of `public/fonts/` came with the offline bundle and stays: DejaVu,
Liberation, Carlito, Caladea, Droid Sans Fallback, AR PL UKai, WenQuanYi Zen
Hei, Nanum, Takao, Noto (Naskh Arabic and the per-script faces), Lohit,
Samyak, Padauk, Khmer OS, Tibetan Machine Uni, OpenSymbol, Symbola, FreeFont,
KACST, Ubuntu, Abyssinica SIL, Asana Math, Mitra Mono and others -- all under
OFL, GPL with a font exception, Apache 2.0, the Arphic or IPA licenses, or the
Ubuntu Font Licence.
