# Reliability and responsiveness

Implement the reviewed main-branch findings in one PR with independent functional commits.

## Behavior

1. Exporting another format does not mark the editable source saved. Normal saves retain existing version/ownership protections.
2. Failed editor opens restore a visible, focusable file-opening control surface; stale visibility timers cannot hide it again.
3. Document history keeps its toolbar/input mounted across searches, applies only current async results, and avoids pruning on every keystroke.
4. A conflicting chat can explicitly preserve local work as a separate conversation and restore saved history. Preserve revision checks and active request ownership; never silently discard either copy.
5. Healthy dictation ends gracefully at the duration limit. Startup/service failures remain distinct, and stop still has a bounded final-result wait.
6. Move large spreadsheet conversions off the main thread with a bounded worker lifecycle, current-request ownership and unchanged conversion results. Do not introduce a dependency on remote scripts.
7. Optimize history storage processing where safe without a data-format migration. Preserve cross-tab conflict detection and validate external records.

CPU model restart and offline caching require benchmark-backed changes: retain cancellation teardown and first-offline-export contracts. Record measured limitations rather than promise unverified speedups.

## Verification

Regression tests must fail before fixes for the five confirmed bugs. Run relevant unit tests, full type/lint/format/coverage gates, production build and focused real-browser history/open/conversion/assistant acceptance. Run independent specification and code-quality reviews. Publish English PR text and preserve separate commits; do not merge.
