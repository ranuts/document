# Changelog

User-facing changes to the document editor ([edit.chaxus.com](https://edit.chaxus.com/)).
Format loosely follows [Keep a Changelog](https://keepachangelog.com/); this
file is the single source for the site changelog page and GitHub release
notes. Entries describe what users experience, not internal refactors.

## [Unreleased]

### Known issues

- A report of "An error occurred during the work with the document" while
  editing a complex real-world PPTX could not be reproduced on the current
  build (the same deck opens, edits and saves cleanly in the automated
  real-document matrix); the likely cause is a browser still running a
  cached older build. If you see it, hard-refresh (or unregister the site's
  service worker) and try again; a full regression campaign against
  real-world documents runs nightly and gates the next release announcement.

### Changed

- The iframe embedding demo (`/embed-demo.html`) now uses the same design
  system as the rest of the site (ranui components and tokens, dark mode,
  shared top bar) instead of its own ad-hoc styling; the demo's postMessage
  behaviour is unchanged.
- The editor interface now defaults to the classic Office theme
  (`theme-classic-light`, coloured per-app toolbar header) instead of the flat
  white theme; a theme you pick inside the editor is still remembered.
- The editor engine was upgraded to an OnlyOffice 9.3-based build: new
  rendering engine and font pipeline, sharp toolbar icons on 2k/4k displays,
  fonts loaded on demand instead of up front.

### Added

- New "Open PDF" pages (`/open/pdf`, `/zh-CN/open/pdf`) explaining what the
  PDF viewer can and cannot do (read, comment and annotate, save back as PDF;
  no free-text rewriting of an existing PDF), linked from both homepages.
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

- The Chinese landing pages' "open your XLSX / PPTX / CSV" buttons no longer
  drop you into a blank new Word document; they go to the Chinese homepage
  where you can pick the file.
- Opening a document that uses many fonts (typical for Chinese decks) no
  longer sits on "Loading presentation" for minutes on the hosted site: the
  editor's font files and the conversion engine are now cached long-term by
  the browser, document fonts are downloaded in parallel instead of one
  family at a time, and the unused "default font" preload is skipped. On a
  real 35-slide deck the first open went from never finishing to about
  45 s on a cold connection, and a repeat open takes about 3 s.

- Words carrying a phonetic guide (Japanese furigana / Chinese pinyin
  "ruby" annotations) no longer disappear from a Word document on open and
  save; the base word is kept. The guide text itself is still dropped
  (engine limitation).
- PDF files now actually load in the PDF editor: previously the editor
  mounted but the document stayed on its loading placeholder (the PDF app
  expects the page to hand the file over, unlike the other editors), and on
  the live site the "is this a form?" pre-loader additionally got stuck
  behind a folder redirect. PDFs open, take annotations and save back.
- On slow connections the first save no longer fails with "timed out" while
  the file was still on its way: the editor must first download its ~10 MB
  conversion engine, which could take longer than the old 60 s limit; the
  save now waits up to 3 minutes and still fails fast when the document
  genuinely could not be opened.
- A new release deployed while you have a document open no longer swaps
  parts of the editor underneath it: the update now waits until nothing is
  open (or the next visit), then takes over and refreshes once. Previously
  the old page could lazy-load pieces of the new build into the running
  session, a plausible cause of sporadic "An error occurred during the work
  with the document" dialogs right after deploys.
- "Excel" files that are really an HTML table (the usual export of web
  systems, saved as .xls/.xlsx) now open and save as a real workbook instead
  of failing to load.
- Firefox: the page no longer raises an unhandled promise rejection from the
  service-worker update check on load.
- Presentations no longer log a script error on every open (the editor
  asked for a theme catalog file the offline package never shipped).
- Embed API: `document:save` without `targetExt` now exports in the open
  document's own format instead of always XLSX (a bare save on a .docx or
  .pptx used to fail with a timeout).
- A file the editor cannot import (corrupted bytes, an unsupported format
  behind a familiar extension) now shows an error dialog and a notification
  and stops the loading spinner, instead of loading forever; a pending save
  fails immediately with the reason instead of after a 60 s timeout.
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
