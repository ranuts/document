# Contextual HITL Implementation Plan

> Execute inline using executing-plans and test-driven-development. User explicitly requested continuous implementation and regression; no further scope approval is needed.

**Goal:** Make editor review contextual, adjustable and traceable without weakening execution guards.

**Architecture:** Editor targets provide bounded immutable review snapshots. A shared presentation model renders text or cell changes; actions rebuild validated plans when revised. The chat panel retains pending proposal context independently from executed tool history.

**Tech Stack:** TypeScript, ranui, Vitest, Playwright, existing OnlyOffice bridges.

**Spec:** docs/superpowers/specs/2026-10-11-contextual-hitl-design.md

## Global constraints

No SDK archives, dependency upgrades, model defaults, deployment, CSP or persistent executable plans. Keep readonly, version/selection guards and native Undo. Never commit local private paths. Unknown navigation/history APIs remain unavailable until verified.

## Review focus

- Formula values and empty cells must not be confused with unknown snapshots.
- Editing a stale proposal cannot revive execution permission.
- Completed details must not expose active apply/cancel controls.
- Follow-up proposal context is unexecuted, never a successful tool result.
- Oversized input and table ranges remain bounded without truncating execution silently.

## Tasks

### 1. Review snapshots and validated revisions

Files: document-tool-action.ts, reviewed-action.ts, new ui/change-review.ts; corresponding unit tests.

- [x] Write and run failing tests for formula snapshots, sampled ranges and immutable revisions.
- [x] Define ChangeReview with text before/after or cell rows (address, old value, formula, new value), total count and completeness.
- [x] Add target getReview(plan), action review snapshot and revise(text) returning a newly parsed one-shot action bound to the same target.
- [x] Run focused tests and type check.

### 2. Contextual review UI

Files: ui/action-preview.ts, styles/assistant.css, shared i18n types/messages, agent-action-preview tests.

- [x] Write failing tests for completed details, editing/cancel/save, stale edit and literal safe rendering.
- [x] Render accessible text differences and cell comparison tables, operation-specific summary and bounded samples.
- [x] Add draft editor only to supported text proposals; preserve invalid drafts and restore focus on Escape/cancel.
- [x] Keep completed records expandable with no executable controls; distinguish sent, verified, failed and expired.
- [x] Run focused tests and type check.

### 3. Conversational refinement

Files: ui/panel.ts and new ui/proposal-context.ts; corresponding tests.

- [x] Write failing tests for pending refinement vs new task, cancelled/expired targets and executed proposal exclusion.
- [x] Retain latest pending proposal context before invalidation; supply a bounded explicit unexecuted proposal to refinement requests using existing generation and editor capabilities.
- [x] Keep new requests bound to current editor context and prevent old target reuse after editor changes.
- [x] Run focused tests.

### 4. Integration, navigation and verification

Files: existing write-tools E2E, design/verification docs.

- [x] Verify native target navigation and history ownership interfaces before adding controls; record limits where unsafe.
- [x] Test Word, Excel and PPT approval/edit/readback/Undo, cancel/expiry and narrow layouts in real editor.
- [x] Run whole unit suite, format, lint/type checks and build; review privacy and diff.
- [x] Independent final review and fix findings with regressions.

## Execution ledger

2026-10-11: inspected existing flow and accepted design. Current feature branch reused. No product code changed before task tests. No commits/push in this phase unless requested.

2026-10-11: contextual review, direct text editing, conversational proposal context, inert completion records and seven-language copy implemented. Independent review found and fixed additive-anchor diffs, superseded states and refinement shortcut bypass. Refinement retains the original operation.

Verification: 163 unit files / 4,886 tests passed; latest real-editor write suite 8 passed; broader format/product suite 25 passed earlier in this phase. Final prompt reorder passed all 114 planner tests and TypeScript checks. Production build exercised by write E2E. Native browser keyboard approval wrote the manually corrected winter sentence; independent text readback matched, and one native Undo restored blank content. Privacy/diff/format checks run before final delivery.

Model qualification remains separate: actual default Qwen3 1.7B sometimes routes exact insertions as chat; existing literal command grammar now bypasses that semantic choice. Refinement initially changed tool, then copied old content; operation restrictions and prompt ordering fixed the former, but the final real-model sample still omitted unchanged words. Human editing corrected the proposal before approval. This sample fails model quality acceptance; do not equate controlled-provider E2E success with reliable natural-language model behavior.

