# AI Workspace Craft Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development. Steps use checkbox syntax for tracking. Implement one task at a time; reviewers may work read-only.

**Goal:** Deliver the approved document AI interaction improvements and bounded workspace capabilities in PR #274.

**Architecture:** Reuse queue, provider, ActionPreview and native document owners. Add focused navigation, source presentation and artifact proposal modules; keep generic ChatView host-agnostic. Preserve explicit consent, freshness and offline operation.

**Tech Stack:** TypeScript, ranui design tokens/components, IndexedDB, native Office APIs, Vitest and Playwright.

## Chunk 1: Interface continuity and result actions

### Task 1: Navigation snapshots

Files: packages/chat-ui/src/types.ts, chat-view.ts; new lib/agent-plugin/ui/workspace-navigation.ts; panel.ts view/conversation coordination; unit chat-view/navigation and e2e composer.

- [ ] Add failing tests for caret/selection and scroll restoration, reading while streaming, safe restoration after content changes, and a new conversation with no old snapshot.
- [ ] Run focused Vitest and confirm the missing behavior fails.
- [ ] Implement capture/restore viewport contracts (scroll anchor/follow state plus composer selection), a bounded per-conversation/view owner, and integration that does not steal historical focus.
- [ ] Verify generic ChatView has no source/provider/storage dependencies; test normal/hidden/suspended lifecycle and IME.
- [ ] Run unit/browser regression and commit.

### Task 2: Quiet feedback and staged follow-ups

Files: packages/chat-ui/src/types.ts/chat-view.ts/styles.ts; new lib/agent-plugin/ui/result-actions.ts; panel integration; seven locales; unit chat-view/result-actions; browser result hierarchy.

- [ ] Test copy check receipt and save success/failure/cancel outcomes; do not claim saved after domain cancellation.
- [ ] Test bounded host follow-ups that stage relevant draft text, never send and preserve an existing draft via a visible choice.
- [ ] Implement optional message actions and truthful state labels with keyboard/IME access. Compute suggestions from known host task/result scope, not arbitrary response HTML.
- [ ] Inspect one primary action, secondary text/icon actions, narrow layout and reduced motion. Verify and commit.

## Chunk 2: Understandable sources

### Task 3: Source preview, discovery and citations

Files: connectors/reference-sources.ts, new ui/source-preview.ts, sources-view.ts, request-context.ts and every existing reference consumer; panel/message metadata; Google backend list; seven locales; focused unit/e2e.

- [ ] Write failing tests for source search/preview, safe URIs and captured ids after removal, truncation and citation resolution without arbitrary links.
- [ ] Add explicit local/discovered source search, read-only excerpt details and source limits. Add Drive q search and bounded MCP pagination/continuation with no automatic hidden fetch.
- [ ] Carry source ids into bounded request excerpts and render-time metadata. Resolve clickable citations only against captured references; unknown ids stay plain text. Preserve original response for copy/export.
- [ ] Verify offline, expired connection, canceled reads and all inference routes; browser source preview and source-linked answer; commit.

### Task 4: Standalone document references

Files: new connectors/document-reference-readers.ts and PDF worker adapter; reference-sources dispatch; package exports/dependencies if necessary; UI accepted file types/help; unit malformed/overflow/cancel fixtures; e2e active document preservation.

- [ ] Test DOCX/PPTX XML text order, bounded XLSX cells/sheets and standalone PDF extraction with no createEditorInstance call.
- [ ] Implement safe bounded readers; enforce compressed/inflated/output/page/cell limits and deadlines; lazy-load heavy parsing. Surface unsupported/encrypted/corrupt files accurately.
- [ ] Verify attaching Office/PDF never replaces or edits the current document and offline-ready readers work after assets are prepared. Commit.

## Chunk 3: Artifacts as working results

### Task 5: Artifact revision proposals

Files: new artifacts/edit-proposal.ts and ui/artifact-workflow.ts; artifacts-view.ts; panel/request queue integration; locales; store/view/proposal/routing tests.

- [ ] Test exact selected offsets and full-document draft capture, expectedVersion and content freshness, cancellation, conflict and edits during inference.
- [ ] Add explicit refine input and optional host callback with artifact-origin binding. Reuse prepared provider/queue, no Office tools. Stream a proposal, preview diff, accept into editable draft only after confirmation.
- [ ] Add direct keep-as-new recovery for conflicts and version caps, preserving provenance; no overwrite or automatic version save.
- [ ] Browser selected/full edit, stop, late response and conflict; verify and commit.

### Task 6: Declarative structured artifacts and export

Files: artifacts/store.ts + new payload/export modules; artifacts-view.ts focused renderers; native plan schema/integration for bounded tables/slides; locales; fixtures/unit/e2e.

