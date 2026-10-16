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

## Follow-up: reduce visual weight

User confirmed that nested cards and outlined controls consume too much space. Follow the flat document/workspace direction: reserve a single input boundary, present requests and suggestions as unboxed rows, use typography and section spacing for hierarchy, and preserve a single emphasized apply action. Keep safety review, accessible focus and explicit secondary disclosures.

- [x] Add browser assertions for transparent queue, draft and review surfaces; confirm existing cards fail.
- [x] Remove outer/nested preview surfaces, queue tray, boxed welcome actions and secondary control borders. Keep useful content width and comfortable touch targets.
- [x] Inspect real-editor light/dark, empty, queued, restored draft and review screenshots, including long content and narrow widths.
- [ ] Run relevant browser/unit/type/format checks and append a commit to PR #274. Investigate any CI failures in the same PR.

Follow-up verification: eight real-editor visual/interaction tests passed after flattening; 126 preview/chat/task-entry unit tests passed. Type/lint, format and build passed. The previously failing CI open-retry case passed in two independent local runs; retain its strict assertions and verify the next CI run. Also corrected welcome-action selector specificity and replaced separated focus rings with one contiguous input boundary.

## AI workspace follow-up

User approved compact input, collapsed queue and focused result actions, and asked to audit error recovery. Primary references are document AI editing (Word Copilot/Notion AI), persistent artifacts (Claude) and review/recovery (Cursor). Preserve document scope and approval; do not promise steering when the runtime only queues.

- [x] Composer: one-line minimum with bounded multiline growth, including narrow/mobile layout; preserve drafts and keyboard/IME behavior.
- [x] Queue: collapsed count/state disclosure, persistent user expansion while requests advance, Escape/focus behavior, reset on conversation switch or a fresh batch. Keep Resume reachable and retain original requests.
- [x] Results: write actions become clear status after settlement; retry remains actionable and copy remains independent. Avoid disabled primary controls masquerading as available actions.
- [x] Errors: classify known service/network/resource failures into localized actionable guidance without exposing private endpoint/server details. Retain guarded generic fallback and verified-change accounting.
- [ ] Add regression tests before implementation, inspect real AI task states in light/dark/narrow layouts, run full checks and append commits to #274. Verify remote CI.

### Architecture assessment and scope

Verified code owners: `request-queue.ts` owns volatile ordering/cancellation/application leases; `request-queue-view.ts` owns disclosure/focus/presentation; new `request-queue-controls.ts` binds current chat, draft recovery and prerequisite preparation. `panel.ts` retains execution and document scope coordination. `ChatView` remains generic and owns draft sizing and message actions. `ActionPreview` remains the only live document review/action owner. New `request-error.ts` classifies known provider failures without rendering raw response bodies; `presentation.ts` localizes safe categories and existing capability guidance.

The simplest workable architecture is to retain these existing owners and extract the queue binding already embedded in the panel. No new state framework, provider abstraction, storage contract or shared package is introduced. Compatibility red lines: no automatic writing consent, connections or retries; retain request provenance and review ownership; copy uses original content; unknown errors cannot disclose endpoint/key/response details; all seven locales remain complete.

AI interaction references and findings:

- Word Copilot: [edit and rewrite](https://support.microsoft.com/en-gb/word/copilot/edit-rewrite-content) makes scope explicit and distinguishes replace, insert and regenerate. Apply this to review labels and outcomes rather than a generic Send action.
- Notion AI: [document workflow](https://www.notion.com/help/guides/notion-ai-for-docs) separates selection editing, inline drafting and workspace tasks. Keep task scope beside the compact composer rather than duplicating source content in nested cards.
- Claude: [Artifacts](https://support.claude.com/en/articles/17153992-what-are-artifacts-and-how-do-i-use-them) separates the conversation from an editable persistent outcome. Our existing native document canvas already owns that outcome; avoid another nested canvas in the assistant.
- Cursor: [review](https://docs.cursor.com/en/agent/review) and [checkpoints](https://docs.cursor.com/en/agent/chat/checkpoints) expose changes and recovery. Preserve host-verified review receipts and native Undo, without promising broader version restoration.
- GitHub: [steering and queueing](https://docs.github.com/en/copilot/how-tos/copilot-sdk/features/steering-and-queueing) documents two different semantics. Our runtime is sequential queueing; collapsing its presentation must not imply mid-turn steering.

Connector evaluation: AI execution destinations and reference sources are different concepts. Existing endpoint settings/connection lifetimes already own model services; current document context owns references. Future external connectors need scoped authorization, source identity/citations, invalidation after disconnect and explicit read/write capabilities. The user subsequently expanded this PR to include local/MCP references, an optional Google Drive connector and persistent artifact versions, delivered in stages. These additions must retain the same quiet document AI interface.

Favicon scope: only light/dark tab SVGs and matching 32px fallbacks become transparent; keep filled PWA installation icons intact. Raster output is regenerated from checked-in vectors using `bin/build-app-icons.mjs`, with browser pixel tests for both formats.
