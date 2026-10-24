# Startup payload, round three: only the active message table

Follow-up to `2026-10-24-jschardet-and-history-payload.md`. After that round,
the largest item in the startup graph of both `/editor` and `/history` was the
same: every message table in `packages/shared/src/i18n/messages/`.

## What it cost

`packages/shared/src/i18n.ts` imported all seven tables statically, so they
shared one chunk (`utils-*.js`, 289 KB) with the rest of `@ranuts/shared` and
`ranuts`. That chunk is in the static graph of both pages.

Bytes attributed through the sourcemaps (build of PR #292's branch, `39ae686f`):

| Table | Minified bytes |
| ----- | -------------- |
| zh-CN | 29.4 KB        |
| en    | 30.4 KB        |
| ja    | 38.9 KB        |
| ko    | 35.3 KB        |
| de    | 34.3 KB        |
| es    | 33.1 KB        |
| pt    | 32.9 KB        |
| Total | 234 KB         |

Gzipped, that is about 73 KB: 45% of the editor's 162 KB and 60% of the
history page's 121 KB. A visitor reads one of them.

## Design

Two options were considered:

- **A (chosen):** English stays in the bundle, because it is the per-key
  fallback for every other table. The other six become chunks loaded through a
  literal `import()` per locale, and `i18n.ts` awaits the active one at module
  top level.
- **B:** the same split, but each entry calls `await initI18n()` before it
  renders.

The network cost is the same: one extra request after the shared chunk runs,
for anyone not reading English. A is easier to maintain. Under ES module
semantics, nothing that imports `i18n.ts` runs before that top-level await
resolves, so `t()` stays synchronous and correct. None of the 34 files that
call it changed. With B, any `t()` call that runs before `initI18n()` (module
scope, import-time code, a future third entry) returns English and reports no
error, and tests run in English, so they would miss it.

Details:

- `loadLocale(lang)` is exported. It is a no-op for English or a loaded table,
  and it rejects when the chunk cannot be fetched.
- If loading the active table fails, the module still resolves. The shell then
  reads in English. A failed chunk must not keep the editor from starting.
- `setLanguage` has no production callers (only tests). It still switches
  synchronously. If the table is not loaded yet, strings read in English until
  it arrives, and then `languagechange` fires a second time.
- Each locale's loader is a literal `import('./i18n/messages/<file>')`, so the
  tsc-built `dist` and Rollup both see it. `Record<Exclude<Language, EN>, …>`
  makes a missing loader a type error. Adding a language is one more line
  there, next to the existing `LanguageCode` / `SHELL_LOCALES` edits.
- `@ranuts/shared` is not published to npm (registry 404) and chaxus/ran does
  not import it, so the change does not affect anyone outside this repo.
- Offline still works. `bin/offline-assets.mjs` follows `dynamicImports` into
  the core precache, and a stamped `sw.js` lists all six locale chunks
  (checked on this build).
- `getMessages(lang)` for a table that is not loaded now returns English.
  Only one caller depended on the old behavior. A fresh-context review of this
  diff found it: `displayError` (`lib/agent-plugin/ui/presentation.ts`) checks
  error text saved in restored assistant history against every language's
  table. With only the page's table loaded, an error saved in Japanese and
  reopened on a German page would show `agentRequestFailed`. The assistant is
  not in the startup graph, so `presentation.ts` now awaits all tables at its
  own top level (`Promise.allSettled`, so a failed chunk does not block the
  panel). That costs about 65 KB gzip, and only when the assistant opens.
  `loadLocale` keeps the in-flight promise, so concurrent calls share one load.
- Unit tests that switch languages synchronously preload every table first
  (`test/unit/lib/locales.ts`). Tests on a fresh module (`vi.resetModules`)
  load only the active table, the same as a real page.

## Measurements

The static startup graph, summed per chunk from `.vite/manifest.json`
(gzip level 9):

| Page       | Before (`39ae686f`)      | After                    |
| ---------- | ------------------------ | ------------------------ |
| `/editor`  | 537 KB raw / 162 KB gzip | 337 KB raw / 105 KB gzip |
| `/history` | 400 KB raw / 121 KB gzip | 198 KB raw / 61 KB gzip  |

The shared chunk drops from 289 KB to 86 KB. Of the 234 KB of tables, 30 KB
(English) remains. A non-English visitor also fetches one locale chunk of
29–39 KB raw, about 11 KB gzip, so their net saving is about 46 KB gzip on the
editor and about 49 KB gzip on history.

Rolldown also splits the startup graph into more files (editor 6 → 18, history
7 → 15). Total bytes are consistent with removing the tables:
537 − 234 + 30 ≈ 337. Vite preloads all of them in parallel through
`modulepreload` links.

Remaining items in the startup graph that belong to the ran ecosystem (the full
MIME table in `ranuts/utils/mimeType.js`, about 6.8 KB gzip on both pages, and
`@alixex/ranview`'s `mocks` chunk) were handed to a separate session for a fix
in chaxus/ran.

## Tests

- `test/e2e/editor-startup-payload.spec.ts`: neither page's startup scripts
  contain a string from the ja or de table. `/history?locale=de` renders its
  heading in German without a reload. The heading is rendered once, so a table
  that arrived late would leave it in English.
- `test/unit/i18n.test.ts`: a fresh module opened with `?locale=ja` reads
  Japanese as soon as the import resolves. Switching to an unloaded table reads
  English and then announces the translation. A failing chunk leaves the page
  in English and makes `loadLocale` reject.

Reverse validation, run against two variants:

1. With the static imports of `i18n.ts` restored, both startup-payload
   cases fail: `ja message table is in …/assets/utils-*.js`.
2. With the loaders kept but the top-level await replaced by a fire-and-forget
   `void loadLocale(…)` (what option B looks like when an entry forgets to
   await), the unit case "reads Japanese as soon as the module resolves" fails.
   The E2E heading case also fails, with `Received: "Saved documents"`.

3. Without the top-level await in `presentation.ts`, the new
   `agent-presentation` case fails. That case is a fresh module on
   `?locale=de` with no preload, given a Japanese quota error.

With the fix restored, all of them pass again: 252 unit files (6805 tests),
`lint:ts`, and 43 E2E cases (startup payload, editor locales, history page,
assistant history and locale and offline assets).
