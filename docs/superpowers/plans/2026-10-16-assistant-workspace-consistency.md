# Assistant workspace consistency implementation plan

> **For agentic workers:** Use subagent-driven-development with one implementer and separate spec/quality reviews. Preserve multiple commits as authorized by the owner.

**Goal:** Align AI subpage controls, spacing and navigation using the existing design-system tokens.

**Architecture:** Host stylesheet owns visual policy. A small view-header composition reuses existing heading/button nodes; each source/artifact/settings/panel owner retains callbacks and state. No shared runtime, persistence or provider contract changes.

**Tech stack:** TypeScript DOM views, ranui components/public CSS hooks, Vitest, Playwright.

## Chunk 1: Uniform workspace

- [x] Inspect deployed pages and code; record measured drift, undefined tokens, consumer boundaries and acceptance in the companion spec.
- [x] Add failing browser geometry/state tests for Sources/Models/History/Artifacts, native versus ranui 32 px frames, consistent titles/insets/gaps, enabled hover and disabled no-hover, coarse targets and long labels. Add focused tests for header composition and artifact dirty/busy back paths before implementing behavior changes.
- [x] Consolidate relevant rules in `styles/assistant.css` at their existing owner, replace undefined spacing/hover tokens, use tokenized type/spacing/radius/states, maintain content-sized editors, primary versus ordinary/destructive actions, and touch minima.
- [x] Add `lib/agent-plugin/ui/view-header.ts`; integrate Sources, Artifacts, Models and History owners without moving or duplicating state. Preserve artifact button registry, labels, dirty confirmation, asynchronous generation guards and focus restoration. Add destination label only where existing vocabulary is insufficient, updating all seven locales and types.
- [x] Run focused units and browser regression red/green, inspect screenshots and self-review; commit implementation and tests. Spec review, then quality review; resolve concrete findings and reverify.

## Chunk 2: Acceptance and delivery

- [x] Run full unit coverage, lint/types, format and production build; run relevant UI/source/artifact/native browser workflows separately from timing-sensitive unit workloads.
- [ ] Verify light/dark/narrow/coarse/keyboard/long-label states and actual deployed preview. Save a compact screenshot deliverable.
- [ ] Create the follow-up PR because #276 is merged, attach it, wait for all latest-head checks, fix failures and perform a final incremental review. Record authoritative CI/review results in the PR description; do not merge.

## Local acceptance

- Full coverage: 6,169 tests in 231 files passed; statements 86.77%, branches 82.89%, functions 87.51%, lines 89.33%. Lint, workspace declarations, TypeScript, formatting and production build passed.
- The 11-suite browser run passed 38 cases and exposed one superseded history-title alignment assertion. The revised assertion checks the header/body leading edge and the exact back-to-title gap; the complete long-history case then passed on a fresh build. All 39 targeted scenarios are verified, including native document readback and Undo, IME/dictation, queued requests, offline sources, artifact revisions and draft restoration.
- Independent specification review approved `a0bb0d3`; quality review found a masked ranui danger-color hook. `abb672f` restores that public hook and adds a real-component red/green regression for deletion, confirmation, hover, pressed and pending-disabled states. Quality re-review approved that fix.
- Root inspected Sources, Models, Conversations and Artifacts screenshots in light/dark and narrow layouts. The optional Google OAuth deployment remains unconfigured and is outside this visual increment; no real authorization or model-quality claim is made.
- Deployed-preview acceptance and latest-head remote CI remain pending until the follow-up PR is created.
