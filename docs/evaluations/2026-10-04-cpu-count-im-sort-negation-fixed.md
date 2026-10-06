# Explicit no-sort request fix

Root cause: complete no-op instructions still reached unrestricted document tool selection, allowing an unrelated read/calculation to pass structural validation. A bounded whole-command guard now rejects the reproduced Chinese no-sort/keep-all-cells-unchanged request before inference. It applies only to spreadsheet context and requires the complete command shape; a separate affirmative read continues through planning.

The regression failed before implementation (unrelated sum plan accepted), then all 93 planning tests passed. Full suite: 118 files, 4283 tests passed. TypeScript, scoped lint and production build passed. The full suite emitted a PromiseRejectionHandledWarning; no test failed.

Actual current built CPU IM replay: the no-op case emitted no model actions and no unsolicited C1 result, conflicting directions still produced clarification guidance, and the negated-sort plus explicit B2 read returned 30. All inspected table snapshots stayed intact and no preview cards appeared. The existing actionable no-operation error is used; this is not a new no-op success-status design.

This fixes the reproduced bounded Chinese command, not every possible negation or arbitrary language formulation. Raw before/after diagnostics and verifiers are retained. Model-wide semantic fidelity remains open.