- [ ] Test old text records, bounded text/table/slides discriminants, invalid schema, atomic conflicts and CSV formula-safe quoting.
- [ ] Add safe structured editors/previews and offline TXT/Markdown/CSV/JSON exports. Reuse existing native review for supported destinations; add a bounded set-range contract only if atomic history grouping and verification are demonstrable.
- [ ] Offer native document export after reviewed application; standalone Office export must use an independent conversion contract, never export the user's current document as if it were the artifact.
- [ ] Verify persistence, no code/HTML execution, offline, narrow layout and generated Office outputs where supported; commit.

## Chunk 4: Native review, location and recovery

### Task 7: Location cues and task receipts

Files: document-tool-action.ts, relevant native history/target owners; ui/action-preview.ts/change-review.ts; new task receipt owner; panel composition extraction; locales; native and browser fixtures.

- [ ] Test exact native target anchors, stale/duplicate content, supported range/page location and cue cleanup without formatting writes.
- [ ] Add capability-based locate/highlight. Keep the main canvas primary; compact task summary/diff, detail disclosure and truthful partial completion counts.
- [ ] Test Undo receipt before/after later user edit, Undo/Redo, document replacement and foreign history point. Implement only exact owned-history recovery, otherwise explain unavailable and preserve user work.
- [ ] Verify actual Word/Excel/slides behavior; no fake highlight or guessed text search; commit.

## Chunk 5: Acceptance and deployment readiness

### Task 8: Integrated acceptance

Files: design/architecture docs, Google deployment guide, targeted e2e and any owners needing review corrections.

- [ ] Reconcile every user request and accepted design item with code/test evidence and external prerequisites.
- [ ] Inspect light/dark/narrow/long/empty/loading/error/partial/canceled/dirty/conflict/offline pages. No nested cards, gratuitous animation or inaccessible icon-only controls.
- [ ] Run pnpm run test:coverage, lint:ts, format:check, build and focused browser suites with isolated outputs. Keep full-run browser/build workloads separate if timing-sensitive unit tests compete for CPU.
- [ ] Push all commits to #274; wait for latest CI; fix failures and repeat. Overall read-only review after CI; preserve explicit limitations in final report.
- [ ] Supply Google Cloud OAuth/Cloudflare setup and live validation steps. Do not claim real login verified while credentials remain unconfigured.

## Binding limits and acceptance map

Structured payload schema version 1 is a discriminated union: text {text}, table {columns: string[], rows: string[][]}, slides {slides: {title: string, body: string}[]}. Tables allow at most 50 columns, 500 rows and 10,000 cells; slides allow 50 slides; each structured table/slide field allows 16,384 UTF-8 bytes; text payloads retain the existing total capacity. The entire serialized payload counts against the existing 128 KiB per-version limit, 20 versions and 50 artifacts. Legacy records read as text without destructive migration. Version copies preserve captured provenance. Reject invalid payloads before any transaction or rendering.

Standalone reference budgets: 20 MiB compressed input, 2,000 ZIP entries, 32 MiB cumulative inflated bytes, 100,000 XML nodes, 10,000 paragraphs, 10,000 spreadsheet cells across at most 20 sheets, PDF 100 pages, 15 seconds per extraction, and 256 KiB UTF-8 final text. Enforce ZIP expansion and parser counts incrementally; do not fully inflate then check. Cancellation/conversation switch must release workers and buffers; test oversized entries, cumulative overflow, deadline and late completion. Clearly reject unsupported encrypted/scanned content rather than claim OCR support.

| Approved outcome                       | Task | Required evidence / fallback                                                                                             |
| -------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------ |
| Keep draft, caret and reading position | 1    | Unit snapshots plus browser view/conversation round trip; clamp changed content safely                                   |
| Quiet copy/save receipt                | 2    | Success/failure/cancel tests; cancel never reads Saved                                                                   |
| Relevant next action                   | 2    | Stages only, existing draft choice, no send                                                                              |
| Captured source excerpt and location   | 3–4  | Captured-id and truncation tests, source preview; unsupported locator shows excerpt/title                                |
| Continued AI artifact editing          | 5    | Selection/full draft freshness, visible diff, explicit acceptance, conflict recovery                                     |
| Structured results and export          | 6    | Bounded schema/legacy round trip, safe CSV, offline exports; native Office output only with verified conversion contract |
| Changed location and compact receipt   | 7    | Verified native anchors/ranges/pages; absent exact anchor shows range/page hint rather than guessed highlight            |
| Safe task Undo                         | 7    | Exact owned history-tail tests; later edit disables Undo with explanation                                                |
| Google connection readiness            | 8    | Unconfigured state and setup guide; real OAuth remains externally pending                                                |
| Minimal visual hierarchy               | 2, 8 | Screenshots of narrow/light/dark/state matrix; single primary action, progressive details                                |
