# Duplicate SDK error during a successful open retry

Normal E2E workflow 38994444768, shard 3, observed an SDK `-82` despite the workbook
successfully reopening. The CI trace showed the vendor's `changesError` path at
95941.863ms, the application's conversion failure guard at 95943.604ms, retry
scheduling at 95944.493ms and the original SDK error returning at 96288.885ms. The
retry subsequently completed. The normal, Pages and Docker jobs therefore did not
establish different document outcomes: the failing assertion observed an older SDK
error that the runtime was incorrectly allowed to emit.

The guard used a default bubble listener and did not consume conversions it already
owned. A vendor `onunhandledrejection` installed first could report the same failure
before the retry guard. L0's periodic SDK hook could also miss that event during a
fast rebuild, explaining why a successful local retry alone was insufficient proof.

The guard now captures recognized open-conversion rejections before the vendor's
bubble/property listener. Only failures it handles through retry or its existing
final SDK error path are consumed. Retired-frame conversion failures cannot affect
the replacement. Unrelated rejections and conversions after document readiness still
reach the vendor. A final document failure continues to emit `-82` once through the
SDK, with the existing failure state and loading-action cleanup.

Regression cases use real Window event dispatch with the vendor listener registered
first. They cover recoverable and final failures, unrelated exceptions, loaded exports,
retired frames and cancelable/non-cancelable events. The real-editor retry scenario
also waits until L0 observes the failing SDK before releasing its injected error;
its assertion that no `-82` reaches the recovered editor is unchanged.
