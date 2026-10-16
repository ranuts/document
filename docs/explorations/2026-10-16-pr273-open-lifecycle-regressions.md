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

## Mounted retry ownership

The latest requested download and the mounted editor have different lifetimes.
Registering an editor's open attempt now binds its retry to explicit close and
the next actual editor replacement. The deferred retry carries the attempt's
identity into the editor queue, so a retry queued behind another replacement
cannot revive the older document.

Regression: `retries the mounted document after a newer download fails` constructs
an editor, fails a newer download with 404, then delivers an environment failure
through the real frame guard. Without the fix it constructs only one editor and
reports a terminal error. With the fix it rebuilds the original document.
`invalidates a queued retry when another editor takes ownership` also fails
before the fix and protects the queue-entry ownership check.