Navigation and per-task Undo deliberately unavailable after API audit: target positioning may change selection, and native history ownership cannot safely distinguish subsequent user edits. Text comparison is not rich layout rendering. No live screen-reader certification performed. Current implementation is complete within this HITL scope; production model quality remains an explicit limitation, not a passing claim.

Layout follow-up: pending review uses an open section with a single separator, transparent comparison content and compact text actions. Completed records collapse into plain expandable rows. Primary apply/save actions retain emphasis; input fields retain their focus indicators. Browser inspection confirmed the 320px sidebar layout, and the latest targeted regression passed 4 files / 133 tests. Changes remain uncommitted.

Refinement follow-up: the prompt now isolates parameter revision from task routing. Both schema and returned-plan validation retain slide action type and spreadsheet sum read/write behavior; expanded sum ranges retain the previous output destination. Planner regression passed 117 tests. Real Qwen3 1.7B revision results remain mixed: the English red-to-blue sample preserved the sentence, but Chinese autumn-to-winter incorrectly produced summer. Neither proposal was applied; model quality is still unqualified.

Cross-editor follow-up: review targets now display worksheet/range/output address or localized slide number instead of hard-coded product/format labels. Generic text suggestions and clearing use document scope without duplicate labels. Five target-display regressions and the legacy text-path regression were reproduced before repair. A real CSV import now exercises pending old/new values, confirmation, neighboring-cell preservation and one-step Undo; presentation review also asserts slide number. Latest editor write/format parity/CSV encoding run passed 18 tests; targeted routing/review unit run passed 160 tests after rebuilding shared exports.

Format routing audit found that getDocumentType omitted ODT, RTF, TXT, ODS and ODP while the canonical import map included them. Five failing cases reproduced this discrepancy. The function now uses the existing canonical map, preserving unknown-format rejection. This verifies classification, not full AI editing acceptance for every imported legacy or alternative format. PDF-specific AI context and page notes are covered by the follow-up below. Presentation visual layout comparison remains outside the implemented tool capability set.

PDF follow-up: users can ask about selectable text on the current page and review a note for a specified page before adding it. Reading preserves their selection; results retain their page scope and do not imply whole-file reading. Selected-text transformations produce copy-only replies, never Word body replacements. Page notes use the native PDF transaction and explicit page index, with document/history/page guards, readback and one-step Undo. Native callback failures cancel and finish the action so partial notes roll back and subsequent editing remains usable. The PDF desktop left rail now exposes the same assistant entry.

Product documentation: all seven assistant guides, help pages and README summaries describe actual file-specific capabilities in ordinary language. They explain current-page reading, scanned-image limitations and page notes rather than body replacement. The Persian README also includes the PDF scope. Removed obsolete task-button instructions.

Final verification: 165 unit files / 4,915 tests passed with four workers; TypeScript, lint, formatting and production build passed. Twenty cross-editor cases passed. PDF follow-up additionally passed five real-editor cases including save/reopen, cancellation, copy-only text, injected partial-write failure/recovery, Undo and readonly export. The final two-case PDF run also verified adding a note to page two while viewing page one, Undo and save/reopen persistence. An earlier unconstrained full-suite run hit an existing five-second file-read test timeout during parallel builds; the isolated full rerun passed without changing test timeouts. Controlled provider responses test host behavior, not production model semantic quality. Default Qwen3 1.7B quality remains unqualified.

Current-code model acceptance follow-up: loaded cached Qwen3 1.7B in a fresh Word editor session after the PDF changes. Synthetic request “请在这份文档里新增一句：春天来了，小河边开满了花。先给我看看，不要直接写入。” returned the requested sentence plus an unsolicited summer sentence. This fails content fidelity; it did not modify the document. Asking whether the actual document contained text correctly returned an empty-document answer rather than treating chat as file content. A separate request “在光标处插入文字：春天来了，小河边开满了花。” produced a preview containing the entire instruction prefix, another content-fidelity failure. Refinement “把建议里的‘春天’改成‘冬天’，其他文字保持不变。” returned the unchanged suggestion and superseded the previous preview. This is an unmet refinement requirement, not a success. Cancelled the suggestion. Independent document text readback returned only a paragraph newline; no mutation occurred.

Next investigation: preserve the pending proposal until a revision has a meaningful validated difference, and avoid displaying an unchanged model response as a revised suggestion. This is a proposal-lifecycle issue shared by every editor, separate from the model’s inability to perform the requested semantic edit. Do not extend literal-command regexes to make these held-out phrases pass. The model acceptance gate remains open.

