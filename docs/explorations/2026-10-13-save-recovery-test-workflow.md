# Save, recovery and workspace test repairs

Scope: preserve cancellation outcomes, isolate cross-format exports, retire
history file links, avoid duplicate recovery exports, use source in development
and tests, and measure all application/workspace code with module gates.

## Behavior and ownership

- Disk writers return `written`, `cancelled` or `unavailable`. The converter's
  download adapter preserves its underlying boolean outcome. Only a committed
  write/download clears dirty state or updates the recovery row's disk-save time.
- Another format uses a separate picker and never replaces the ordinary document
  target. An initial export is identified by the document store's original format.
  Cancelling or failing an export preserves the original target.
- Document metadata, revisions and handles are deleted in one IndexedDB
  transaction. In-memory links retire on commit, not on an aborted deletion.
  Persisted targets are re-read before saving so another tab's deletion is honored.
  Chosen targets register before asynchronous disk I/O; finishing a write never
  recreates a link deleted while that write was pending. When persistence is
  unavailable, the session-only fallback still works.
- Recovery compares editor frame, undo index, point identity and a captured copy
  of undo-item references. SDK changes can append or replace items without moving
  the point; item count alone is insufficient (for example spreadsheet sliders).
  The signature is captured before export, so changes made while exporting still
  need another recovery point. Unknown SDK shapes retain the conservative cadence.
- Development and Vitest aliases derive from workspace exports, including exact
  and wildcard subpaths. Production still builds and consumes package output.
  Source Worker URLs retain the model Worker response policy.
- Coverage includes `lib` and every workspace `src`, with separate module gates.
  Existing global gates and the seven-day recovery retention remain unchanged.

## Regression evidence

Before production fixes, 12 new assertions failed for cancelled-save dirty state,
format overwrite, persisted/session handle cleanup and duplicate recovery.
A further failing export-write test demonstrated loss of the original link.
Two SDK-history cases demonstrated missed appended/replaced undo items.

Automated checks exercise committed bytes, dirty state, saved timestamps,
IndexedDB keys and recovery revisions rather than mirroring implementation text.
The source-resolution fixture contains deliberately stale compiled exports and
loads current source, exact/wildcard subpaths and an edited source module through
Vite. Chromium tests use real OPFS handles and actual editor exports to verify
cancelled-save warnings, PDF/DOCX isolation, subsequent saves and recovery.

Disabling the workspace source aliases made its Vite fixture load the stale
compiled values and fail. Disabling cancellation and export-target guards made
both new Chromium save cases fail on their intended dirty-state and original-file
assertions; restoring the guards passed both against the production build.

Final validation: 176 unit files / 5323 tests passed; expanded line coverage
85.06%, with all module gates passed. Production build and 10 Chromium cases
passed. Lint, TypeScript and formatting passed. Development Worker responses
returned the model policy on their source URL. The full Docker,
Cloudflare Pages and cross-browser suites remain CI responsibilities.
