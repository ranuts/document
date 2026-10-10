# Task-aware local assistant implementation plan

> **For agentic workers:** Use executing-plans to implement this plan in the current session, task by task.

**Goal:** Complete task-specific local model selection, reviewed writing application and reproducible quality acceptance.

**Architecture:** Reuse current providers and editor actions. A pure task resolver selects explicit model bindings; a lifecycle owner loads only the selected binding. The UI owns user preferences and writing review, while evaluations bind actual runtime/model identities.

**Tech Stack:** TypeScript, Vitest, WebLLM, wllama, native editor bridge and Playwright.

**Spec:** `docs/superpowers/specs/2026-10-07-task-aware-local-assistant-design.md`

## Global constraints

- Browser-local default; no automatic cloud or LAN fallback.
- Keep existing general provider consumers compatible and direct explicit editor commands intact.
- A loaded model or passing schema is not semantic acceptance; all quality states require exact evidence bindings.
- Stop never replays an in-flight operation; credentials remain session-only.
- Do not commit models, toolchains, private absolute paths or raw sensitive logs.

## Review focus

- Switching task/model while loading must invalidate the previous request (Task 2).
- A translation language override must not leak into another target language (Task 1).
- CPU fallback must not inherit GPU quality acceptance (Tasks 1–2).
- Applying output after selection/document changes must reject it (Task 4).
- Multi-paragraph negation and actor dependencies must survive chunk boundaries (Tasks 5–6).

## Task 1: Task bindings and quality identity

Files: create `packages/agent-core/src/llm/task-model.ts`, `test/unit/agent-task-model.test.ts`; export through `packages/agent-core/src/llm/index.ts`.

Interface: `resolveTaskModel(request: TaskModelRequest, preferences: TaskModelPreferences, fallback: TaskModelBinding): ResolvedTaskModel`. Tasks: chat, tools, translate, summarize, rewrite. Translation selects language-specific override before task override before fallback. Quality receipts bind backend, model and task/language exactly; arbitrary configuration cannot create accepted status.

- [ ] Write resolver tests for precedence, missing translation target, immutable preferences, experimental default and mismatched runtime receipt.
- [ ] Run `pnpm exec vitest run test/unit/agent-task-model.test.ts`; observe missing behavior.
- [ ] Implement pure resolver and explicit receipt matcher without importing heavy runtimes.
- [ ] Run resolver tests and TypeScript checks; commit after relevant checks.

## Task 2: Settings and lifecycle integration

Files: `lib/agent-plugin/ui/panel.ts`, new `lib/agent-plugin/ui/task-model-preferences.ts`, new `lib/agent-plugin/ui/task-model-runtime.ts`, `test/unit/agent-model-preferences.test.ts`, `test/unit/agent-panel-loading.test.ts`, related locale dictionaries.

Consume Task 1 resolver. Preference version 1 stores non-sensitive model IDs and task overrides; absent settings retain existing global choices. Runtime owns preload/dispose, rejects stale generations, and displays actual model/backend with experimental status. No generation-time fallback.

- [ ] Add failing tests for per-task persistence, old settings, task switch during load and fallback identity.
- [ ] Implement settings controls, serial resource ownership and call-site routing for chat, tools and all writing tasks.
- [ ] Run preference/loading suites; verify real browser task switch and Stop; commit.

## Task 3: Opt-in loopback service

Files: new `packages/agent-core/src/llm/loopback.ts`, tests `test/unit/agent-loopback.test.ts`, task runtime/settings and CSP owner located before mutation.

Interface: local lifecycle provider with explicit service URL/model, native Ollama availability checks, JSON schema generation and cancellation. URL validation accepts loopback only, rejects credentials and non-HTTP(S) schemes. Secrets are not persisted. Preserve existing generic Ollama provider API.

- [x] Add failing URL, missing model, connection, schema, timeout and streaming cancellation cases.
- [x] Implement service adapter and user-initiated settings connection; update exact CSP allowlist.
- [ ] Run tests and real local-service requests if available; retain unsupported evidence honestly; commit.
      Unit cases pass and the settings connection is implemented. **Real local-service
      requests are still unverified** (no Ollama instance was available), so this box
      stays unticked; the CSP needed no change because `connect-src` already allows
      `http:`. See `docs/evaluations/2026-10-10-local-model-writing-scope-decision.md`.

## Task 4: Writing review and editor application