Refinement lifecycle repair: the original pending review now survives generation, unchanged output, failed revision and stopped inference. Its approval/edit controls are temporarily disabled during generation; cancellation and actual editor changes still revoke it. A candidate replaces it only after operation/argument validation and target checks. Identical validated parameters are reported as unchanged in all seven locales, not as a new review. If the target changes while an unchanged response arrives, feedback says the suggestion expired rather than claiming it remains usable. Product guides describe this behavior without implementation terminology.

Verification: six initial regressions reproduced unchanged proposals and the missing generation lock before repair; the changed-target/unchanged-response case was also reproduced before its correction. Final full unit suite: 165 files / 4,923 tests passed. Native editor run passed ten other CSV, Excel, presentation and PDF cases; the extended Word case passed its final rerun, covering unchanged output, failed adjustment, successful retry, actual write, compact completion record and one-step Undo. The Word test originally changed selection during its intermediate readback; it now reads native character data without moving selection. An expected failure message assertion also accounts for the existing Restore request button. Production build, TypeScript and lint passed; diff and added-content privacy checks passed.

Remaining acceptance: default 1.7B model semantic accuracy is still unqualified. The readiness-footer observation was investigated and repaired in the follow-up below. Changes remain uncommitted.

Readiness follow-up: reproduced three failing cases for connected editing services, cloud offline changes and local-service editing offline. The footer had excluded tools from endpoint readiness and endpoint form changes refreshed Send without refreshing the footer. Readiness now reuses the existing service selection decision, updates on task/destination/connectivity changes and after turns, and does not imply an available local destination solely because the last task was an editing task. Connected-service editing, offline local services, cloud offline/online transitions and disconnection now report the same availability as Send. Panel tests passed 80 cases; full unit suite passed 165 files / 4,926 tests. All nine real-editor write regressions passed, including the formerly contradictory footer after reviewed Word writing. No model-accuracy claim follows from these controlled-provider checks.

Coverage audit: the canonical supported map contains 13 formats (DOCX, DOC, ODT, RTF, TXT, XLSX, XLS, ODS, CSV, PPTX, PPT, ODP, PDF). Current assistant execution evidence covers the native Word, spreadsheet/CSV, presentation and PDF adapters. Existing OpenDocument/text format suites verify import/save/export, while the legacy binary corpus suite requires an explicitly supplied corpus and is skipped otherwise. Classification tests do not establish assistant read/write/Undo acceptance for every imported format. Follow-up must close that format-specific evidence gap using synthetic or public test documents rather than private user files.

PDF final follow-up: reran both native PDF assistant cases after the readiness repair; both passed, covering page-scoped reading, review, cancellation, partial-failure rollback, Undo and saved-note persistence. Localized the assistant-guide links in all six non-English help pages. Added-content privacy scan found no local paths, personal username or token-shaped secrets.

Final readiness/PDF checks: TypeScript exited successfully; documentation regression passed 2,507 tests; formatting and diff checks passed. The production build completed successfully. Changes remain uncommitted.

Imported-format acceptance follow-up: shared the existing ODF fixture builder and added five actual assistant cases for ODT, ODS, ODP, RTF and TXT. Verified request grounding, pre-confirmation non-mutation, reviewed native writing and exact restoration with one Undo. All 11 combined imported-format assistant/import/save/PDF-export cases passed. A test-provider schema mismatch initially rejected ODS writing; captured response proved the wrong field, and the final full rerun passed after fixture correction. Legacy DOC/XLS/PPT and real-model quality remain open acceptance requirements.

Imported-format checks also passed TypeScript, targeted lint, formatting, diff and added-content privacy checks. The final E2E run built the production bundle successfully. Public LibreOffice regression directories were inspected as a possible source for genuine legacy binaries; no legacy-format acceptance result is claimed yet.

Legacy-format acceptance follow-up: pinned three genuine public LibreOffice DOC/XLS/PPT regression files, checked their compound-file signatures and SHA-256 and kept binaries in ignored test output. Added a reproducible opt-in fetch script and explicit corpus configuration. DOC and XLS reviewed edits passed. The PPT fixture proved an actual placement limit: reserved title/body/footer boxes leave no safe area for a new box, so the attempted insertion rolls back without history changes. A follow-up on the same file selects the existing title, reviews replacement, reads the exact result and restores all original slide text with one native Undo. This passed without weakening placement protection. The public corpus's deeper import/save/edit/PDF-export/readonly run passed all three files with zero findings. Default model quality remains a separate open gate.

