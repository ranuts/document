# Assistant Follow-up Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development. One implementation worktree/agent at a time; specification review then quality review for each chunk. Root owns browser/build/CI.

**Goal:** Repair fresh review findings and bound long-conversation work in the existing PR #271.

**Architecture:** Preserve one session/queue owner and existing physical settlement. Add truthful preparation state, an explicit conversation-only path, bounded history presentation, shared search compilation, bounded exact budgeting and content-free local timings. Keep public defaults and persistence intact.

**Tech Stack:** TypeScript, ranui, Vite, Vitest, Playwright, existing WebLLM/Wllama Workers.

## Chunk 1: Queue ownership and preparation

Files: lib/agent-plugin/ui/{sessions,panel,request-queue,request-queue-view}.ts;
test/unit/{agent-sessions,agent-panel-loading,agent-request-queue,agent-request-queue-view}.test.ts;
test/e2e/agent-history-rendering.spec.ts; seven i18n tables/types and assistant.css if needed.

- [x] Add delayed-repository RED: send an unaccepted held-classification first request; restore history; assert its original session remains reachable and the request completes/recoverable without target rebind. Keep accepted-Hello and early unsent-draft controls.
- [x] Run focused test to confirm expected failure. Implement minimal volatile owner preservation and skip destructive same-owner startup rebuild. Test manual restore/delete/opt-out and provider/conversation changes.
- [x] Commit fix(assistant): preserve pending request owners during history hydration.
- [x] Add RED for preparing-entry actions and false occupied feedback. Expose active preparation identity; disable unavailable controls and show real localized state while keeping Stop available. Clear stale feedback after successful recovery/session changes.
- [x] Run focused tests, changed-file lint/format and typecheck. Commit fix(assistant): reflect pending request preparation in queue actions.
- [x] Specification gate then independent quality gate; fix findings before next chunk.

## Chunk 2: Chat and voice continuity

Files: panel.ts, request-intent.ts/request-context.ts or a focused request-scope helper if needed;
speech-input.ts; document-task.ts only for opt-in native preflight deferral; controller.ts only for necessary hooks; relevant panel/speech/context/native registry unit tests;
test/e2e/{agent-request-queue,agent-dictation,agent-stop-resume}.spec.ts.

- [x] RED: Hello and classified ordinary chat continue after document edits; queued pure chat survives irrelevant edits; selected references/PDF/host reads/writes still refuse stale scope. Provider/session/Stop guards remain effective.
- [x] Implement explicit scope policy using immutable enqueue-time ComposerContext (including cell values). Preserve native compatibility without an extra JSON call: only eligible source-free native candidates may opt into pre-tool freshness deferral; actual registry operations stay strict, and first target change permanently promotes output checks. Strip selected source from conversation-only references and validate original targets for document operations after routing, never rebind stale queued writes. Run focused tests/typecheck; functional commit.
- [x] RED: dictate next draft during a held reply; finalize on explicit Send and queue once, preserving current reply. Conversation switch/disable still closes speech.
- [x] Relax only inference-related speech gating, retain lifecycle/permission/finish guards. Focused tests/typecheck; separate functional commit.
- [x] Specification gate then independent quality gate.

## Chunk 3: Bounded search and exact token budgeting

Files: history-search{,-model,.worker}.ts and history-list.ts; test/unit/{agent-history-search,agent-history-list}.test.ts;
packages/agent-core/src/context-budget.ts and llm/wllama.ts; test/unit/agent-context-budget.test.ts and the existing Wllama provider test owner.

- [x] RED: copied repeated whitespace and cross-segment whitespace match in Worker/fallback; prefix is shared once per query; long-query fallback yields and cancellation wins.
- [x] Implement shared canonical query normalization in both list identity and engine, reusable KMP compilation and inner deadline checks. Preserve existing bounded extraction/progress/idle behavior. Focused tests/lint; search functional commit.
- [x] RED: 1000 complete turns retain a fitting recent suffix with a bounded (e.g. <=32) exact-count callback budget; newest-too-large, exact reserved equality, nonmonotonic counts, tool pairs, abort and malformed counts still behave correctly.
- [x] Implement coarse bracketing/refinement, reuse counted fitting results, and return only an exactly verified candidate. Rebuild the Wllama completion request from returned budget.messages and integration-test that a rejected last probe cannot be sent. Focused runtime/provider tests/typecheck; CPU performance functional commit.
- [x] Specification gate then independent quality gate.

## Chunk 4: Bounded restored-message presentation

Files: packages/chat-ui/src/{chat-view,types,styles}.ts; optional focused history-window.ts;
lib/agent-plugin/ui/panel.ts; shared README/CLAUDE; seven i18n tables/types;
test/unit/{chat-view-performance,chat-view-results,chat-view-layout,agent-panel-loading}.test.ts;
test/e2e/agent-history-rendering.spec.ts.

