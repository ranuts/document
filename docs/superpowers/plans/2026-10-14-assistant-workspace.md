# Assistant Workspace Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development. Steps use checkbox syntax for tracking.

**Goal:** Make document tasks discoverable and make generated results and reviewed changes clearer, within one new PR.

**Architecture:** The panel retains submission and consent ownership. An app-owned task module stages bound request intent, ChatView improves generic result rendering, and ActionPreview improves its existing review composition. No persistence or model-provider contract is replaced.

**Tech Stack:** TypeScript, ranui builders/components/tokens, Vitest/jsdom, Playwright and the existing OnlyOffice editor bridge.

**Specification:** `docs/superpowers/specs/2026-10-14-assistant-workspace-design.md`.

## Chunk 1: Contextual task entry and routing

Files: new `lib/agent-plugin/ui/task-entry.ts`; integration in `panel.ts` and
`panel-context.ts`; task-entry styles in `styles/assistant.css`; locale tables
and `i18n/types.ts`; unit tests and `test/e2e/agent-workspace.spec.ts`.

- [x] Write failing tests for format/selection suggestions, no automatic sends,
      draft preservation, expired scope and edited-request fallback.
- [x] Run focused Vitest; verify behavioral failures before implementation.
- [x] Build the contextual task entry using existing bounded context reads.
      Stage `{ text, intent, target, session }` only on a user task click; consume
      after explicit Send and fresh scope checks. Preserve preparation/consent.
- [x] Integrate known intent into routing without altering arbitrary typed
      requests, native tools, literal commands, cancellation or refinement.
- [x] Verify a ready staged writing task makes zero classification calls and
      one writing call. Add real Word flow through native change and Undo.
- [x] Commit as `feat(assistant): add contextual tasks and direct request routing`.

## Chunk 2: Conversation and result hierarchy

Files: `packages/chat-ui/src/{chat-view,styles,types}.ts`; existing chat-view
unit suites; relevant browser result/streaming tests.

- [x] Write failing result tests: artifact identity, interrupted/restored
      semantics, original source for copy/apply, accessible actual activity.
- [x] Run red tests, then improve typography, document-draft framing, compact
      actions and truthful streaming/activity states through optional labels.
- [x] Preserve editor independence and all existing public method behavior.
      Coordinate any new localized labels with the task-entry owner.
- [x] Verify long Markdown/table/code, keyboard focus, draft editing, Stop and
      reader scroll position. Honor reduced motion and narrow layouts.
- [x] Commit as `feat(chat-ui): clarify drafts and conversation results`.

## Chunk 3: Review and completion

Files: `lib/agent-plugin/ui/action-preview.ts`, review styles only in
`styles/assistant.css`, action-preview units and content-review E2E.

- [x] Add failing tests for clear primary/secondary action hierarchy and
      accessible secondary controls; retain all existing review behaviors.
- [x] Improve target/comparison composition and action grouping using ranui.
      Use actual review data and actual execution outcomes. Preserve expiration,
      cancellation, refinement, current-target checks and draft editing.
- [x] Verify Apply/Cancel/Edit/Refine/Copy/Locate, selection invalidation,
      sent versus verified outcomes, error states and restored focus.
- [x] Run native Word review/application/Undo E2E and screenshot validation.
- [x] Commit as `feat(assistant): refine change review and completion`.

## Chunk 4: Immediate process feedback

The user requested visible process while browser-local inference is waiting.
ChatView owns presentation and elapsed-time cleanup; the host supplies the
actual phase and translated labels. Existing provider and history contracts stay
unchanged. A classification phase is only shown when classification runs.

- [x] Add failing tests for immediate phase feedback, measured elapsed waiting,
      first streamed content, review resting state and Stop/disposal cleanup.
- [x] Add an explicit routing phase and localized labels. Keep elapsed text out
      of repeated live announcements and preserve stable composer geometry.
- [x] Validate a held endpoint request before and after its first content delta,
      Stop/retry and focus. Do not claim real-device model latency improvement.
- [x] Commit as `feat(assistant): show immediate request progress`.

## Chunk 5: Integration and delivery

- [x] Spec compliance review, then code-quality review for each functional unit.
      Fix verified findings and check final consumers/state owners.
- [x] Integrate functional commits; keep root and subagent checkouts isolated.
- [x] Inspect final light/dark/narrow screenshots and measure shared alignment
      and stable composer geometry; record unverified acceptance surfaces.
- [x] Update changelog and concise exploration record. Run reverse regressions.
- [x] Run full unit suite, format, lint/typecheck and production build, then
      selected real-editor E2E including Stop, history and dictation regressions.
- [ ] Fetch latest main, verify clean checkout and ahead/behind, push the feature
      branch, create/attach one new PR, and inspect checks for the pushed SHA.

This checklist is committed before publication. The PR records the final branch
revision and subsequent CI status.
