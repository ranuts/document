# Assistant single-return correction plan

> **For agentic workers:** Use subagent-driven-development for implementation and separate
> spec/code review. The current checkout is already isolated on the existing PR branch.

**Goal:** Remove duplicated return navigation and visible command drift in the actual artifact flow.

**Architecture:** The shell owns the single return location; the artifact view retains its
existing guarded return operation. Reuse the native button/action rather than duplicating
navigation state or deleting dirty/busy protection. Shared CSS owns command insets.

**Tech Stack:** TypeScript, native DOM/ranui, Vitest, Playwright.

## Chunk 1: Correct the application composition

- [x] Add a failing browser regression for one return location and the actual return destination
      across root list, detail/import and dirty confirmation. Measure visible command starts.
- [x] Implement the smallest change in `lib/agent-plugin/ui/artifacts-view.ts`, `panel.ts`,
      `panel-workspace.ts` if needed, and `styles/assistant*.css`. Keep state ownership intact.
- [x] Replace the superseded double-return contract in `docs/design-system.md`; migrate tests
      to the new real route without removing dirty, busy, focus or overflow assertions.
- [x] Run affected unit/browser suites, types/lint and changed-file formatting.
- [x] Obtain independent spec and code review, fix actual findings, and verify again.

## Chunk 2: Actual acceptance and delivery

- [x] Build the final production source and record its exact identity.
- [x] Capture complete panes and actual recordings for the hierarchy and dirty cancel/discard
      in desktop light/dark and 320/360px Portuguese coarse input; inspect originals and video frames.
- [x] Update the user-facing report with corrected evidence and acknowledge the previous miss.
- [x] Prepare only accepted changes and evidence for the existing PR update.

Remote checks are observed after the approved push; the PR and local acceptance
report retain their final result without changing the tested runtime.
