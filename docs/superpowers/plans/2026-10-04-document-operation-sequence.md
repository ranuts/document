# Ordered document operations implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan in the current session. Work stays inline; no delegation is authorized.

**Goal:** Fulfil the reproduced read-then-write request without dropping its read or guessing its write destination.

**Architecture:** Add ordered planning around existing DocumentToolPlan validation, then execute existing DocumentToolAction objects sequentially against one captured target. Each completed step is displayed and archived independently. The first composite recognizer covers complete literal read-then-assignment requests; existing single-request generation remains available.

**Tech Stack:** TypeScript, native editor APIs, current local providers, Vitest and actual Chromium IM probes.

**Spec:** docs/superpowers/specs/2026-10-04-document-operation-sequence.md

## Constraints

No preview cards or redundant confirmation. No cloud inference. Maximum four plans; read-only steps precede one optional final mutation. All plans validate before any editor execution. Preserve origin conversation, abort checks, freshness checks and native Undo/Redo. Do not represent partial completion as whole-request success.

## Task 1: sequence planning

Files: new lib/agent-plugin/document-tool-sequence.ts; new test/unit/document-tool-sequence.test.ts. Import existing parseDocumentToolPlan and generateDocumentToolPlan, LLMProvider and DocumentContext.

- [ ] Write a failing test using a fake provider that returns the previously wrong A1 write. The full literal request must instead produce these exact plans:

```ts
const expected = [
  { tool: 'get_range', input: { range: 'A1:B4' }, readOnly: true },
  { tool: 'set_cell', input: { cell: 'B2', value: '99' }, readOnly: false },
];
```

- [ ] Run `pnpm exec vitest run test/unit/document-tool-sequence.test.ts` and observe the missing implementation failure.
- [ ] Export `generateDocumentToolSequence(provider, request, context, signal, options): Promise<readonly DocumentToolPlan[]>`. Recognize the complete Chinese range-read then literal assignment request. Validate both plans with parseDocumentToolPlan before returning. Accept numeric plain values and explicitly JSON-quoted text; reject formulas and additional suffix operations. Match entire input. For a single request, return `[await generateDocumentToolPlan(provider, request, context, signal, options)]`.
- [ ] Test invalid final cell, formula text, abort, trailing third operation, quoted text containing address-looking data, and the single-request fallback. Assert returned plans and rejection outcomes, not mock call counts.
- [ ] Keep all planning tests green before changing the panel.

## Task 2: ordered execution and complete feedback

Files: lib/agent-plugin/ui/panel.ts, existing document-tool-action tests and agent-panel-loading tests.

- [ ] Add a panel regression: before-read values include B2=30; after the composite request the visible read shows B2=30 and final native B2 is 99. Require both output messages in stored history.
- [ ] Replace the tools-mode single-plan call with generateDocumentToolSequence. Validate sequence shape before applying any action:

```ts
if (plans.length < 1 || plans.length > 4 || plans.slice(0, -1).some((plan) => !plan.readOnly))
  throw new Error('agentToolNotChosen');
```

- [ ] For each plan, check abort, generation and conversation revision, construct a fresh DocumentToolAction using the original captured target, and apply. Format the existing read/status result using current formatting logic; immediately append it to operationHistory and the visible conversation. Continue only after successful completion. Reuse final history ownership in finally.
- [ ] Test failed read prevents write, stale target prevents later write, stop between steps prevents mutation, verification failure yields error without final success, and conversation switch does not put results into another conversation.
- [ ] Confirm a single request keeps existing result behavior and exact destination validation.

## Task 3: actual product acceptance

- [ ] Run root TypeScript, scoped oxlint, `pnpm test`, `pnpm build` and `git diff --check`. Inspect every exit code and record warnings.
- [ ] Clone the actual multiple-region probe into a uniquely named sequence probe. Use current build/native APIs without inference substitution, and remove inherited seed-history Undo/Redo before adding the actual final-write history check.
- [ ] Assert visible A1:B4 pre-write result contains B2=30; after snapshot changes only B2 to 99; A1 remains Name. Undo restores full initial snapshot; Redo restores final snapshot. Require zero preview cards and errors. Record current bundle hash and actual operations.
- [ ] Replay simple range read, multi-region read, SUM and sort when the changed control flow could affect them. Commit only owned paths and preserve diagnostic failures.

## Review focus

Quoted values containing instructions; cancellation after the read; editor/worksheet changes between steps; verification failure after a native write; history ownership after conversation switch. Each is assigned to the tests above. General multi-write transaction support remains explicitly outside this first sequence implementation and open in the broader goal.

## Implementation progress

First literal sequence planner and panel loop implemented; actual read-before-write/Undo/Redo verified in `docs/evaluations/2026-10-04-cpu-count-im-read-write-sequence.md`. Full suite 119 files/4300 tests passed. Sequence-specific cancellation, stale-target, conversation-switch and persistent-history checks remain required; the plan is not marked fully complete.

Cancellation progress: actual immediate-read/Stop race reproduced and fixed by yielding between operations. Stop, new conversation, session switch and changed C1→D1 selection now prevent the subsequent write; uninterrupted execution still succeeds. See `docs/evaluations/2026-10-04-cpu-count-im-sequence-interruption-after-read.md`. Earlier completed-history save/reload/session-switch and oversized-read failure checks also have actual browser evidence. General verification-failure and worksheet/document replacement checks remain; do not mark the full plan complete.

Worksheet progress: native sheet 0→1 switching immediately after the completed read rejects the pending write and preserves both sheets; returning to sheet 0 without interruption changes only original-sheet B2. Evidence: `docs/evaluations/2026-10-04-cpu-count-im-sequence-worksheet-switch.md`. Document replacement and native-write verification-failure acceptance remain open.

Verification-failure progress: native paste of quoted 00123 coerces to 123; current actual IM detects the mismatch, retains the completed read and reports Undo guidance without success. Panel regression verifies origin-history restoration of that error. See `docs/evaluations/2026-10-04-cpu-count-im-sequence-write-verification-failure.md`. Literal numeric-looking text preservation is an unresolved product defect; verification must stay exact. Document replacement acceptance remains open.
