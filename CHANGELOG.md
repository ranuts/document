# Changelog

User-facing changes to the document editor ([edit.chaxus.com](https://edit.chaxus.com/)).
Format loosely follows [Keep a Changelog](https://keepachangelog.com/); this
file is the single source for the site changelog page and GitHub release
notes. Entries describe what users experience, not internal refactors.

## [Unreleased]

### Added

- **Saving now writes back into your own file.** Pick the file once and every
  save after that goes straight into it -- no "save as" dialog each time, and
  no "a file with that name already exists" prompt. The document ends up where
  you keep your documents, not in a pile of downloads. (Chrome, Edge and other
  Chromium browsers; Safari and Firefox keep the download they always had.)
- **Your edits are kept while you work, and you can get them back.** Every
  document you edit is also saved to a recovery point inside your own browser --
  never uploaded, never leaving the device. If the tab closes, the browser
  crashes, or you simply come back the next day, the editor offers the work
  back by name and tells you when you made it. The homepage offers it too, so
  you do not have to remember where you were.
- **A page listing what this browser is holding**, at `/history`, linked from
  the homepage: your saved documents, newest first, searchable by any part of a
  file name in any language, with a delete on every row and a delete-all below
  the list. Rows holding the only copy of your work -- edits that never reached
  your disk -- say so.
- **It clears itself.** A document is deleted seven days after you last edit or
  open it, automatically, whether or not you visit the page. The rule is stated
  on the homepage and on that page, and every row shows how long it has left.
  Autosave can also be switched off entirely.
- **Closing a tab with unsaved edits now asks first.** It never did, so a
  mistaken Cmd+W or Ctrl+R silently threw the session away.
- **A reload comes back to the same document.** The address bar carries the
  document's identity (`?saved=<id>`), so refreshing an unsaved document reopens
  it instead of starting a blank one, and two files sharing a name stay
  separate.

### Changed

- Recovery points are taken more often on a fast machine and less often on a
  slow one. The editor times its own exports and spends a fixed, small share of
  the session on them, so a laptop keeps a recovery point about every 30
  seconds while a phone under load backs off instead of competing with the
  document you are editing.

### Known issues

- A report of "An error occurred during the work with the document" while
  editing a complex real-world PPTX could not be reproduced on the current
  build (the same deck opens, edits and saves cleanly in the automated
  real-document matrix); the likely cause is a browser still running a
  cached older build. If you see it, hard-refresh (or unregister the site's
  service worker) and try again; a full regression campaign against
  real-world documents runs nightly and gates the next release announcement.

### Changed

- The self-hosted Docker image is 27 MB smaller: the bundle carried asm.js
  copies of five engines, only ever used by browsers without WebAssembly --
  which cannot open a document here at all, since the conversion engine is
  WebAssembly.
- Chinese, Japanese and Korean text is set in one typeface again. A single
  line used to be assembled from up to four different fonts -- the characters
  from one, the comma from another, the full stop from a third -- because each
  Unicode block fell to whichever font happened to cover it. They now all
  resolve to Noto Sans CJK (or Noto Serif CJK where the document asks for a
  Song/Ming face), which also means CJK finally has a real bold instead of a
  synthesised one. Coverage went up too: the previous Chinese fonts were
  partial, so uncommon characters dropped out to a fallback mid-sentence.
- Arabic, Hebrew, Armenian, Georgian and Cyrillic Supplement each got a proper
  font of their own, and Syriac and Thaana are readable for the first time --
  nothing in the bundle had ever covered them, so they showed as empty boxes.
- Documents that name Arial, Times New Roman, Courier New or Calibri now
  render in the metric-compatible open equivalents (Liberation, Carlito).
  Character widths are identical, so line and page breaks do not move.

### Fixed

- Fonts are now sent compressed. The editor's font files have no extension, so
  the CDN had been typing them as generic binary and shipping every byte raw --
  a 16 MB Chinese font arrived as 16 MB rather than the 9.9 MB it compresses to.
  Opening your first Chinese, Japanese or Korean document was downloading
  roughly twice what it needed to.
- Browser AI agents were told this editor could not open OpenDocument, RTF or
  plain-text files. It always could -- the list the tools advertised had been
  written out by hand and fallen behind the engine. It is now derived from the
  engine's own format table, so it cannot drift again.
- An agent asking for the text of a spreadsheet or presentation used to get an
  empty answer, which reads as "this file is empty". The engine only exposes
  full text for word-processing documents, and the tool now says exactly that
  and points at exporting instead.

- A document that fails to open because the browser cannot allocate memory for
  the conversion engine no longer claims the file "may be corrupted, in an
  unsupported format, or not what its extension says". The file is fine: the
  engine never started, so it never read it. The message now says so, suggests
  what actually helps (close other tabs, or use a 64-bit browser), and carries
  what the browser refused -- the 2 GB address-space reservation or the 283 MB
  of real memory -- plus the browser's build architecture. Such a failure is
  also retried once now, like the other "the editor was not ready" failures;
  it used to be treated as a verdict on the file and reported immediately. A
  document the engine did read and reject still fails straight away, even when
  it ran out of memory doing so -- retrying that one, or blaming the browser
  for it, would only waste the reader's time.
- A hiccup from the CDN no longer costs you the document. The conversion
  engine is a 9.4 MB download, and a single failed answer for it (a 500, a
  dropped connection) used to end the open with "the document failed to open".
  It is now asked for again, twice, before anything is reported -- a file that
  is genuinely missing still fails immediately.
- The conversion engine is now compiled as it downloads, so the 40 MB
  decompressed copy of it never exists at all. It used to be held in memory at
  the exact moment the engine asked for its own (much larger) working memory,
  which is when opening a document fails on a machine that is short of it.
  Where a browser cannot compile while downloading, the engine still loads the
  old way and that copy is released as soon as it has started.
- A new version now applies on your next visit instead of waiting for you to
  close every tab of the site first. Updates were being downloaded and then
  left waiting indefinitely, which is why a fixed bug could look unchanged
  after an upgrade. Two things caused it: nothing was asking the update to take
  over (and the Chinese homepage did not register the offline worker at all),
  and every release looked to the browser as if it were replacing the editor
  engine even when only the app had changed. Keeping a second homepage tab open
  no longer holds an update back either -- only a tab with the editor actually
  open does, since that is the one an update could disturb. Releases that leave the engine
  untouched -- almost all of them -- now take over immediately; one that does
  replace it still waits until you have no document open, so a running editor
  cannot end up half-updated. Self-hosters: this is also why a freshly pulled
  image could keep serving the old app; the other half of that was fixed
  earlier in the image's cache contract. The offline cache no longer carries
  retired releases around either: each release's own files are cleared out when
  the next one takes over -- and never while a tab of the outgoing release is
  still open, so an editor left open across an update keeps working instead of
  losing pieces of itself. Two homepage scripts (the local-file picker and the
  editor prefetch) were also being served from the offline cache without
  checking for a newer copy, so a change to either could stay invisible on the
  homepage indefinitely; they now revalidate like the rest of the shell.
- The pill-shaped buttons on the homepage and the landing pages no longer draw
  a straight line under themselves that pokes out past their rounded ends: the
  raised shadow was being painted on a square box behind the round button.
- Documents are no longer at risk of opening with every font dropped when the
  font system is slow to start: the editor now waits longer for it before
  falling back to a font-free import.

### Removed

- The floating "Menu" button in the bottom-right corner of the editor, and the
  first-run bubble that pointed at it. It sat over the vertical scrollbar just
  above the zoom bar. Opening and creating documents start from the homepage
  (or `/editor?new=docx`, `/editor?file=<url>`); the AI assistant opens with
  `?agent=1`. Theme now follows the switch in the homepage footer -- there is
  no in-editor theme toggle any more.

### Changed

- The first document you open is quicker. The homepage now quietly warms the
  editor while you are still on it -- the font engine, the font entries every
  document needs, the conversion engine, and then all three editors (Word,
  Excel, PowerPoint) -- and keeps them in the offline cache, so opening no
  longer starts from nothing. Measured against a cold visit: a Word document
  asks the network for 45% less, a spreadsheet 72% less, a presentation 25%
  less. Skipped entirely on a metered or slow connection, or when the device
  has no room to store it, and it never competes with the homepage itself: one
  file at a time, at low priority, only in idle moments. Hovering an Open or New
  button still jumps that format to the front, and now covers one 1.2 MB file
  that had been missing from the list.

- Returning to the editor is much lighter on the network. Its own files are now
  served straight from the offline cache instead of being checked with the
  server one by one on every visit -- a second open used to make 46 such checks
  for files it already had, and now makes none. Most noticeable on a slow or
  metered connection, where those checks competed with the requests that
  actually mattered.

- The conversion engine downloads 377 KB smaller (about 4%), the largest single
  download in the app. Same engine, byte for byte -- only the compression of
  the file it ships in changed.

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

- Browser AI agents can now create a document and read one. The WebMCP tool set
  gains `create_document` (a new Word / Excel / PowerPoint file) and
  `get_document_text`, which lets an agent answer questions about what a
  document says without exporting it first. As before, everything runs on your
  device -- the tools call the same code the buttons do, and nothing is
  uploaded. A page explaining the whole thing is at `/webmcp-document-editor`,
  and the help center has a section on it.

- OpenDocument files now open from the file picker. ODT, ODS and ODP (the
  LibreOffice / OpenOffice formats), along with RTF and TXT, were already
  readable by the engine but were greyed out when you went to select one --
  so a file you had been sent could not be picked. They open, edit and save
  back to their own format, and export to PDF like everything else.
- Pages for the things the editor could already do but did not say anywhere:
  converting Word, Excel and PowerPoint files to PDF on your device, and
  opening ODT / ODS / ODP without LibreOffice. Both languages.
- `/llms-full.txt`: the full text of every page in one file, so an AI assistant
  answering questions about the editor can read the whole site in one request
  instead of guessing. Its index, `/llms.txt`, now also states what the editor
  does _not_ do -- no collaboration, no PDF-to-Word, memory-bound file sizes --
  because an assistant recommending a tool needs the boundaries too.

- The interface is now available in eight languages — English, 简体中文，
  日本語，한국어, Deutsch, Español, Português and فارسی (right-to-left) —
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
