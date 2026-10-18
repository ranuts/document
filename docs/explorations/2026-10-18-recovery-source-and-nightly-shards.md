# Recovery Sources and Nightly Browser Shards

## Scope

Follow-up to PR #281: six confirmed defects plus ordinary WebKit/Firefox
execution sharding. Implementation follows
`docs/superpowers/plans/2026-10-18-recovery-source-and-nightly-shards.md`.

## Root causes and regression evidence

| Finding                             | Cause                                                                                             | Regression                                                                                                                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Saved content rolls back on reload  | Disk completion only changed metadata; recovery still preferred older snapshots/originals         | Actual save-stream and IndexedDB recovery, with/no prior snapshot, delayed source persistence, later snapshots and old in-flight recovery exports                                   |
| Copied page invalidates original    | Session storage copies the source pointer; replacement/clear deleted the referenced shared record | Independent copied pointer reads and real browser copied-page recovery                                                                                                              |
| Nested document URL changes         | Query parser already decoded the parameter; startup decoded it again                              | Real HTTP server received `/folder/report` before repair instead of the encoded path/query for both file/src; six no-retry cases passed across Chromium/WebKit/Firefox after repair |
| Gemini artifact revision fails      | Native normal STOP was missing from the artifact success whitelist                                | Actual Gemini JSON/SSE transport with normal, abnormal and tool-bearing responses                                                                                                   |
| Cached mirror changes source        | Preset matching, provider reuse, active state and deletion used model ID only                     | Real cache-settings/catalog and panel integration with same-ID sources, persisted URL/library, switching, active/idle deletion and canonical URLs                                   |
| Production smoke verifies old build | Editor asset hash omitted vendor/SW/static-only changes; timeout continued anyway                 | Executable final-tree identity generation and real HTTP polling of current/stale/missing/malformed/failed/hanging markers                                                           |

The browser URL regression intentionally serves a valid document for incorrect
paths too. Its request assertion detects the bug without relying on native
document parse failures. The fixed entry preserves the query parser's decoded
value exactly.

Each loaded page owns a source slot. Repeated saves atomically update that slot,
so they do not accumulate a full file per save; copied/reopened pages detach
into their own slots. Inherited records stay under the existing 24-hour expiry
and explicit deletion policy. A dormant copied pointer can observe a newer
saved version of the same document before it opens; no frozen duplication-time
snapshot or reference-counting store is introduced.

Recovery selection binds a saved revision boundary and the history row's
creation identity to the exact source bytes. This protects snapshots recreated
after quota eviction. Provenance follows the actual recovered File through a
WeakMap instead of trusting potentially stale copied sessionStorage metadata.
Missing/expired slots can be replaced on the next save; deletion during an
in-flight write still prevents resurrection.

Disk completion waits for source persistence before clearing dirty, then checks
the SDK save point again. Later typing preserves the saved source while keeping
dirty set, and later snapshots outrank that source. Key-only existence checks
avoid deserializing the previous full payload twice per save. Their regression
rejects payload reads while requiring three successful replacements, latest
recovered bytes and exactly one retained record.

## Deployment identity

The final production build writes `build-identity.json` after all transforms,
including the service worker stamp. It records source revision and a digest of
the served tree. Docker passes the source revision explicitly because its
context excludes Git metadata; unidentified archives use an explicit content
identity rather than pretending to be a particular commit.

Push smoke polls the exact source revision with a unique nonce, no-store request
and bounded transfer/deadline. It fails if the target deploy never arrives.
Pages, Docker and preview serve the marker with no-store; the worker bypasses
it. Different hosts may encode WASM differently and build timestamps differ, so
the digest records actual hosted bytes and is not compared across builds.

## Nightly browser selection

The previous green ordinary passes took 30m03s on Firefox and 37m15s on WebKit,
while installation was under one minute. File durations from that run now feed
three LPT shards per engine. Unknown specs receive the engine median. Workers
remain two, retry count remains one, and serial tests run once per engine on
separate runners even after an ordinary failure. Artifacts identify engine,
shard and pass. The aggregate requires both matrices to succeed; corpus cadence
and manual defaults are unchanged.

Executable CLI discovery checks every shard against its unsharded engine suite,
requiring exact union, no overlaps and no serial leakage. Aggregate shell logic
is exercised across all 16 ordinary/serial verdict combinations.

## Validation ledger

- URL entry: both regressions failed on actual incorrect HTTP paths before the
  fix; 2 Chromium and 4 WebKit/Firefox cases passed without retries afterward.
- AI/model scope: 319 focused tests, scoped TypeScript/lint/format passed.
- CI/deploy scope: 210 focused tests, scoped lint passed; independent review
  approved source identity, host policy, partitioning and failure propagation.
- Storage scope: 192 focused tests passed after review fixes; the final key-only
  optimization passed 68 tests across its three affected files. Independent
  whole-branch review approved the final source and ownership contracts.
- Production build passed; its actual identity matched the current commit and
  its HTTP response had `Cache-Control: no-store`. Preview smoke now verifies
  the deployed PR head's identity before running browser tests.
- Chromium: all 6 new/strengthened save, reload, copied-page and URL cases passed
  without retries against the production build.
- Full unit coverage: 253 files / 6813 tests passed with two local workers;
  statements 87.63%, branches 83.72%, functions 88.52%, lines 90.18%; configured
  thresholds passed. An earlier unbounded local run was interrupted after
  unrelated timeouts during severe host contention; no test timeouts changed.
- WebKit/Firefox: 11 save/reload/copied-page/URL cases passed without retries;
  WebKit retained the existing writable-OPFS capability skip for the held
  recovery/manual-save case. Together with Chromium: 17 passed, 1 existing
  capability skip.
- Production build, formatting including 1511 immutable evaluation artifacts,
  TypeScript/lint and Compose validation passed. Final pre-push freshness and
  latest-head remote acceptance are recorded in the PR's verification section.
