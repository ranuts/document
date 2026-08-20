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

### Fixed

- The pill-shaped buttons on the homepage and the landing pages no longer draw
  a straight line under themselves that pokes out past their rounded ends: the
  raised shadow was being painted on a square box behind the round button.

### Removed

- The floating "Menu" button in the bottom-right corner of the editor, and the
  first-run bubble that pointed at it. It sat over the vertical scrollbar just
  above the zoom bar. Opening and creating documents start from the homepage
  (or `/editor?new=docx`, `/editor?file=<url>`); the AI assistant opens with
  `?agent=1`. Theme now follows the switch in the homepage footer -- there is
  no in-editor theme toggle any more.

### Changed

- Hovering (or focusing) an Open / New button starts downloading the editor
  engine in the background, so the document opens noticeably faster after the
  click; skipped on Save-Data and 2G connections.
- The homepage is now a plain landing page and the editor lives at `/editor`
  (`/editor?new=docx`, `/editor?file=<url>`, `/editor?embed=1`). The homepage
  no longer downloads the editor at all, so it loads faster; old links to
  `/?src=`, `/?file=`, `/?new=` and `/?embed=1` keep working (they redirect).
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

- The interface is now available in eight languages — English, 简体中文,
  日本語, 한국어, Deutsch, Español, Português and فارسی (right-to-left) —
  following your browser language, or `?locale=<code>`.
- Browser AI agents can drive the editor through WebMCP (Chrome origin trial):
  the page registers `open_document_url`, `open_document_buffer`,
  `save_document`, `set_readonly` and `get_document_state` when the browser
  exposes the API; everything still runs on your device.
- The editor's own interface (menus, ribbon, dialogs) now follows your
  browser language for all 45 languages the engine ships (Japanese, Korean,
  German, Spanish, Portuguese, French, Russian, ...), not just English and
  Chinese; `?locale=<tag>` still overrides it.
- The bottom-right Menu now has a light / dark / system switch, so the theme
  can be changed while a document is open (the editor follows it).
- A help center (`/help`, `/zh-CN/help`) answering the practical questions:
  formats, saving and converting, CSV encodings, what the PDF viewer can do,
  read-only and embedding, offline use, privacy boundaries, error codes,
  self-hosting; the Embed API reference (`/help/embed-api`) and this changelog
  (`/changelog`) are published on the site from the same markdown.
- The editor now follows the site's light/dark theme: a dark site opens a
  dark editor and switches live with the theme toggle; a theme you pick inside
  the editor's own settings still wins.
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

- Self-hosted (Docker) installs now pick up a new image immediately. The
  bundled server was caching pages for a day and its JavaScript for a year
  without ever asking the server again, so pulling a new image could change
  nothing in the browser -- a fix released weeks earlier was simply not
  running, while a freshly installed browser on the same machine got it
  (GitHub #144). Pages and unhashed files now revalidate; only
  content-addressed files stay cached long-term.
- When the editor reports "code -82" for a document that failed to open, the
  message now names the underlying cause instead of the number alone, and a
  save attempted after such a failure is refused immediately instead of
  waiting out its timeout.
- Documents on a phone now use the screen: the right panel, the rulers and the
  notes pane are folded away on narrow viewports, presentations also fold away
  the slide thumbnails, and the document starts fitted to the width -- so it
  opens at a readable size instead of a stamp in the middle of the screen
  (GitHub #145). The thumbnails come back from the left rail.
- That layout now follows the viewport instead of being decided when the
  document opens: a phone held in landscape counts as small too, and rotating
  the device or resizing the window re-adapts the open document -- including
  giving the panels back when the window is widened again.
- The editor no longer stays blank when the browser discards its canvas under
  memory pressure (seen on Android after repeatedly changing the zoom): it
  repaints as soon as the canvas is restored.
- Opening a local document no longer fails with "code -82 / the file could not
  be opened" when the editor's font system is not up yet: the conversion now
  waits for it (a fraction of a second, and only when it is actually behind)
  instead of tripping over it, and, if the open still fails for a
  reason that is about the editor rather than the file, the document is
  reopened once automatically. This is what made the same file open in a
  freshly started browser and fail in one that had been running all day
  (GitHub #144). When an open really does fail, the error toast now names the
  underlying reason instead of only the numeric code.
- Spreadsheets: using Review -> Remove/Resolve comments before clicking into
  the grid no longer fails silently and leaves undo in a broken state.

- The homepage no longer blocks its first paint on the editor's API loader
  script (about half a second of LCP); the loader is fetched when you open or
  create a document.
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
