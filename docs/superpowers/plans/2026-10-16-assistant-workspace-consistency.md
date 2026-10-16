# Assistant workspace consistency implementation plan

> **For agentic workers:** Use subagent-driven-development with one implementer and separate spec/quality reviews. Preserve multiple commits as authorized by the owner.

**Goal:** Align AI subpage controls, spacing and navigation using the existing design-system tokens.

**Architecture:** Host stylesheet owns visual policy. A small view-header composition reuses existing heading/button nodes; each source/artifact/settings/panel owner retains callbacks and state. No shared runtime, persistence or provider contract changes.

**Tech stack:** TypeScript DOM views, ranui components/public CSS hooks, Vitest, Playwright.

## Chunk 1: Uniform workspace

- [x] Inspect deployed pages and code; record measured drift, undefined tokens, consumer boundaries and acceptance in the companion spec.
- [ ] Add failing browser geometry/state tests for Sources/Models/History/Artifacts, native versus ranui 32 px frames, consistent titles/insets/gaps, enabled hover and disabled no-hover, coarse targets and long labels. Add focused tests for header composition and artifact dirty/busy back paths before implementing behavior changes.
- [ ] Consolidate relevant rules in `styles/assistant.css` at their existing owner, replace undefined spacing/hover tokens, use tokenized type/spacing/radius/states, maintain content-sized editors, primary versus ordinary/destructive actions, and touch minima.
- [ ] Add `lib/agent-plugin/ui/view-header.ts`; integrate Sources, Artifacts, Models and History owners without moving or duplicating state. Preserve artifact button registry, labels, dirty confirmation, asynchronous generation guards and focus restoration. Add destination label only where existing vocabulary is insufficient, updating all seven locales and types.
- [ ] Run focused units and browser regression red/green, inspect screenshots and self-review; commit implementation and tests. Spec review, then quality review; resolve concrete findings and reverify.

## Chunk 2: Acceptance and delivery

- [ ] Run full unit coverage, lint/types, format and production build; run relevant UI/source/artifact/native browser workflows separately from timing-sensitive unit workloads.
- [ ] Verify light/dark/narrow/coarse/keyboard/long-label states and actual deployed preview. Save a compact screenshot deliverable.
- [ ] Create the follow-up PR because #276 is merged, attach it, wait for all latest-head checks, fix failures and perform a final incremental review. Record authoritative CI/review results in the PR description; do not merge.