Files: panel, new `lib/agent-plugin/ui/writing-review.ts`, reviewed-action and editor-specific target adapters, related locale dictionaries and tests `test/unit/agent-writing-review.test.ts` plus panel loading tests.

Review object owns original text, proposed body and captured target. Apply consumes once and calls existing verified editor action. Cancel is non-mutating. Word, Excel and PPT targets require exact current selection/source and documented supported granularity.

- [ ] Add failing preview-without-write, cancellation, stale selection, editor switch and double-apply tests.
- [ ] Implement original/result display and Apply/Cancel controls; separate writing from direct tool commands.
- [ ] Verify native undo/redo, Save/reopen across supported editors; commit.

## Task 5: Structured long-document writing

Files: new `packages/agent-core/src/llm/writing-document.ts`, editor source adapters and `test/unit/agent-writing-document.test.ts`.

Represent source segments with document ID, source positions and text. Budget complete serialized requests using provider token counts; avoid arbitrary character slicing. Preserve ordering and paragraph provenance; collect complete output before application. Show partial progress; incomplete output cannot be silently applied as complete.

- [ ] Add failing boundary, oversize paragraph, cancellation, ordering and partial failure tests.
- [ ] Implement structural batching and document-bound source/result mapping.
- [ ] Verify multi-paragraph actor/condition/negation cases with actual models, not just tests; commit.

## Task 6: Unified selection and full acceptance

Files: new evaluation runner/protocol and fresh fixtures under `docs/evaluations`, maintained model decision index, related E2E tests.

Use fixed revisions, runtime/template/quantization/sampling and actual measured latency. Separate deterministic checks from independent semantic review. Cover seven languages × rewrite/summary/translation plus editor operations, fresh holdouts, injection and cross-paragraph dependencies. Register only bounded exact receipt acceptance; do not label an entire model accepted from a narrow case.

- [ ] Add failing runner/report validation tests for wrong identities and incomplete runs.
- [ ] Execute matched comparisons, report language/facts and resource failures; select task defaults only where evidence supports them.
- [ ] Run full unit/type/lint/format/build checks and native browser offline/editor matrix.
- [ ] Audit missing physical devices, privacy and all original goal requirements; leave goal active until proven complete.

## Execution ledger

2026-10-07: User approved design and explicitly requested implementation. Execute inline, without repeating authorization. The initial implementation begins with Task 1; the complete goal remains open. Current code writes Word writing output directly; Task 4 intentionally changes this to the newly approved preview flow.

2026-10-07 implementation checkpoint: Task resolver and browser preset preferences are integrated into the panel. Translation settings are target-language scoped; absent settings preserve legacy global source/provider preferences. Switching a different route invalidates old loading callbacks and awaits existing resource cleanup before a new load. Only known model IDs are persisted in these new settings. Optional loopback bindings, acceptance receipt registration and generic translation-task controls remain pending. Existing lifecycle owner is reused rather than introducing a second runtime owner.

Verification: 145 test files / 4,573 tests pass, including route selection, independent global preferences and stale-load callbacks. TypeScript, changed code lint/format and production build pass. Two existing PromiseRejectionHandledWarning messages remain. Native UI/model and device acceptance are not established by these unit results.

2026-10-10 checkpoint (Task 3 completed, plus the writing-scope narrowing the evidence called for): `LoopbackProvider` is reachable through the factory (`ProviderId` gains `loopback`, which requires an explicit model), exported from `llm/index.ts`, and has connection/timeout/cancellation/tool-refusal/incomplete-response cases. The panel gained a Local service settings block (origin, model, connect/disconnect, status) and an explicit browser-local writing consent. New `packages/agent-core/src/llm/writing-route.ts` decides the writing backend: connected loopback first, browser-local only with consent and marked experimental, otherwise a localized refusal. Settings persist only a validated loopback origin plus a model name. Reverse verification: disabling the consent gate turns both the policy case and (after rebuilding the package) the panel case red. Full checks: 148 files / 4,598 tests, `lint:ts`, `format:check` and `pnpm build` pass.

Not done, and deliberately so: Task 5 (structured long-document batching) remains open; loopback is used for writing only, never for chat or tool calls; no cloud or LAN fallback is introduced. Real-device Ollama connectivity and a real-browser writing run were **not** verified -- no local service was available, so those stay listed as unverified rather than accepted. See `docs/evaluations/2026-10-10-local-model-writing-scope-decision.md`.
