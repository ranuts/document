# Document reliability implementation plan

**Goal:** Fix editor queue serialization, URL-open result propagation, recovery failure feedback and encoded filenames, then bound remote downloads and reduce assistant panel coupling.

**Architecture:** Preserve public open-command shapes and use rejected promises for failures. Reserve editor queue positions synchronously. Put bounded remote transfer and filename decoding in app-owned helpers. Extract assistant settings view construction and label synchronization behind an explicit interface without changing runtime ownership.

**Scope:** `lib/onlyoffice-editor.ts`, `lib/document.ts`, `lib/converter.ts` (pre-mount currency check), `lib/embed-api.ts`, `lib/events.ts`, `lib/onlyoffice/open-failure.ts` (shared open lifecycle and retry currency), `index.ts` (startup error handling), `lib/history/autosave.ts`, focused new app helpers, `lib/agent-plugin/ui/panel.ts` and extracted settings owner, seven shell locales if new errors are needed, related tests and developer documentation. No vendor patches, dependency changes, provider behavior changes, storage schema changes or visual redesign.

**Evidence:** The original source reproduces two simultaneous queue operations; failed URL fetch resolves and sends `document:opened`; three conversion failures stop recovery without notifying; RFC 5987 names retain encoding. Existing local-source tests require already-mounted documents to finish identity persistence even if a newer open fails. Preserve that distinction from obsolete pre-mount work.

**Compatibility:** Ordinary downloads and legacy embed commands remain supported. URL open errors reject; standalone startup catches after the existing toast. Replacement cancellation must not report success, mount stale data, clear newer loading state or overwrite current source/identity. Original request signals remain effective. Bound decoded streamed bytes, not only Content-Length. Default remote budget: 100 MiB and 60 seconds, including response-body reads; cancellation suppresses standalone error toasts. No model loads or service connections on panel mount.

**Alternatives:** A Promise-chain queue is smaller than a mutex dependency. Focused app helpers are smaller than a global state library. Settings-view extraction is safer than a panel rewrite and preserves request/controller ownership. These minimal alternatives are adopted.

## Chunk 1: reliability and remote opens

- [x] Queue regression: simultaneous callers serialize; failed construction does not poison the next open; long operations never overlap after a waiting timeout. Run targeted Vitest and observe failure before fixing.
- [x] Replace queue implementation with synchronous Promise chaining and non-rejecting queue tail; test public editor mounting behavior.
- [x] URL failure regression: actual fetch failure rejects and embed reports `document:error`, never `document:opened`; standalone decoding fallback does not retry network failures.
- [x] Recovery regression: notify once when three consecutive export failures stop the active session; busy and retired sessions remain silent. Use a distinct localized export-failure message; preserve the storage-quota warning.
- [x] Filename regression: RFC 5987 priority and decoding, quoted fallback, semicolons, URL percent encoding and malformed escapes; preserve caller-provided names.
- [x] Download regressions: declared oversized length, streamed overflow without headers, timeout during headers/body, external abort, response cleanup and normal completion.
- [x] Open currency regressions: superseded URL work must not mutate store/mount/stamp session, including conversion awaiting initialization; local/new/embed replacements cancel remote work. Preserve already-mounted source commits when a newer attempt fails.

## Chunk 2: assistant panel maintainability

- [x] Extract settings view assembly and label synchronization from `panel.ts` into a focused module with explicit element/callback inputs. Do not move request state into the view.
- [x] Add behavior tests for view assembly/source visibility/labels without requiring model initialization. Run existing panel, context, lifecycle and contract suites; adapt only structural contracts that assume the old file location.

## Verification and delivery

- [x] Targeted tests pass after each red-green cycle.
- [x] Formatting and oxlint, rebuilt workspace type checking, full unit suite with coverage, production build and relevant real-browser smoke where assets/tooling permit.
- [x] Review all changed callers and asynchronous ownership boundaries; record exact validation and any environmental limits in PR.
- [ ] One conventional commit, up-to-date main, GitHub pre-check, review, push and create PR, then attach PR to the chat. Do not merge.
