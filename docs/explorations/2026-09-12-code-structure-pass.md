# Four files nobody could hold in their head, and two rules nobody was checking

2026-09-12 — PR #233 #234 #236 #237

Not a bug hunt. After a day of shipping, a pass over what the day left behind:
where the code had grown past the point of being readable, and which of the
invariants this repository _states_ are actually enforced by something.

## The measurement

Line counts are a weak signal on their own — `sw.js` is long because a service
worker is one object with many methods, and splitting it would be worse. The
signal worth acting on is **a file that answers to more than one reader**:
someone adding a language, someone chasing a conversion bug, and someone adding
a PDF font all editing the same thousand lines for unrelated reasons.

Two files qualified.

| file                                           | lines | who edits it, and why                                               |
| ---------------------------------------------- | ----: | ------------------------------------------------------------------- |
| `packages/shared/src/i18n.ts`                  |  1263 | 7 translators + whoever adds a UI string + editor-locale resolution |
| `packages/converter/src/document-converter.ts` |  1130 | x2t loading + PDF fonts + spreadsheets + file metadata              |

Both were split along **what the code knows about**, not by size:

- i18n → `i18n/types.ts` (the shape) + `i18n/messages/<locale>.ts` (7 files).
  371 lines left in the entry. Adding a language is now adding a file; two
  translations no longer touch the same lines.
- converter → `file-meta.ts`, `x2t-loading.ts`, `pdf-fonts.ts`, `spreadsheet.ts`.
  826 lines left. Everything is re-exported, so **no call site changed**.

### The one thing the split broke, and what caught it

Moving the i18n interface out took `resolveEditorLocale` with it — the routine
that walks a doc comment backwards to find where a declaration starts went one
`/**` too far. `tsc` caught it immediately. That is the argument for doing this
kind of move in a typed language and running the compiler, rather than trusting
the diff to look right.

## The 23 copies of the same walk

Every spec that drives a real editor has to reach the window the SDK runs in —
not the page Playwright navigated, because the app mounts the editor in an
iframe and the demo page wraps that in another one. **Twenty specs carried
twenty-three copies** of the same recursive walk, each needing to get the same
two things right (recurse into children; swallow the cross-origin read).

It could not be a plain import: `page.evaluate` ships only the function it is
given, so a module-scope helper does not exist in the browser. So the L0 fixture
injects it at document start, and specs call `window.__ooFrames.find(...)` from
inside their own evaluate.

Two details that are easy to get wrong, both hit during the change:

1. **The primitive returns a window, not the probe's result.** `false` and `0`
   are meaningful answers here — `sw-warm` asks whether the editor frame has a
   service-worker controller, and "no" is not "keep looking"; `format-parity`
   reads a restriction value that is legitimately `0`. A truthiness-based walk
   walks straight past both.
2. **Install on the context, not the page.** `save-to-file` opens a second page
   with `context.newPage()`, and a page-level `addInitScript` is not there for
   it. Symptom: `Cannot read properties of undefined (reading 'readyEditor')`.

## Two rules the repository states and nothing was checking

### Every shell language says everything

`t()` is typed against `I18nMessages`, but only `en` and `zh-CN` are the full
type — the other five are `Partial`, deliberately, so a half-finished
translation is not a compile error. The cost is that **a missing key is
silent**: `t()` falls back to English, which on screen reads like a translation
somebody chose rather than one nobody wrote.

Measured: all seven tables have the same 99 keys today. So the invariant holds;
nothing was holding it. `test/unit/i18n-completeness.test.ts` now does, and is
the check a new UI string has to pass. It also catches a key one locale invented
on its own (a typo `t()` will never look up) and a value left blank.

### Every runtime guard has a unique number

The number is the guard's name in prose — CLAUDE.md, these records and a good
many commit messages say "guard 8" and expect that to identify one file. It had
drifted:

| number | claimed by                                       |
| ------ | ------------------------------------------------ |
| 8      | `comment-selection.ts` **and** `font-loading.ts` |
| 11     | `hint-fallback.ts` **and** `unload-prompt.ts`    |

Four existing references made ambiguous, quietly. `chrome.ts` and
`shared-worker.ts` had no number at all, and CLAUDE.md said "14 guards" for what
is now 16 files.

Renumbered to a unique, gapless 1..16 **without moving any number an existing
record already points at**: the free ends took the collisions (`font-loading` →
15, `unload-prompt` → 16) and the two unnumbered ones took 1 and 2.
`test/unit/guards-numbering.test.ts` pins it.

## Lint that fails

`oxlint` was running without `--deny-warnings`, and was not looking at
`bin/**` or `public/*.js` at all — so the day's new scripts were unlinted, and a
warning merged as easily as clean code. Turning both on found two unused imports
**during the converter split itself**: exactly the class of thing that used to
merge silently.

## Reverse validation

Per the repo's rule that a green test proves nothing until it has been seen red:

- delete `openUrlFailed` from `ja` → `ja is missing 1 string(s): [ 'openUrlFailed' ]`
- put `font-loading` back on guard 8 → both the uniqueness and the coverage case fail

## What was deliberately not done

- **`sw.js`, `document-converter.ts`'s remaining 826 lines, `build.sh`.** Long,
  but each is one thing to one reader. Splitting them buys nothing and costs a
  layer of indirection.
- **Merging the two x2t loaders** (`x2t_helper.js` and the converter's copy).
  They are genuinely twins and drift is a real risk, but one is a vendor-tree
  classic script and the other is a bundled module; unifying them means a build
  step inside `public/`. Worth doing, not worth doing in passing.

## Result

3431 unit tests, 165 E2E + 2 serial, lint and format clean, production smoke
green on the merged SHA. No behaviour changed anywhere in this pass — every
public export kept its name and its home.
