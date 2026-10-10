# Yield between document operations

## Reproduced bug

The previous loop awaited immediately resolved read operations, then began the native write before queued UI events could run. In the actual built Excel IM, a DOM observer clicked the visible Stop control as soon as the read result appeared. B2 still changed from 30 to 99 and the panel reported success. The original evidence and driver are preserved in `2026-10-04-cpu-count-im-sequence-stop-after-read.json` and its matching probe.

## Change

The panel yields a browser task between operations, then checks cancellation and conversation identity again. Existing DocumentToolAction freshness checks run before the next tool starts. This lets queued Stop/session/editor events cancel the remaining action, without adding confirmations or previews. Already completed actions remain recorded; this does not roll back a write that has already started.

## Actual built IM checks

The verified probe uses the cached CPU fallback and original native tools. A DOM observer triggers real controls immediately after the first read result; it does not replace model responses, tool execution, or the planner. This is a deterministic event-order test, not a manual reaction-time measurement.

- Stop: B2 stays 30; completed read remains; Stopped appears; no final success.
- New conversation and switch to another conversation: B2 stays 30; the destination conversation has no operation messages.
- Selection change: native selection changes from C1 to D1; the subsequent write is rejected as expired; B2 stays 30.
- No interruption: full original read is retained; only B2 changes to 99; success appears.

The verifier checks empty conversation activity/replies and the welcome state after switching; whole-page text still includes prior request titles in the session selector. No page errors or preview cards; the built plugin hash stays unchanged. The first selection fixture called C1, which was already selected from seeding, so it did not test a changed target and the write correctly ran. Its evidence is retained in `2026-10-04-cpu-count-im-sequence-interruption-after-read.json`; the verified fixture records the actual C1 to D1 change.

## Validation and limits

Regression tests cover an immediate result/Stop race and a delayed read that resolves after Stop, new conversation, or session switching; the second action must never start and completed messages stay in the originating history. Full suite: 119 files, 4,306 tests passed. TypeScript, scoped oxlint, production build and diff whitespace checks passed. Existing PromiseRejectionHandledWarning messages remain in the full suite.

This verifies the currently supported Chinese literal read-then-write sequence. Arbitrary composites, sheet/document replacement between steps, mobile devices and cancellation during an already-started native write still need separate evidence.
