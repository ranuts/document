# Startup payload, round two: jschardet and the history page

Follow-up to `2026-10-24-editor-startup-payload.md`. Measuring the startup
graph again, module by module through sourcemaps, turned up two more problems.

## jschardet: 332 KB of an entry chunk nobody called

After round one, the editor's entry chunk was 417 KB, and 466 KB of its source
was jschardet, a statistical charset detector.

Nothing in this app detects charsets statistically. CSV decoding uses
`decodeTextBytes` (`ranuts/utils/binary`), which tries a strict utf-8 decode,
then gb18030, then latin1, without jschardet. The import came from
`ranuts/utils/str.ts`, which imported `detect` from jschardet at the top for
three functions: `checkEncoding`, `arrayBufferToString` and `transformText`.
The same file holds `MessageCodec`, and `lib/events.ts` uses it at startup.

jschardet is CommonJS. Bundlers treat its import as a side effect and cannot
remove it, so every consumer of anything in `str.ts` shipped the whole
detector.

The fix belongs in ranuts (chaxus/ran#443, released in 0.5.1): the three
functions moved to `utils/charset.ts`. `ranuts/utils` exports the same names.
A ranuts test bundles a `MessageCodec` consumer and a `checkEncoding` consumer
through Vite, and checks that the detector appears only in the second.

Before the release, a consumer-side `treeshake.moduleSideEffects` override in
`vite.config.ts` confirmed the number: editor entry chunk 417 KB → 85 KB. That
override was dropped in favour of the upstream fix. This PR only upgrades
ranuts and ranui to 0.5.1 (ranview 0.2.1 comes with ranui).

The upgrade also re-syncs the ranui files this repo keeps in `public/`
(`ran-tokens.css`, `ranui-iife/*`). The steps are the same ones `bin/build.sh`
runs on every build.

## The history page loaded the editor

CLAUDE.md describes `/history` as not loading the editor. In practice it did,
through two imports:

- `formatRelativeTime` from `lib/history/recovery.ts`, which imports
  `lib/document.ts` and so the whole open pipeline;
- `isAutosaveEnabled` / `setAutosaveEnabled` from `lib/history/autosave.ts`,
  which imports `onlyoffice/save-stream.ts`.

Both helpers are pure. They now live in `lib/history/relative-time.ts` and
`lib/history/preferences.ts`. The history page writes the preference with
`writeAutosavePreference`. The editor-side `setAutosaveEnabled` keeps its old
behavior: it writes the preference, then stops the running session. On the
history page that second step was always a no-op, because no session runs
there.

## Measurements

The static startup graph, summed per chunk from `.vite/manifest.json`:

| Page                      | Before (main `47ee1d3a`)  | After                    |
| ------------------------- | ------------------------- | ------------------------ |
| `/editor`                 | 866 KB raw / 280 KB gzip  | 537 KB raw / 163 KB gzip |
| `/history`                | 476 KB raw / 148 KB gzip  | 400 KB raw / 122 KB gzip |
| `/editor` vs. pre-round-1 | 1102 KB raw / 350 KB gzip | 537 KB raw / 163 KB gzip |

## Tests and reverse validation

`test/e2e/editor-startup-payload.spec.ts` now covers both pages:

- `/editor` must not contain the agent tools, the PWA library, or jschardet's
  charset table (`windows-1255`).
- `/history` must not contain the save pipeline's `Save conversion failed`, or
  jschardet.

Reverse validation:

- **ranuts back at 0.5.0:** the editor case failed on jschardet in the entry
  chunk.
- **History page importing `history/recovery` and `history/autosave` again:**
  the history case failed on the save pipeline in the `document` chunk.

## Left for later

All seven site languages' message tables (about 215 KB of source in one shared
chunk) load on both pages, though each page uses one. Loading them per locale
changes `@ranuts/shared/i18n`, whose `t()` is synchronous and is used by three
sites. That is a shared-contract change, not a payload fix.

## The ranui upgrade hid the assistant's portals under the panel

The first CI run of this PR failed one case: `agent-dictation.spec.ts`, docx.
Hovering the voice privacy hint timed out because the composer textarea was on
top of it.

- **Cause:** in ranui 0.5.1 the floating controller writes the portal layer
  inline, as `z-index: var(--ran-dropdown-host-z-index, var(--ran-z-dropdown,
1100))`. Our `.agent-speech-popover` and `r-dropdown[role='listbox']` rules
  set a plain `z-index: 100000`, and an inline style beats a stylesheet rule.
  So both portals dropped to 1100, under the assistant panel at 10000.
- **Bisected:** main with only ranui moved to 0.5.1 fails the same way. With
  0.5.0 the hint's portal sits at 100000.
- **Fix:** set `--ran-dropdown-host-z-index: 100000` instead, which ranui's
  own inline value reads.
- **Second victim:** select lists opened from the panel go through the same
  controller, so they were also drawn under it, and no test noticed.
  `agent-portal-layer.spec.ts` now opens a settings select and asserts its
  list is the topmost element at its centre.
- **Reverse validation:** with the stylesheet change reverted, both the new
  case and the dictation case fail.
