# English explicit no-sort fix

Debugger caller-frame capture established the actual model plan for Do not sort A1:B4. Leave every cell unchanged.: {"tool":"sort_range","input":{"range":"C1","column":"A","descending":false,"header":true}}. The model chose a negated operation against the current context rather than the requested range. Parameter validation rejected it before execution; merely mapping that error would not correct planning.

A bounded whole-command English guard now recognizes this explicit no-op instruction before inference, returning the existing actionable no-operation guidance. It requires a concrete cell/range plus the full keep-unchanged sentence. An affirmative read after a negated sort remains valid. It does not claim general natural-language negation understanding.

The test with a structurally valid unsolicited sort failed before the fix, then all 95 planning tests passed. Full suite: 118 files/4285 tests passed. TypeScript, scoped lint and production build passed; the full suite retained its asynchronous rejection warning. Actual built CPU IM replay emitted no inference actions for the English no-op, displayed no-operation clarification, and retained the correct B2/30 read. All inspected table snapshots stayed unchanged, with zero preview cards. The verifier binds the captured invalid plan to the post-fix observations. Debugger probes are read-only diagnostics and can affect timing.

General model fidelity, other no-op formulations, graceful success-style no-change status, and mobile/device acceptance remain open.
