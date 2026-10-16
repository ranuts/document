# PR #273 open lifecycle regressions

## Replacement after teardown

Once a queued replacement has destroyed the previous editor, its mount must
complete before the next queued replacement runs. A newer download can fail
before reaching that queue; cancelling the in-progress mount in that case
left no editor at all. Explicit close remains a separate invalidation boundary.

Regression: `open-replacement.spec.ts` opens a real editor, starts its replacement,
then returns a controlled 404 for a newer URL after teardown has begun. The
replacement must finish loading and export a DOCX. On the original PR head this
test fails with `Document open superseded`. The corresponding unit regression
also fails before the fix; cancellation during teardown still prevents remounting.
