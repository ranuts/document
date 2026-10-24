# Startup payload, round four: ranui select, and why the MIME table stays

Follow-up to `2026-10-24-active-locale-only.md`. After the locale split, two
more startup items were found by attributing startup bytes to their source
packages through the sourcemaps. ranui's `select` is about 7.6 KB gzip on its
own and is on the editor page. ranuts' full MIME table
(`ranuts/dist/src/utils/mimeType.js`, 30 KB raw / 6.8 KB gzip) is on both
pages.

## ranui select: moved off the editor startup

`index.ts` imported `ranui/select` at top level. Nothing on the editor page
renders an `r-select` until the assistant opens. Every assistant module that
renders one either imports the element itself (`panel.ts`,
`model-configuration-form.ts`) or is imported only by `panel.ts`
(`settings-view.ts`, `speech-input.ts`). The import was removed. The element
now registers when the assistant panel loads, which is the first use.

The saving is larger than the select chunk alone. ranui's floating controller
and other helpers that only select needed leave the startup graph with it.

| Page       | Before (PR #293)         | After                   |
| ---------- | ------------------------ | ----------------------- |
| `/editor`  | 337 KB raw / 105 KB gzip | 271 KB raw / 90 KB gzip |
| `/history` | 198 KB raw / 61 KB gzip  | 199 KB raw / 62 KB gzip |

History does not import `index.ts`, so its bytes stay the same (+0.2 KB raw).
The gzip sum grows by about 1 KB only because Rolldown now emits ranui's button
as a file of its own, and each file is compressed separately.

## The MIME table: not removable from this repo

`packages/shared/src/document-utils.ts` was the expected holder, through
`getMimeTypeFromExtension` → `getMime`. That function had no production caller
(the final `rg` returned zero outside `docs/` and an unrelated method of the
same name in the vendored `x2t_helper.js`). Only its unit tests used it, and it
was deleted.

The table stayed, in both pages. The cause is ranui's packaged
`dist/utils-*.js`, which builds a namespace object over all of ranui's utils,
including its own `getMimeTypeFromExtension`
(`getMime(\`.${ext}\`) || 'application/octet-stream'`). A namespace object
references every member, so a bundler cannot drop any of them. Minimal Vite
builds in this repo confirm it:

| Entry                                  | MIME table in output |
| -------------------------------------- | -------------------- |
| `import 'ranui/button'`                | no                   |
| `import 'ranui/icon'` / `ranui/modal`  | no                   |
| `import 'ranui/input'`                 | yes                  |
| `import 'ranui/message'`               | yes                  |
| `saveFileToDisk` / `createSignal` only | no                   |

Both pages need `ranui/input` and `ranui/message`. The editor also calls
`getExtensions(file.type)` from `lib/converter.ts` and `packages/converter` (as
the fallback for a file with no extension), which keeps the table on the editor
regardless of ranui. Removing it from both pages therefore needs a ranui change
first (no namespace object over utils, or ranui's own MIME helper moved out of
it). After that, the editor's two `getExtensions` calls can be replaced with a
lookup derived from `DOCUMENT_MIME_MAP`. Neither is done here.

## Tests

`test/e2e/editor-startup-payload.spec.ts`:

- The editor's startup scripts do not contain a string unique to ranui's select
  chunk (`ran-select-dropdown-option`).
- On a fresh editor, `customElements.get('r-select')` is undefined until the
  assistant opens. After the settings view opens, it is defined and a select is
  visible.

Reverse validation: with `import 'ranui/select'` back in `index.ts`, both cases
fail (`ranui select is in …/panel-viewport-*.js`, and the element is defined
before the assistant opens). With the import removed, all five cases in the
spec pass.
