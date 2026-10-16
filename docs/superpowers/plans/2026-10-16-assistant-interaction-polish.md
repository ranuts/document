# Assistant interaction polish

Goal: fix repeated setup failures shown in the user screenshots, make pending requests compact and actionable, and highlight literal query matches in conversation titles/snippets. English UI with Chinese requests is expected and must remain supported.

Design: follow existing ranui tokens and component owners. A compact queue above the composer shows count/state, one visible resume action, a primary edit affordance and secondary per-request actions in an accessible menu. Setup requirements are state guidance, not repeatedly appended conversation errors. Never grant writing consent automatically or start inference/service connections without a deliberate user action. Search highlighting uses DOM text nodes and marks, never HTML injection or regular-expression interpretation of the query.

Scope: panel request/readiness gates, queue view and its styles, history-list highlighting, seven locales if wording changes, related unit/browser regressions. Keep queue ordering, retained provenance, request/review ownership, saved-history schema and language settings unchanged. Retain model-free document commands even without a loaded model or writing consent.

- [x] Reproduce naturally routed blocked writing, repeated resume, and persisted empty draft behavior in panel tests before fixing.
- [x] Keep setup failures out of conversation messages; offer one clear settings action and preserve original pending text for later explicit retry. Queue Resume/Send next must lead to preparation when prerequisites are missing.
- [x] Align composer readiness with the actual draft/task; ready chat does not imply consent to generate document changes. Preserve semantic routing for unknown wording.
- [x] Queue: compact readable rows, stable order, primary edit and secondary actions, keyboard/Escape/focus handling, dark/narrow/touch states, no misleading immediate-interruption label.
- [x] History: highlight all case-insensitive literal occurrences in titles and displayed snippets, including Chinese/metacharacters; reset marks on changed/cleared searches and keep existing keyed focus/lifecycle bounds.
- [x] Run targeted red-green tests, full coverage/type/lint/format/build, and browser interaction/layout checks. Inspect representative screenshots.
- [x] Review caller contracts and create a new PR from current main (PR #273 is already merged).

Verification: 5,926 unit tests across 206 files passed with coverage; 15 browser regressions passed, followed by two additional browser runs asserting control geometry and transparent title/progress styling. Type/lint, format and production build passed. Inspected full editor screenshots at 320px in light/dark themes with secondary queue actions open. English UI and Chinese input remain independent.
