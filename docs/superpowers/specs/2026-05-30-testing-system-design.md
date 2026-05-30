# Testing System Design

## Goal

Add a pragmatic test system that catches common regressions without making normal pull requests slow or brittle.

## Current State

The project currently has TypeScript checking, oxlint, Docker Compose validation, and production builds. It does not have a unit test runner, coverage reporting, browser E2E tests, or snapshot tests. CI runs lint and Docker validation on pull requests; deployment builds run in a separate Pages workflow.

## Recommended Approach

Use a three-layer testing system:

1. Vitest unit tests for pure TypeScript logic and lightweight browser-facing helpers.
2. Playwright E2E tests for application smoke checks and iframe embed API behavior.
3. Minimal snapshot coverage for stable data and page states, avoiding broad visual snapshots until the project has enough stable UI test fixtures.

This starts with low-maintenance coverage and leaves room to raise thresholds later.

## Unit Tests And Coverage

Vitest should run in a jsdom environment so browser-facing modules can be tested without launching a full browser. Tests should live next to related code under `test/unit/` and focus first on low-cost, high-risk logic:

- document type and MIME mapping helpers
- file extension priority behavior in document conversion entry points
- i18n fallback behavior
- readonly and save-request error branches that can be tested with mocked `window.editor`
- iframe embed message helpers after they are exposed through small internal functions

Coverage should use V8 coverage. Initial thresholds should be intentionally modest: lines 35%, branches 25%, functions 35%, statements 35%. The goal is to make coverage visible and prevent backsliding without forcing unrelated rewrites.

## E2E Tests

Playwright should run against the Vite dev server. The first E2E suite should avoid deep OnlyOffice editing because that path is heavy and can be flaky in CI. The initial scope should include:

- homepage loads without console page errors
- expected root containers render
- manifest and service worker assets are reachable
- iframe embed mode emits or handles stable API messages where possible
- invalid embed actions return `document:error` instead of hanging

OnlyOffice document editing and wasm conversion should be considered a later nightly or manual workflow once stable fixtures exist.

## Snapshot Tests

Use snapshots sparingly:

- Vitest snapshots for stable structured outputs such as type maps or generated config fragments.
- Playwright screenshots only for one or two stable smoke states with fixed viewport.

Do not snapshot the full OnlyOffice editor UI in the first phase. It is large, font-sensitive, and likely to cause false positives.

## CI Integration

Update CI to run:

- `pnpm install --frozen-lockfile`
- `pnpm run lint:ts`
- `pnpm run test:coverage`
- `pnpm run test:e2e`

Unit tests and coverage should run in the existing validation job. E2E tests should run as a separate job after install/build setup, uploading Playwright reports on failure.

## Scripts

Add these package scripts:

- `test`: run Vitest once
- `test:watch`: run Vitest in watch mode
- `test:coverage`: run Vitest with coverage
- `test:e2e`: run Playwright
- `test:e2e:ui`: run Playwright UI mode for local debugging

## Non-Goals

The first phase does not attempt full document editing automation, broad visual regression coverage, or high coverage gates. Those should come after the basic test system is stable and the team has a few examples to maintain.

## Success Criteria

- A fresh install can run unit tests, coverage, and E2E tests from package scripts.
- CI validates coverage and E2E smoke tests for pull requests.
- The first tests cover representative logic and iframe API failure behavior.
- Existing lint and build workflows keep passing.
