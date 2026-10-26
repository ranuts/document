# Reliability and Responsiveness Implementation Plan

> **For agentic workers:** REQUIRED: Use subagent-driven-development. Keep functional commits separate.

**Goal:** Repair the five reviewed user-facing defects and improve measured responsiveness in one PR.
**Architecture:** Keep save ownership, view state, conversation storage and conversion execution in their existing owners. Add narrowly scoped worker/view helpers where needed.
**Tech Stack:** TypeScript, ranui, Vitest, Playwright, IndexedDB, browser Workers.

## Chunk 1: Reliability

- [x] Save semantics: `lib/onlyoffice/save-stream.ts`, `test/unit/save-stream-lifecycle.test.ts`. Assert exporting PDF retains dirty state before applying a regular-save-only completion guard. Run targeted tests and commit.
- [x] Open recovery: `lib/ui.ts`, `styles/base.css`, focused unit/E2E tests. Cover hidden/pointer/timer races. Only activate hero layout when present; cancel stale timers and restore input. Commit.
- [x] History view: `lib/history-page.ts`, focused tests. Keep toolbar stable, reject stale responses, prune on initialization rather than queries; validate keyboard focus and results. Commit.
- [x] Chat conflicts: `lib/agent-plugin/ui/sessions.ts`, `history-controls.ts`, locales and tests. Explicit preserve-local recovery avoids repeated conflict and silent data loss. Validate two-store race, persisted restart and current conversation ownership. Commit.
- [x] Speech duration: `lib/agent-plugin/ui/speech-input.ts`, locales and tests. Test healthy results at 59 seconds followed by duration limit. Graceful stop with bounded final-result drain and accurate notice. Commit.

## Chunk 2: Responsiveness

- [x] Spreadsheet worker: `packages/converter/src/spreadsheet.ts`, `document-converter.ts`, new worker/client helper and tests. Read converter rules first. Preserve CSV/HTML/XLSX conversion APIs, source ownership, CSP/static-host/offline behavior. Measure representative input; browser UI responsiveness must improve. Commit independently.
- [x] Conversation persistence: inspect `conversation-db.ts` and `sessions.ts`. Benchmark 100/1000 conversations; apply safe incremental-processing optimization with invalidation tests. Avoid speculative storage migration. Commit independently if measured benefit justifies change.

## Chunk 3: Delivery

- [x] Specification review and source/caller quality review; resolve findings. Final independent agent review was unavailable due to tool-service errors; primary review completed.
- [x] Run focused tests then full coverage, lint/types, format and production build. Only one browser/build runner.
- [x] Real browser acceptance for opening failure, search focus, conversion and assistant flows. Document physical mic/GPU limits.
- [ ] Update changelog and acceptance record. Push functional commits, create and attach one PR. Inspect exact-head checks and repair failures.
