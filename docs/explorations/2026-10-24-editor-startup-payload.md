# Editor startup payload: two optional modules off the entry chunk

A project-wide audit measured what `/editor` loads before its entry script can
run: the entry chunk plus its whole static import graph (the module script and
the `modulepreload` links Vite writes into `editor.html`). Two optional
modules accounted for about a fifth of it.

## Findings

### WebMCP pulled the whole agent tool layer into every editor load

`lib/web-mcp.ts` imported `getDocumentTextTool` from `lib/agent-plugin/tools.ts`
at the top of the file. Its comment said this "costs nothing in the bundle"
because `editor-bridge` has no imports. That was true of `editor-bridge`, but
`tools.ts` itself imports about twenty tool modules,
`@ranuts/agent-core/runtime` and `marked`. `initWebMcp()` runs on every editor
load, while the tool is only called inside one handler, and only when the
browser exposes `modelContext` (Chrome origin trial).

The import now happens inside that handler. WebMCP and the panel still share
one tool implementation.

### The PWA install element shipped with the entry chunk

`index.ts` imported `@khmyznikov/pwa-install` at the top, yet only mounted the
element from a one-second timer, in manual mode. The import now runs inside
that timer, before the mount.

## Measurements

Measured with `vite build` on main at `37ecc5c5`. The figures are the static
editor graph, summed per chunk from `.vite/manifest.json`.

| Build                    | Entry chunk | Static editor graph (raw) | Static editor graph (gzip) |
| ------------------------ | ----------- | ------------------------- | -------------------------- |
| Before                   | 654 KB      | 1102 KB                   | 350 KB                     |
| Without the tools import | 547 KB      | 995 KB                    | 317 KB                     |
| Without both imports     | 418 KB      | 866 KB                    | 281 KB                     |

Both modules are still precached for offline use. `bin/offline-assets.mjs`
follows dynamic imports from app entries into the core list, so the first
offline open behaves as before.

## Regression test and reverse validation

`test/e2e/editor-startup-payload.spec.ts` reads the module script and
modulepreload URLs from the served `editor.html`. It fetches each one and checks
that none contains a string unique to a deferred module:

- `replace_selection requires a nonempty string`, an error message only `tools.ts` throws (the bare tool name also appears in UI modules);
- `pwa-bottom-sheet`, an element the PWA library defines for itself.

A second case checks that `<pwa-install>` is still defined and mounted.
`webmcp.spec.ts` covers `get_document_text` end to end, through the real
editor.

Reverse validation:

- With both source changes reverted, the payload case failed on the agent tool
  probe.
- With only the `index.ts` change reverted, it failed on the PWA probe in the
  entry chunk.
- The mount case passed both times, since it checks behavior that is meant to
  stay the same.

## Not changed

The audit found several other candidates that were left out of this change:

- **Building once for all CI shards.** The 9 preview and Pages shards each
  build the same output. Sharing one build would put a serial build step in
  front of every shard, so it needs a measurement first.
- **Splitting `lib/agent-plugin/ui/panel.ts`** (3159 lines). This is a
  refactor and needs its own request.
- **Sidebar MutationObserver.** It watches the whole editor DOM while the
  assistant is enabled. The cost is inferred, not measured.

`pnpm run clean:e2e` was added for the `dist-e2e-*` and `test-results-*`
directories that `E2E_PORT` runs leave behind. Nothing cleaned them before;
the audited checkout had 40 of them.
