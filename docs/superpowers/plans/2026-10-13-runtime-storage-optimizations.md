# Runtime and storage optimization implementation plan

> For agentic workers: execute the independent domains using dispatching-parallel-agents; the coordinator owns cache integration and final verification.

**Goal:** Implement all audit findings and deliver one reviewed GitHub PR.
**Architecture:** Preserve existing browser APIs and offline editor behavior. Defer optional assistant assets, reduce storage byte copies, and extract bounded UI lifecycles.
**Tech Stack:** TypeScript, Vite, IndexedDB, Service Worker, Vitest, Playwright.
**Spec:** docs/superpowers/specs/2026-10-13-runtime-storage-design.md

## Global constraints

No new dependencies or vendor changes. Preserve first offline save, stored data, explicit cloud/history opt-in, stale-tab conflicts, cancellation, public panel exports and BFCache. Do not include the root checkout's unrelated dependency edits.

## Review focus

- Offline reopen/export after one online editor initialization, with a cold landing that defers inference assets.
- Enabling an already cached assistant offline after reload.
- Database upgrades with old data and another tab open.
- Erasure/cancellation while a save is queued or in flight.
- Hidden panel, replaced editor and BFCache restoration.

### Task 1: Optional assistant precache

Files: bin/offline-assets.mjs, declaration; vite.config.ts; public/sw.js and public/sw-register.js; lib/agent-entry.ts; new lib/assistant-offline.ts; manifest/worker/entry/offline tests.

- [x] Assert the core manifest retains the static assistant UI graph and excludes inference runtime assets and includes static/dynamic editor dependencies.
- [x] Assert explicit worker preparation caches only the local allowlist, rejects failures, and preserves first native offline export.
- [x] Enable Vite manifest; derive graph closures and stamp two asset lists; request optional preparation after explicit enablement.
- [x] Run related unit tests and production build; measure core bytes before/after.

### Task 2: Bounded document history reads

Files: lib/history/{store,db,types}.ts and history unit tests.

- [x] Add regressions rejecting bulk blob reads while returning newest bytes/accounting correctly.
- [x] Implement reverse latest cursor and lightweight revision metadata/key trimming; migrate legacy records as needed.
- [x] Verify retention, quota, cancellation and source/handle cleanup tests.

### Task 3: Incremental conversation storage

Files: lib/agent-plugin/ui/{sessions,conversation-db}.ts and their unit tests.

- [x] Test burst coalescing, unchanged-session writes, v1 migration, stale-tab and erase races.
- [x] Implement a bounded pending save and per-session persistence under atomic index revision, keeping repository API.
- [x] Run the conversation/history controls/controller test suites.

### Task 4: Panel lifecycle and decomposition

Files: lib/agent-plugin/ui/panel.ts; extracted context/settings/history modules; related unit tests.

- [x] Test no hidden/disabled/background polling, immediate resume, SDK callbacks and BFCache cleanup.
- [x] Extract context scheduler and at least two focused presentation responsibilities; preserve public panel functions and request semantics.
- [x] Run all panel/composer/context/sidebar tests.

### Task 5: Quality gates and review

Files: failing iframe/focus tests; package.json scripts; vitest.config.ts; shared/root CLAUDE guides; workflow contract tests.

- [x] Fix synthetic iframe/focus fixtures without weakening production behavior assertions.
- [x] Make type checking rebuild declarations, verify from deleted stale package output.
- [x] Tighten useful application-owned coverage gates and update outdated guide statements.
- [x] Run full unit coverage, lint, format, production build and impacted E2E.
- [ ] Fresh review of the complete diff; resolve findings; commit, push and create PR.

## Progress

- Scope authorized by the user's instruction to implement all audit recommendations and submit a PR.
- Phase 1 branch prepared; PR phases 2-7 pending until implementation and validation complete.

## Implementation evidence

- History: 11 suites / 112 tests passed, including legacy v1/v2 upgrade, bounded reads, exact gapped-revision accounting, blocked upgrade retry and cancelled trim rollback.
- Conversation: 81 targeted tests passed; v2 migration, stale-tab conflicts/erasure and coalescing verified. Full-snapshot validation/serialization remains proportional to input size; unchanged records are neither cloned nor rewritten.
- Panel: 176 targeted tests passed; three modules extracted, panel reduced from 2905 to 2633 lines. SDK bursts coalesce and hidden/disabled/BFCache lifecycles release resources.
- Integrated upgraded-toolchain run: 5360 unit tests passed, coverage gates passed (85.39% lines, 79.84% branches), 34 impacted Chromium E2E passed.
- Default app precache: 1,453,207 bytes (~1.39 MiB), down from 57,481,875 bytes (~54.8 MiB); optional inference runtime: 56,063,311 bytes (~53.47 MiB). These are decoded/build file bytes, not network transfer measurements.
- Fresh converter declaration output was moved away before running the type-check script; the script rebuilt packages and passed.
- Independent review found and fixed prepared-runtime update migration/races. Final scoped review reports no unresolved Critical/Important findings.
- The first browser probe assumed a landing-only visit fully warms the editor. Missing native vendor assets disproved that assumption; the acceptance flow now initializes the native editor online before offline reopen/export, preserving the existing contract.

Final pinned-toolchain verification: 179 unit files / 5360 tests passed with coverage gates; 34 impacted browser cases plus the isolated worker-update case passed (35 total). Lint/type/build/format and fresh-declaration checks passed. The same pinned update case also passed against unmodified main. Upgraded Playwright update timing remains inconsistent in local probes; dependency updates are outside this PR.

## Follow-up: event-driven assistant UI

- Replace panel context intervals with disposable SDK/native-input subscriptions and explicit readiness/open/visibility notifications.
- Replace sidebar rail scans with filtered DOM/iframe-load/media-query observers.
- Replace pending-preview validity intervals with the context event lifecycle; preserve pre-apply validation.
- Refresh model release controls and translated context explicitly from existing runtime/language updates.
- Verify focused no-polling regressions, full quality checks, real editor sidebar/selection interactions, review and update PR #266.

Follow-up verification: 5378 tests across 179 files pass with coverage gates (85.51% lines, 79.90% branches); lint/type checks, format and production build pass. Twenty impacted assistant Chromium cases pass, including three new event-driven cases; the final rebuilt three-case suite additionally verifies a native sheet rename and same-selection history mutation. Independent read-only review found missing spreadsheet mutation/sheet notifications, now covered and rechecked. The tracking fixture models SDK multiple-listener ownership and checks complete pagehide cleanup. No recurring timers remain under lib/agent-plugin/ui.
