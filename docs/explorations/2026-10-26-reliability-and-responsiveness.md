# Reliability and responsiveness acceptance

Base: `e06953cf25bb1d1849ba9af6c959d8b805388226`.

## Changes

- Other-format exports keep the editable source dirty and leave its SDK save point unchanged. A subsequent ordinary save still clears it.
- Failed opens restore visible, focusable controls; visibility timers cannot race, and pages with a landing hero retain their distinct layout.
- Document history retains its toolbar/input, rejects stale async results, and throttles expiry cleanup while forcing a sweep on BFCache restoration.
- Explicit conflict recovery preserves all locally touched conversations as separate in-memory copies when they differ from saved originals. Saving remains off until the user opts in again. A later save still checks the loaded database revision. Old controller history handles cannot write into restored originals.
- Healthy dictation reaches the existing one-minute limit through stop/final-result collection, with a two-second release fallback and an accurate limit notice. Startup/service errors remain separate.
- A local classic worker performs SheetJS parse/write operations. Each conversion owns its worker and releases it on completion, failure, cancellation or timeout. Caller-owned buffers stay intact. Main-thread text decoding retains existing encoding behavior; browsers without Worker retain the old compatibility path. Both worker and SheetJS are precached for first offline use.
- Conversation saves reuse validated serialization only for owned, deeply frozen plain-data snapshots. External mutable records and exotic mutable objects remain fully processed. Database schema and revision conflict guards are unchanged.

## Verification

- Confirmed RED regressions before fixes for save state, control recovery, history focus/stale results, chat conflicts and dictation duration.
- Full unit coverage: **6,844 tests in 256 files passed**. Statements 88.55%, branches 84.34%, functions 89.91%, lines 91.06%; configured package thresholds passed.
- Workspace types/lint, formatting and production build passed. Both archive gates verified 1,511 immutable evaluation artifacts.
- Real SheetJS VM tests round-trip Chinese CSV and HTML tables through XLSX and BOM-prefixed CSV without a DOM.
- Chromium production-build acceptance: **37 tests passed** (2.8 minutes), covering four-editor dictation, history actions/rendering, local document history keyboard focus, failed-open recovery, CSV encodings, responsive 50,000-row worker conversion and first offline conversion.

## Repeated-save benchmark

Node/Vitest with fake IndexedDB, 20 messages of roughly 1 KB each per conversation. Initial save and snapshot preparation are excluded; each sample changes one conversation. Five repeated saves per configuration, median elapsed time:

| Conversations | Mutable snapshots | Prepared immutable snapshots |
| ------------- | ----------------: | ---------------------------: |
| 100           |           1.19 ms |                      0.18 ms |
| 1,000         |          11.09 ms |                      0.60 ms |

This measures reduced repeated serialization work in a controlled harness, not browser disk latency or model first-token time. A deterministic regression also asserts that unchanged prepared records are not serialized again. First history loading still reads all conversation bodies.

## Limits and follow-ups

Physical microphone recognition and actual GPU generation latency were not measured. CPU-model cancellation teardown and the existing full-format offline preparation contract remain unchanged. They require separate lifecycle/network measurements before changing their guarantees. The worker improves responsiveness, not necessarily total conversion duration; decoding still runs on the main thread. Conflict recovery copies remain in memory until saving is explicitly re-enabled.

Source and caller review covered save ownership, stale view results, conflict-copy ownership, mutable external records, worker cleanup and static offline dependencies.
