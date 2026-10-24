# Startup payload, round four: ranui select and the MIME table

Follow-up to `2026-10-24-active-locale-only.md`. After the locale split, two
more startup items were found by attributing startup bytes to their source
packages through the sourcemaps. ranui's `select` is about 7.6 KB gzip on its
own and is on the editor page. ranuts' full MIME table
(`ranuts/dist/src/utils/mimeType.js`, 30 KB raw / 6.8 KB gzip) is on both
pages.

## Result

The static startup graph, summed per chunk from `.vite/manifest.json`
(gzip -9):

| Page       | Before (main `ee33a4ef`) | After                   |
| ---------- | ------------------------ | ----------------------- |
| `/editor`  | 337 KB raw / 105 KB gzip | 241 KB raw / 84 KB gzip |
| `/history` | 198 KB raw / 61 KB gzip  | 169 KB raw / 55 KB gzip |

Measured step by step on the same base:

- Removing the select import takes the editor from 105 KB to 90 KB gzip.
- Upgrading ranui to 0.5.2 takes history from 62 KB to 55 KB gzip.
- Replacing `getExtensions` takes the editor from 90 KB to 84 KB gzip.

## ranui select: moved off the editor startup

`index.ts` imported `ranui/select` at top level. Nothing on the editor page
renders an `r-select` until the assistant opens. Every assistant module that
renders one either imports the element itself (`panel.ts`,
`model-configuration-form.ts`) or is imported only by `panel.ts`
(`settings-view.ts`, `speech-input.ts`). The import was removed. The element
now registers when the assistant panel loads, which is the first use.

The saving is larger than the select chunk alone. ranui's floating controller
and other helpers that only select needed leave the startup graph with it.
History does not import `index.ts`, so its bytes stay the same. Its gzip sum
still grows by about 1 KB at this step, only because Rolldown now emits ranui's
button as a file of its own, and each file is compressed separately.

## The MIME table: held by ranui, then by our own fallback

`packages/shared/src/document-utils.ts` was the expected holder, through
`getMimeTypeFromExtension` → `getMime`. That function had no production caller
(the final `rg` returned zero outside `docs/` and an unrelated method of the
same name in the vendored `x2t_helper.js`). Only its unit tests used it, and it
was deleted. That alone saved nothing.

The real holder was in ranui 0.5.1's packaged `dist/utils-*.js`, which built a
namespace object over all of ranui's utils, including an uncalled
`getMimeTypeFromExtension` of its own
(`getMime(\`.${ext}\`) || 'application/octet-stream'`). A namespace object
references every member, so a bundler cannot drop any of them. Minimal Vite
builds in this repo confirmed it:

| Entry (ranui 0.5.1)                    | MIME table in output |
| -------------------------------------- | -------------------- |
| `import 'ranui/button'`                | no                   |
| `import 'ranui/icon'` / `ranui/modal`  | no                   |
| `import 'ranui/input'`                 | yes                  |
| `import 'ranui/message'`               | yes                  |
| `saveFileToDisk` / `createSignal` only | no                   |

Both pages need `ranui/input` and `ranui/message`. The function was deleted
upstream in ranui 0.5.2 (published with ranuts 0.5.2 and ranview 0.2.2), which
also adds size budgets for those two entries. This repo upgrades to it. The
minimum-release-age exclusion follows ranview to 0.2.2: the install needs both
versions listed once, because pnpm verifies the old lockfile entry before
resolving, and then a frozen install passes with only 0.2.2. As in the 0.5.1
upgrade, `public/ran-tokens.css` was re-synced. The IIFEs did not change.

The editor also kept the table through its own code. `lib/converter.ts` and
`packages/converter` fell back to `getExtensions(file.type)` for a file with
an empty name. Both now call `getDocumentExtension`, which reverses
`DOCUMENT_MIME_MAP` in `@ranuts/shared/document-utils`. For every supported
format it returns the same extension `getExtensions` did, except `ppt`:
`getExtensions` answered `pot`, which is not in `DOCUMENT_TYPE_MAP`.

## Tests

`test/e2e/editor-startup-payload.spec.ts`:

- The editor's startup scripts contain no string unique to ranui's select chunk
  (`ran-select-dropdown-option`).
- On a fresh editor, `customElements.get('r-select')` is undefined until the
  assistant opens. After the settings view opens, it is defined and a select is
  visible.
- Neither page's startup scripts contain a string unique to the MIME table
  (`application/vnd.lotus-approach`).

`test/unit/document-utils.test.ts`: every supported extension round-trips
through `getDocumentMimeType` → `getDocumentExtension`, and a MIME type outside
the document formats gives `''`.

Reverse validation, each run against a variant with one fix undone:

1. With `import 'ranui/select'` back in `index.ts`, both select cases fail
   (`ranui select is in …/panel-viewport-*.js`, and the element is defined
   before the assistant opens).
2. With `getExtensions` back in `lib/converter.ts`, the editor case fails
   (`ranuts mimeType table is in …/document-*.js`).
3. With ranui and ranuts back at 0.5.1, both pages' cases fail
   (`ranuts mimeType table is in …/utils-*.js`).

With all fixes in place: `lint:ts`, `format:check`, all 252 unit files (6817
tests), and 82 E2E cases pass. The E2E cases cover startup payload, entry
paths, the filename matrix, app smoke, the main site, history, the language
menu, assistant layout and workspace, and the embed API.

One full unit run failed on two tests under machine load:
`agent-artifacts-view` and the 8.9 s `wllama-bounded-file-read`. Both pass on
their own, and they passed in a second full run.

## CI race in the select case

The first CI run failed this case on `E2E (Docker image) shard 1`, with no
visible `r-select` in settings. With no saved model, the panel checks the local
model cache asynchronously and switches itself to settings when nothing is
cached (`lib/agent-plugin/ui/panel.ts`, the `externalEntry` block at the end).
The gear button toggles. When the check finished before the click, the click
toggled the panel back to chat. Forcing that ordering locally (waiting for
`data-view="settings"` before the click) reproduces the CI error exactly.

The case now waits for the cache summary to settle, then presses the gear only
when the panel is not already in settings, as `agent-portal-layer.spec.ts`
does. With the same forced ordering it passes, and 40 repeated runs of the spec
pass.