- [x] RED: restoring 1000 messages mounts only the latest bounded window and renders no omitted Markdown; full older history remains accessible in order; source-level last-answer/document getters still work outside the DOM window; a giant restored message uses a bounded preview with explicit full-source expansion.
- [x] Add an opt-in bounded restoration entry point with a localized older-message control; keep appendMany default behavior. Prepend batches without replacing existing message nodes, stealing focus, disturbing a live stream or resetting the draft/viewport anchor.
- [x] Keep an empty welcome at its initial viewport position when the preparation footer grows (no bottom following before any actual message). Test cross-boundary tool groups, nearest-prior-user recovery ownership, lastUserText after prepend, a single oversized turn with <=40 initial rows, copy/interrupted artifact semantics, clear/switch/dispose, reduced motion and keyboard; update old 400-row E2E to explicitly load older rows while retaining all content/action assertions.
- [x] Focused tests/typecheck/lint; commit perf(chat-ui): restore long conversations in bounded windows.
- [x] Specification gate then independent quality gate.

## Chunk 4b: Streamdown-informed streaming Markdown

Files: packages/chat-ui/src/{chat-view,types,styles,markdown}.ts; focused
streaming-markdown.ts helper if needed; panel.ts host opt-in; shared README/CLAUDE;
test/unit/{chat-view-performance,chat-view-stop,chat-view-results}.test.ts and a
focused Markdown streaming suite; relevant stream/browser acceptance.

- [ ] RED: completed Markdown block DOM stays identical while a later block grows; open code fences render progressively; incomplete links stay inert and raw source is unchanged; final output equals ordinary full rendering for tables/lists/setext/reference links/CRLF/escapes.
- [ ] Implement per-stream stable-block reuse and safe unstable-tail presentation with the existing lexer/DOM renderer, frame coalescing and bounded formatting cadence. Preserve legacy defaults via host opt-in; no new dependency or general ad hoc Markdown repair parser.
- [ ] Cap every automatic main-thread lex/render input, including final/reference/interrupted paths; oversized tails stay exact raw text and stable prefix nodes remain. Oversized whole-reference fallback stays raw at completion, with no later uncapped parse. This bounds input rather than promising preemption in 4ms. Verify Stop does no synchronous Markdown parsing, exact partial source/copy-only state/draft/focus are retained and clear/switch/dispose prevent old callbacks. Test arbitrary chunk boundaries, parser failure raw fallback, scroll/selection and unchanged block identity, plus reduced motion.
- [ ] Focused tests/typecheck/lint; separate streaming rendering functional commit. Specification gate then independent quality gate before timings/integrated acceptance.

## Chunk 5: Actual request timing

Files: packages/agent-core/src/llm/{types,webllm,wllama}.ts;
lib/agent-plugin/ui/{controller,panel}.ts; focused request-timing.ts helper;
packages/chat-ui/src/{chat-view,types}.ts for a request-owned first-presentation hook; corresponding provider/controller/panel/ChatView timing tests and acceptance docs.

- [ ] RED controlled-clock tests: raw first model text differs from filtered arrival and actual DOM presentation; hidden/disconnected UI has no presented-time field; routing/context times are measured, missing stages absent; canceled and superseded callbacks cannot publish another turn's timings.
- [ ] Add optional usage fields for actual local context preparation and first-text time; keep provider queue/model-load exclusions explicit. Add small per-request local timing ownership at host/controller boundaries plus an actual flushStream presentation callback, with bounded Performance API diagnostics containing only numbers/status.
- [ ] Verify Hello, routed ordinary chat and selected/PDF/host-read guard behavior. Do not infer backend first-token timing from a visible chunk or expose prompts/keys in measures. Focused tests/typecheck/lint; timing functional commit.
- [ ] Specification gate then independent quality gate.

## Chunk 6: Integrated acceptance and delivery

- [ ] Re-run original Chromium failure probes: slow history + first submitted request, preparing actions, Hello + editor write, Worker/fallback whitespace. Extend dictation with a held answer/queued draft.
- [ ] Measure bounded history initial nodes/task delay and prepend viewport anchor against the same baseline fixture. Verify all older text remains accessible and full model history/export survives.
- [ ] Full units with coverage --maxWorkers=2 (matching CI thresholds); pnpm run lint:ts; pnpm run format:check; pnpm run build. Preserve 1511 immutable archives.
- [ ] Serialized --workers=1 editor regressions including history/composer/context/dictation/process/queue/Stop/writes/PDF; English/Chinese widths and themes. One browser/build owner, no agent full suites.
- [ ] Final overall source review. Update focused docs/changelog and PR description around final implementation, preserving functional commits and pending verdict.
- [ ] SSH push to existing fix/speech-first-permission; inspect exact-head CI via Code Review tool only. Fix any failures with fresh evidence until all checks pass; update final verdict and preview. Do not merge.