Final current-code imported assistant run passed all eight cases, with no legacy skips. Public fixture fetch verification, targeted lint, format/diff and privacy checks passed. Production bundles were built for the actual editor runs. No commit or push in this phase.

Final TypeScript check exited successfully after the last PPT regression update.

Candidate evaluation started: selected the existing Qwen3 4B preset in an isolated empty Word test document and began browser loading. Progress advanced from 0% to 15%; no load completion or quality trial result exists yet. The test device has 16 GiB physical memory; the UI estimate is 3.43 GB of model VRAM, not measured total process memory. The source default remains Qwen3 1.7B. The research document now fixes repeated trials, native-state grading and seven-language content-fidelity requests following Anthropic evaluation guidance. Formatting, diff and documentation privacy checks passed. No commit or push.

Qwen3 4B completed loading and was evaluated in the real product UI. Exact Chinese insertion and spring-to-winter refinement each passed all three fresh trials, with independent native readback proving no unapproved mutation. The separate preview-before-writing wording failed all three trials. One general planning prompt clarification failed its actual retest and was removed. Recorded both successes and failures in the research document; no default promotion or accuracy acceptance. The candidate remains cached for the remaining seven-language and cross-editor trials.

Seven-language Qwen3 4B first trials finished: English/German/Spanish/Korean/Portuguese exact proposals and EUR-only revisions passed; Chinese preview returned no readable text; Japanese revision returned unchanged content and retained the original suggestion. All unapproved suggestions left the actual document empty. User-visible transcripts saved in ignored evaluation output. This is partial model evidence, not qualification; repeatability, localized bodies and cross-editor trials remain open. No default change.

Cross-editor 4B follow-up: one real Excel trial produced exactly 1 through 10 in A1:A10 after approval, independently checked through CSV export; one Undo restored the original blank export. One real PPT trial added one slide after approval, independently checked through PPTX XML counts 1 → 2 → 1 across Undo. Switching native editor types on the same page retained the loaded model. These are first trials, not repeated quality acceptance. PDF candidate trials remain open.

Slide review repair: add/duplicate operations no longer expose JSON parameters in the content section; seven localized descriptions retain the existing target and review lifecycle. Red: two new unit cases failed with raw JSON. Green: all 21 preview tests passed. Full unit suite passed 165 files / 4,930 tests; TypeScript and targeted lint exited successfully. The new controlled-provider PPT E2E passed, proving plain-language review, no pre-approval mutation, actual addition and one-step Undo. No default-model change, commit or push.

Final current-code native regression passed all 12 cases across Word, Excel/CSV, PowerPoint and PDF after the slide-review repair. Production build completed for the run; targeted lint, diff and added-content/untracked-text privacy checks passed. These cases use controlled responses and validate application execution, review and Undo; real model qualification remains open.

Actual 4B PDF first trial: exact page-one comment was reviewed, approved and exported. Independent PDF parsing proved note counts 0 → 1 → 0 across Undo, exact comment content and unchanged page text/count. The separate budget question failed the requested answer shape: the application returned the entire read result. Current read-only planner handling renders raw tool output without answer synthesis. Follow-up must implement a bounded grounded answer after read tools across editor types, with native results as evidence and existing abort/context boundaries. This remains open; model quality is not qualified.

User-directed model preset change: browser GPU selection now contains only Qwen3 4B and defaults to it; former 1.7B/2B/0.8B presets remain discoverable solely for confirmed cache deletion, with no Use action. Retired saved presets and task bindings fall back to 4B; custom sources are preserved. Updated the model-preparation script and all seven product guides. Regression first reproduced preset/default/migration/cache behavior before repair. Final targeted run passed 120 cases; full unit suite passed 165 files / 4,931 tests; all 12 native editor cases and their production build passed. This follows the user's product choice, not quality acceptance. The grounded read-answer gap and repeated multilingual model trials remain open. No commit or push.

Default-change final follow-up: TypeScript initially caught an accidental GPU-only cache condition copied into the CPU cache loop. Restored the CPU loop and added a cached-custom-CPU-row regression; its Use/Delete actions remain available. Final targeted tests passed 121 cases, full suite passed 165 files / 4,932 tests. The type-check rerun is tracked separately until it exits; no success inferred from an empty log.

The final TypeScript rerun exited successfully after the CPU-loop restoration. Formatting, diff checks and added-content/untracked-text privacy checks passed. This model-preset change is verified; broader model quality and read-result answer synthesis remain unfinished.
