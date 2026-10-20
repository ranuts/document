# Assistant Layout Contract Implementation Plan

> **For agentic workers:** execute the document tasks inline; the independent ran guidance
> and executable example run in a separate isolated worktree using parallel agents.

**Goal:** enforce declared text, frame and navigation rails throughout the assistant.

**Architecture:** shared host CSS owns geometry; existing view owners keep callbacks and
state. Real-browser tests measure text and rendered component parts independently of CSS.

**Tech Stack:** TypeScript, ranui, CSS, Playwright, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-20-assistant-layout-contract-design.md`

## Global constraints

Preserve persistence, document writes, runtime ownership, focus and user drafts. Do not
alter foundation tokens, vendor code or dependencies. Keep multiple commits per PR.

## Tasks

- [x] Add browser geometry helpers and failing coverage for title text/hover and all subpage
      rails, including nested artifact states. Run against the unchanged CSS and retain failures.
- [x] Correct shared header/navigation/content CSS and inherited paragraph spacing. Apply
      the same owner rules to every inspected surface; run focused tests until green.
- [x] Validate narrow, themed, translated, coarse-pointer and long-text states. Run explicit
      reverse checks for text-only inset, expanded title hover and sibling rail regressions.
- [x] Update the main design entry with the assistant contract and record the inspected
      surface matrix, measurements, screenshots and actual verification outcomes.
- [x] Run complete unit, lint/type, format/token and production build checks. Review both
      branches and address findings.

Verification and the inspected matrix are recorded in
`docs/explorations/2026-10-20-assistant-layout-acceptance.md`.
Delivery uses separate, cross-linked PRs for the two repositories, preserving multiple
commits and attaching both PRs to the chat.

## Review focus

- A button's outer frame can align while its text drifts.
- A valid hit-area extension must not escape the panel or overlap adjacent controls.
- Native paragraph margins can double a shared header's intended group gap.
- Nested artifact views must reuse the same navigation/header geometry after async refresh.
- Long translations and coarse pointer targets must preserve visible actions and focus.
