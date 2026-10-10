# Settings Escape composition regression

Product commit a13d657 prevents settings dismissal while Escape is an IME composition event or legacy keyCode 229. The regression initially selected a file input and failed at test setup; after selecting a non-file input, it reproduced the actual defect: settings became hidden. The production guard then passed both the preservation case and the existing ordinary Escape/focus-return case.

On that product state, `pnpm test` completed successfully: 129 files and 4414 tests. Two existing PromiseRejectionHandledWarning messages remained. This run followed the successful production build, not concurrently with it.

A subsequent test-only extension covers both isComposing and keyCode 229 events. `pnpm exec vitest run test/unit/agent-panel.test.ts test/unit/chat-view.test.ts test/unit/panel-resize.test.ts test/unit/agent-sidebar-entry.test.ts` passed 4 files and 61 tests. The full-suite count above precedes this additional parameterized case; it is not claimed as a full run of 4415 tests.

These are synthetic DOM interaction regressions and code inspection, not a physical Chinese/Japanese/Korean input-method acceptance result. No model, document tool behavior, preview workflow or generation defaults changed.
