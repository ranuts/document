# Follow-up performance verification

This pass starts from 0131b526 and adds one commit per feature to PR #266. Operation counts establish reduced work; they do not imply a specific browser latency improvement.

## Browser baseline

Chrome DevTools inspected a production local editor preview on 127.0.0.1:4203. The reload trace was unthrottled and reported CLS 0.06; no LCP or field metrics were returned. The network snapshot confirmed native app/SDK/font resources, and the accessibility snapshot confirmed the real editor was interactive. This local reload is not a cold production bandwidth benchmark. No vendor-loading optimization is claimed from it.

## Selected improvements

- Chat rendering: repeated full-history button-state scans and per-row scroll measurements during restoration; repeated full streamed source attribute writes.
- History expiry: complete live metadata read/sort before expiry filtering despite an existing updatedAt index.
- GGUF deletion: per-shard SDK deletion repeats cache enumeration, including unrelated cached files.

Verification results will be recorded alongside each independently committed feature.

## Chat rendering

The new appendMany API restores completed messages through the existing renderer, then performs one final scroll update. Ordinary append keeps its immediate behavior. New action controls initialize within their row; existing controls update only when running or draft-emptiness changes. Streamed original source is published once at completion/interruption before the row becomes a completed answer.

| Deterministic fixture                               |                           Before | After |
| --------------------------------------------------- | -------------------------------: | ----: |
| Disabled-control writes for 100 agent messages      |                            5,050 |   100 |
| Disabled-control writes for 500 agent messages      |                          125,250 |   500 |
| Scroll calls for a 500-message restore              |                              500 |     1 |
| scrollHeight reads for a 500-message restore        |                            1,500 |     3 |
| data-source updates across 20 streaming frames      |                               20 |     0 |
| Final source publication on completion/interruption | Per-frame source already present |     1 |

Validated with 120 focused chat/controller/storage tests, package type generation, and a mounted Chromium case restoring 400 persisted messages, switching to a short conversation and back, checking source/action state and final scroll position. Operation counts are measured in deterministic DOM fixtures; no end-user milliseconds or memory reduction is asserted.

## Indexed history expiry

Use the existing updatedAt index to fetch only snapshots at or before the inclusive expiry cutoff. The precise expiresAt predicate still renews retention after reopening, and a stable descending sort of expired candidates preserves returned ID ordering, including equal timestamps. Deletions and save-target cleanup retain their original transactional behavior. No database schema change.

A fixture with 2,000 recent documents and five old metadata rows reads five candidates instead of all 2,005. Snapshot writes still perform the required full budget check: total metadata results fall from 4,008 to 2,008 (five expiry candidates and 2,003 budget rows); full metadata scans fall from two to one. Eleven focused history suites / 98 tests passed, including exact boundaries/ties, reopened retention, blob/handle cleanup and cancellation rollback.
