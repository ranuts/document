# Runtime and storage optimization design

The user approved implementing every finding from the project audit and creating a PR. This is an architectural maintenance change across existing browser flows, with no new product dependencies.

## Evidence and scope lock

| Assumption                                                                  | Evidence                                                                                      | Status                    |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------- |
| All emitted JS/CSS/WASM are precached even with AI disabled                 | bin/offline-assets.mjs:6; public/sw.js:270; production manifest: 108 files / 57,481,875 bytes | Verified source and build |
| History reads clone all retained snapshot bytes                             | lib/history/store.ts:129,368                                                                  | Verified source           |
| Context polling continues after close/disable                               | lib/agent-plugin/ui/panel.ts:250,276,900                                                      | Verified source           |
| Every conversation update clones and writes all sessions                    | lib/agent-plugin/ui/sessions.ts:45,59; conversation-db.ts:156                                 | Verified source           |
| Current jsdom rejects synthetic iframe mounting and clears remembered focus | audit minimum reproduction and two failing tests                                              | Verified runtime          |
| Type checking can read old workspace declarations                           | initial TS1345; successful lint after package build                                           | Verified runtime          |

Allowed: bin/offline-assets.mjs and declaration, vite.config.ts, public/sw.js and public/sw-register.js; lib/agent-entry.ts and a new assistant-offline module; lib/history/{store,db,types}.ts; lib/agent-plugin/ui/{panel,sessions,conversation-db}.ts and extracted UI modules; package.json scripts; relevant unit/E2E tests and their build configuration; this design/plan and related CLAUDE guides. The root checkout's pending dependency upgrades remain outside the PR.

Untouched: editor vendor binaries/scripts, model artifacts, provider defaults, cloud routing, embedding protocol, unrelated workflows. No new third-party dependency.

Compatibility red lines: preserve offline document reopen and first offline save after online editor initialization, all three editor formats, model reuse offline after explicit setup, saved conversation opt-in, cancellation and stale-tab conflict/erasure protection, existing history revisions and metadata accounting, public panel exports and BFCache restoration.

## Design

1. Derive core and assistant offline manifests from the emitted Vite dependency graph. Core includes editor/history/static dependencies and the small assistant UI static graph, protecting old live-page lazy UI imports; assistant roots and their transitive runtime assets are prepared following explicit assistant enablement, including a persisted opt-in. A build-owned prepared marker makes later workers refresh the optional graph before activation for already prepared users. A worker message prepares optional assets without blocking core activation, ignores external URLs/model weights, acknowledges errors, and preserves response isolation. Existing vendor precache remains for first offline document export.
2. Read the latest document revision with a reverse bounded cursor. Trim using keys and small revision metadata; migrate old snapshots transactionally, without reading every document's bytes into memory. Keep seven-day/three-revision rules and atomic cancellation.
3. Coalesce queued conversation saves before creating a snapshot. Persist per-session records with an atomic revision/index record; migrate v1 saved state on database upgrade. Keep repository interfaces, explicit opt-in, revision tombstones and conflict behavior.
4. Extract context synchronization and focused panel settings/history presentation modules. Use SDK selection/content notifications and native editor input events; refresh only on changes while enabled, open and visible. Discover late SDKs on document readiness, unregister on editor replacement/pagehide, and restore after BFCache. Sidebar entries follow iframe load, rail DOM changes and media-query notifications; pending previews invalidate through the same event lifecycle. No periodic assistant UI polling. No broad rewrite of request semantics.
5. Repair test fixtures while preserving assertions. Rebuild workspace declarations before type checks. Tighten application-owned coverage gates where meaningful, retain vendor/E2E exceptions, and correct stale shared guide statements.

## Simplest alternative

Keep the current editor/vendor offline contract and only defer assistant resources, instead of adding an offline preparation product screen. Keep storage APIs unchanged rather than exposing new repository contracts. Coalesce writes and use revision metadata before considering OPFS document storage. Extract existing responsibilities without replacing the panel or adding a framework.

## Acceptance

- No inference WASM/large runtime in the mandatory precache; explicit preparation restores assistant offline assets. Verify build-manifest and actual worker handler tests plus browser offline flow.
- Latest snapshot returns only its newest bytes; trim has no bulk blob read and accounting remains exact. Verify existing history suite, legacy DB migration, cancellation and bounded-read regressions.
- Burst conversation updates persist the latest state with bounded writes and unchanged sessions are not rewritten. Verify repository/store migration, blocked upgrade, stale-tab and erase race tests.
- All assistant UI states, including visible/open panels and pending previews, make no periodic SDK reads and resume immediately when shown; callbacks clean up across editor replacement/BFCache. Verify scheduler and panel tests plus sidebar E2E.
- Full unit coverage, lint/type checks, formatting, production build and impacted real editor/offline/save/history/sidebar E2E pass. Verify both repository-pinned dependencies and the pending upgraded toolchain where feasible.
- Review branch diff, preserve unrelated root changes, push one coherent commit and create a GitHub PR against main. No merge or deployment.

## Validation refinement

The browser probe confirmed that a landing-only visit does not fully warm the native editor (missing SDK chart/style/image assets). This is an existing distinction from first offline export after editor initialization. Keep that native contract instead of adding a large cold offline vendor download. Optional AI assets must also survive a new build while the panel stays closed; a preparation marker is required, and an already opted-in page may prepare assets without running models.

The assistant UI static graph remains in mandatory core (about 0.42 MiB additional) so a live unsaved old editor can still open its lazy UI after deployment removes the old hashed URL. Large inference graphs remain optional; an already prepared profile refreshes them transactionally during installation.

Legacy remembered opt-in is communicated from landing registration to the installing/active worker. Install rechecks the prepared marker after required caching, closing preparation races with the outgoing worker; activation checks again before claiming clients. Enabled editor pages also prepare the current worker following controller changes and BFCache restoration.

## Follow-up scope: remove assistant UI polling

User request: remove remaining polling. Source verification found periodic context reads, sidebar rail discovery and preview validity checks. The bundled SDK exposes selection, active-sheet, content-modified and undo/redo notifications; the host emits document readiness, and native iframe load/DOM/media notifications cover sidebar readiness and layout.

Allowed files for this follow-up: panel-context.ts, sidebar-entry.ts, action-preview.ts, panel.ts, their unit tests, relevant assistant E2E tests and this design/plan. Preserve exact pre-apply stale-target checks, focus ownership, disable/visibility/BFCache teardown and offline/storage contracts. Automatic save cadence and bounded vendor initialization/font waits remain outside this UI scope. Event bursts use one queued refresh rather than recurring timers. Verify zero idle reads, late editor/rail arrival, compact layout transitions, input invalidation and callback cleanup in unit tests and real editors.
