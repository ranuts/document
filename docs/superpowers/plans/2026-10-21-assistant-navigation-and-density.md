# Assistant navigation and density implementation plan

> **For agentic workers:** Use subagent-driven development for implementation and independent review. Steps use checkbox syntax for tracking.

**Goal:** Correct the two rejected compositions, audit analogous views and update PR #289 only after actual rendered acceptance.

**Architecture:** The existing panel workspace owns parallel navigation and focus. View owners retain nested artifact flows and all data operations; shared assistant CSS owns density and alignment. No framework or dependency changes.

**Tech Stack:** TypeScript, ranui builders/tokens, Vite, Vitest, Playwright.

## Task 1: Baseline, navigation and hierarchy

- [x] Capture the unchanged History, Artifacts, Models and Sources panes in a real browser.
- [x] Add failing owner/browser checks for explicit Chat navigation, idempotent destination selection, top-level heading alignment and absent top-level Back.
- [x] Update `panel-workspace.ts`, `panel.ts`, `sources-view.ts`, `artifacts-view.ts` and `view-header.ts`: visible navigation, selected state, top-level headers, genuine nested Back, runtime ownership.
- [x] Add `agentWorkspaceChat` to i18n types and all seven locale dictionaries.
- [x] Style the navigation and headers in `styles/assistant.css`; retain keyboard and coarse input targets.
- [x] Run focused owner/view/artifact/history tests and review against the scope lock.

## Task 2: Command composition and craft

- [x] Add browser regression checks for equal command frames, 32px fine/44px coarse targets, checkbox/icon/text columns and ordinary Import/Attach roles.
- [x] Correct History layout and secondary control treatment in shared CSS; preserve all operations.
- [x] Add restrained entry motion using existing ran tokens and a reduced-motion guard.
- [x] Inspect actual full-pane screenshots and iterate on proportions, density, spacing and themes.

## Task 3: Regression and acceptance

- [x] Adapt affected tests to the new product navigation. Retain actual interaction coverage and independent geometry checks; do not preserve rejected layout contracts.
- [x] Run relevant assistant owner/unit suites and browser workspace/history/source/artifact/layout suites without retries.
- [x] Exercise narrow/coarse, translated, dark, nested, loading/error and confirmation states; inspect captured PNGs.
- [x] Reverse-check deliberate text/frame drift and restore.
- [x] Run `pnpm lint:ts`, `pnpm format:check`, `pnpm build` and `git diff --check`.
- [x] Replace superseded rules in `docs/design-system.md` and add an evidence-backed acceptance record with real captures and limitations.
- [x] Obtain independent specification/code/visual review and resolve findings.
- [ ] Commit and push to the existing PR branch, rewrite PR metadata to describe the final implementation and evidence, then inspect CI for new failures.
