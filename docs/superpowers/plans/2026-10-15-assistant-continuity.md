# Assistant Continuity Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development. Steps use checkbox syntax for tracking.

**Goal:** Extend PR #271 with history, Stop, queued follow-ups and actual performance improvements, in functional commits.

**Architecture:** The host owns sessions, request scope, queue execution and inference lifecycle. ChatView remains editor-independent. A bounded history search Worker and idle preparation keep computation separate from DOM. Provider defaults and persistent history contracts remain unchanged.

**Tech Stack:** TypeScript, ranui components/tokens, Web Workers, bounded idle scheduling with fallback, Vitest and serialized Playwright/OnlyOffice.

**Spec:** `docs/superpowers/specs/2026-10-15-assistant-continuity-design.md`.

Execution order is history, Stop, request performance, then queue integration.
The queue consumes Chunk 4's lightweight scope and trusted-read provenance;
landing these first avoids capturing whole documents when accepting follow-ups.

## Chunk 1: History interaction and search performance

Files: `lib/agent-plugin/ui/history-list.ts`, `sessions.ts`, new history search
Worker/client/scheduler modules nearby, history sections of `styles/assistant.css`,
locale tables/types, `test/unit/agent-history-list.test.ts`, session tests and
`test/e2e/agent-history-rendering.spec.ts`. Root integrates lifecycle hooks in
`panel.ts`; implementation must provide the exact hook/API requirements.

- [x] Write/observe failing tests for full-text result snippets, distinct empty
      states, bounded initial rows, incremental loading, unchanged render/focus,
      zero repeated message-history clones, stale results and Worker failure.
- [x] Implement searchable data access under the existing session-store owner;
      invalidate only changed records. Preserve defensive public history reads.
- [x] Implement Worker search and bounded cancellable idle preparation/fallback.
      Ensure first explicit search has a priority path, latest result wins,
      removed records cannot return, and disposal terminates work.
- [x] Cover constructed-but-silent Worker timeout, error/messageerror and
      construction failure. Use 1,000 x eight x 512-character fixture, 40-row
      pages, no per-query corpus repost or repeated message cloning; cover hidden
      view, reactivation and pagehide cleanup.
- [x] Refine history hierarchy using existing tokens and components. Keep all
      data tools and confirmation reachable; no new persistence contract.
- [x] Run focused units, then specification and code-quality review. Root runs
      serialized browser/screenshot acceptance and records operation counts.
- [x] Commit as `feat(assistant): refine history browsing and background search`.

## Chunk 2: Immediate Stop presentation and lifecycle

Files: `packages/chat-ui/src/{chat-view,types,styles}.ts`, public README/CLAUDE,
`lib/agent-plugin/ui/controller.ts`, host integration in `panel.ts`, locale
labels/types, controller/chat UI tests and `test/e2e/agent-stop-resume.spec.ts`.
An optional agent-core runtime completion-cause flag and shared presentation
mapping distinguish successful terminal receipts from empty answers or native
cancelled/unverified/unavailable outcomes. Adjacent panel-loading fixtures must
use authoritative session identity and activate history before selecting rows.

- [x] Write/observe failing tests for delayed host cancellation, single Stop,
      obsolete deltas/finish, long partial content and preserved draft/focus.
- [x] Add truthful immediate stopping state; freeze the current stream before
      expensive cancellation work. Defer expensive interrupted Markdown work
      past the interaction paint without re-enabling Apply or losing source.
- [x] Preserve controller/provider turn ownership and underlying serialized
      engine drain. Old finalizers cannot reset a newer turn or save stale text.
- [x] Return explicit turn IDs and success/stopped/failed/limited/review-pending/
      superseded controller outcomes (host submit mapping is in Chunk 3). Distinguish
      acknowledged cancellation from underlying provider drain. Test Stop's next
      paint with 100KB partial content and no event-handler Markdown parsing.
- [x] Verify keyboard, reduced motion, error/Stop recovery and native write guards.
      Run two-stage review and commit as `fix(assistant): make stopping responsive`.

