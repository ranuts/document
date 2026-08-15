# Changelog

User-facing changes to the document editor ([edit.chaxus.com](https://edit.chaxus.com/)).
Format loosely follows [Keep a Changelog](https://keepachangelog.com/); this
file is the single source for the site changelog page and GitHub release
notes. Entries describe what users experience, not internal refactors.

## [Unreleased]

### Known issues

- Editing complex real-world PPTX decks can raise "An error occurred during
  the work with the document" (under investigation; a full regression
  campaign against real-world documents is running and gates the next
  release announcement).

### Changed

- The editor engine was upgraded to an OnlyOffice 9.3-based build: new
  rendering engine and font pipeline, sharp toolbar icons on 2k/4k displays,
  fonts loaded on demand instead of up front.

### Added

- PDF files now open in a dedicated PDF viewer/editor.
- Legacy Word 97 binary `.doc` files now open correctly.
- Read-only mode can be toggled at runtime (embed API `document:set-readonly`
  works in both directions without reloading the document).
- Comments work in the Word editor, including add/update/delete lifecycle
  callbacks for integrators.
- Editor errors now surface as a visible notification with the error code
  instead of failing silently.
- CSV files in legacy encodings (GBK/GB18030, e.g. Chinese "ANSI" exports
  from Excel) are detected and decoded correctly instead of showing mojibake.

### Fixed

- Saving a document that contains an inserted image no longer freezes the
  page; the image bytes are correctly included in the saved file.
- Excel: right-aligned text no longer disappears after editing another cell.
- Excel: the caret now moves visibly while editing inside a cell.
- Word: the caret renders exactly at the insertion point (no more offset
  caret on some documents).
- Save-as-PDF produces a complete document instead of empty output.
- Multi-sheet workbooks opened via the embed API save back with all sheets
  intact.

## [0.0.5] - 2026-07-12

Last release of the previous (v7) engine line. See the
[GitHub release](https://github.com/ranuts/document/releases/tag/v0.0.5).
