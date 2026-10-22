# Assistant Markdown craft implementation plan

> **For agentic workers:** Use subagent-driven-development with separate spec/code review.

**Goal:** Give Chat and Artifacts one polished, safe table/code presentation.

**Architecture:** Keep Marked token parsing and safe DOM construction. One small presentation
owner supplies shared block styles, code actions and bounded lazy token highlighting. The
existing streaming cache and host source/state ownership remain authoritative.

**Tech Stack:** TypeScript, native DOM, ran tokens, Marked, declared Shiki 4.4.3, Vitest/Playwright.

## Chunk 1: Shared presentation

- [x] Read all renderer consumers and existing streaming/copy/security tests; add focused RED
      cases for discarded language/alignment and code copy behavior before changing implementation.
- [x] Add explicit fine-grained Shiki dependency/imports and safe dual-theme token rendering;
      bound completed-code highlighting and guard stale/selected/detached targets.
- [x] Add a renderer-owned code header/copy lifecycle with localized states and disposal.
      Wire it through completed/restored/streamed Chat and Artifact previews.
- [x] Consolidate table/code CSS; use quiet table hierarchy, explicit column alignment and
      scoped horizontal scrolling. Remove conflicting artifact-only block rules.
- [x] Run focused Markdown/streaming/security/artifact tests and types/lint; fix actual failures.
- [x] Obtain independent spec then code review; correct findings before acceptance.

## Chunk 2: Actual acceptance and delivery

- [x] Build the final combined navigation/Markdown source and record its identity.
- [x] Run the relevant whole-assistant browser sweep and all unit tests once on final source.
- [x] Capture before/after Chat and Artifact tables/code, copy/scroll recordings, and the
      corrected return/dirty-confirmation path across four declared environments.
- [x] Inspect original images and decoded recording frames. Reject visible defects even if
      assertions pass; mark the earlier missed acceptance as superseded.
- [x] Save a concise corrective report and prepare accepted changes for the existing PR
      without loosening thresholds or assertions.

Remote CI is observed after the approved push; the PR and local acceptance report
retain its final result without changing the tested runtime.