## Chunk 3: Continuous input and host-owned request queue

Files: new `lib/agent-plugin/ui/request-queue.ts` and queue presentation module;
optional hooks/slots in chat-ui source/public docs; `panel.ts`, queue styles,
locale labels/types, unit suites and real-editor queue E2E.

- [x] Write/observe failing tests for FIFO, immediate acceptance while busy,
      edit/remove/send now, duplicate prevention and Stop/failure pause.
- [x] Implement a pure queue state owner per conversation and minimal pending
      list. Separate Send/Queue from Stop; defaults preserve other ChatView users.
- [x] Bind each queued request to its original scope and trusted intent. Hold
      through human review; pause stale/deleted/switched scope without auto-send.
      Preserve drafts and allow explicit recovery; no persistent schema change.
- [x] Advance only on explicit success; cover delayed drain, provider switching,
      old finalizers and shared ChatView without queue hooks. New drafts while
      paused older requests remain queued; Resume uses FIFO, Send now promotes/resumes.
      A fresh explicit Send with no older pending requests starts normally after
      cancellation settles, preserving the Stop-then-ask-again interaction. Editing
      cannot overwrite an occupied composer. Return to a conversation requires
      Resume; deletion/history restoration invalidates its volatile queue. Scope
      recovery requires explicit restore/rebind, including freeform requests.
- [x] Verify no parallel model calls and no later request starts before active
      settlement. Run two-stage review, then commit queue behavior separately.

## Chunk 4: Fewer model calls and relevant request context

Files: `request-intent.ts`, `request-context.ts`, `task-entry.ts`, `controller.ts`,
`document-tool-action.ts`, `panel.ts`, relevant unit suites and real-editor
workspace/process E2E.

- [x] Record baseline model calls, context bytes and SDK reads for exact greetings,
      generic chat, trusted read tasks, edited tasks and document writes.
- [x] Add conservative exact chat shortcuts; all ambiguous requests keep the
      semantic router. Preserve language and pending-proposal refinement.
- [x] Capture selection/metadata for generic chat and native tool requests;
      preserve actual PDF/page/document grounding on explicit read paths.
- [x] Remove implicit eager body reads from target capture as well: introduce a
      lightweight bound scope, capturing full mutation verification only before
      actual writes and before asynchronous work. Require zero whole-body reads
      for exact greetings and ordinary generic chat; preserve write readback.
- [x] Add trusted one-inference read-only tasks with tools forced empty and bound
      target validity at preflight/deltas/completion. Keep writes reviewed.
- [x] Define explicit host read provenance by existing task ID and scope (never
      task='tools' alone). Revoke it on edits/restoration. Test selected text,
      Word body, sheet range, slide scope and exact PDF page, including unavailable
      and truncated sources; require one inference, empty tools and truthful
      unavailable-source feedback.
- [x] Verify per-turn context/guards cannot leak to the next request; Stop,
      readiness, provider switching, history and privacy semantics remain intact.
- [x] Run two-stage review and commit as a distinct performance change.

## Chunk 5: Integration, evidence and delivery

- [ ] Align the selected-text disclosure and add a thin chevron, reversible
      open/close motion, reduced-motion support and keyboard regression coverage.
- [ ] Make the assistant title return to the latest meaningful conversation,
      falling back to an existing draft or new conversation, without resuming
      paused requests or restoring disabled disk history.
- [ ] Integrate functional commits onto `fix/speech-first-permission`, retaining
      91ad1dd and updating PR #271 rather than creating another PR.
- [ ] Run full unit suite, lint/typecheck, format and production build. Serialize
      real-editor browser runs to avoid resource contention.
- [ ] Capture and inspect history/queue/Stop states in light/dark, minimum and
      wider panels, Chinese, keyboard and reduced motion. Record limitations.
- [ ] Record synthetic before/after model calls, input context/SDK reads and UI
      work. Separate those facts from unmeasured physical GPU latency.
- [ ] Update changelog, concise acceptance record and PR title/body for the final
      scope; verify clean checkout/latest base, push and inspect exact-SHA CI.
