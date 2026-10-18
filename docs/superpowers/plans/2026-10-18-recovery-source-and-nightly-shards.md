# Recovery Sources and Nightly Shards Implementation Plan

**Goal:** Fix the six confirmed follow-up defects and shorten nightly cross-browser feedback, with regressions, separate commits, a PR and green CI.

**Architecture:** Keep recovery bytes in the existing history/source owners, preserve complete model-source identity and provider completion semantics, and make CI identify exact deployed builds. Split ordinary browser suites across isolated runners while keeping serial cases exclusive.

**Tech stack:** TypeScript, IndexedDB, Vite, Vitest and Playwright.

**Authorization:** The user explicitly requested all six findings, nightly sharding, regression tests, multiple commits, push, PR and CI follow-up. Execute within these boundaries without additional approval steps.

## Assumptions and scope lock

| Fact                                                    | Evidence                                                                                                                    |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Disk save does not update restored bytes                | Actual store/recovery probe returned older snapshot and original bytes; `lib/history/index.ts` only calls `markSavedToDisk` |
| A copied page can invalidate the original source        | Actual Chromium tabs inherited the same pointer; `rememberActiveSource` deleted its record                                  |
| Startup decodes nested document URLs twice              | Actual HTTP probe changed encoded slash, ampersand and hash into separators                                                 |
| Gemini normal STOP is rejected by artifact revision     | Actual Gemini JSON/SSE provider probes both ended with `incomplete`                                                         |
| Cached custom sources sharing preset IDs lose their URL | Actual model-cache settings UI probe cleared source controls                                                                |
| Production identity compares only editor JS             | `prod-smoke.yml` compares content-derived editor asset and succeeds after timeout                                           |
| Browser execution dominates nightly time                | Latest green run: Firefox ordinary pass 30m03s, WebKit 37m15s; installation under one minute                                |

Allowed: existing history/source/save owners and their tests; `index.ts` and startup regressions; artifact revision and model cache settings/identity consumers and tests; build/deploy identity scripts, host cache policy and CI workflows; browser shard selection/timing/artifact helpers and tests; exploration/changelog documentation.

Untouched: vendor engine/fonts, model weights, provider destinations/defaults, embed message shapes, storage retention periods, corpus cadence, context limits, existing retry counts and L0 policy. No paid provider calls. No merge.

## Tasks

1. **Saved bytes and copied tabs** — update the existing source/history/save completion path so successful current saves can be restored ahead of older snapshots, while newer edits/snapshots remain authoritative. Preserve source records other pages can still reference. Test old/no snapshot, later unsaved revision, cross-document/cancellation/overlapping saves, denied storage and copied-page ownership. Add real-browser save/reload and copied-tab regressions.
2. **Exact URL opening** — remove the second decoding in `index.ts`; exercise startup with real nested URLs containing `%2F`, `%26`, `%23`, literal percent, Unicode and normal queries. Verify real server request paths rather than source regexes.
3. **Gemini artifact completion** — use compatible completion validation in `artifact-workflow.ts`; exercise actual Gemini JSON/SSE normal STOP and abnormal terminations, preserving rejection of tools and partial output.
4. **Model source identity** — select/use/delete caches by complete resolved source identity in `model-cache-settings.ts` and existing source helpers if necessary. Preserve URLs for custom sources sharing preset IDs; test current/mirror identity and deletion without unloading a different source.
5. **Exact production deployment** — generate a build-owned deployment identity covering the repository revision and relevant served content; production polling compares that identity, explicitly failing a bounded timeout. Serve the marker fresh on supported hosts. Execute scripts against local HTTP fixtures for matching/stale/missing/failed responses and verify marker generation on real builds.
6. **Nightly shards** — use measured per-engine file timings to split ordinary WebKit/Firefox cases, with deterministic median fallback. Run serial cases separately once per engine even after ordinary failures, unique artifacts per engine/shard/pass, and unchanged aggregate check/cadence/retry/worker policy. Test complete/disjoint CLI selection and failure propagation; dispatch the full browser/budget workflow on final head.

For every task: write and observe a failing regression, implement the smallest fix, run focused checks, independently review, then commit separately. The root agent alone stages/commits/pushes; parallel workers own disjoint file sets and do not run builds or browser servers concurrently.

## Acceptance and verification

- All six reported triggers are protected by behavior regressions, including real persistence and provider parsing rather than only mocks.
- No stale async save or source cleanup overwrites a newer document/revision or another page's valid source; storage failure retains prior recovery.
- Production smoke cannot pass an old or missing deployment marker; deployment identity responds without stale worker/HTTP cache reuse.
- Ordinary shards are complete/disjoint for each engine; serial runs exactly once per engine, survives prior ordinary failure and cannot overwrite ordinary reports.
- Full formatting, lint/TypeScript, unit coverage and production build pass; focused Chromium/WebKit/Firefox regressions pass.
- Multiple commits pushed, PR attached, required main/preview checks and explicitly dispatched full nightly browser/budget checks pass on the latest head.

## Simplest alternatives

- Reusing original bytes or skipping old snapshots cannot restore the last disk save; persist the actual successful saved version through existing owners.
- Deleting a copied pointer's old record is unsafe; retain shared records under the existing expiry/deletion policy instead of introducing reference counting.
- Preserve the already-decoded query value rather than inventing another URL codec.
- Share normalized completion semantics instead of maintaining divergent provider-specific success lists.
- Compare full model source identity rather than model ID alone.
- Use a fresh build identity instead of a partial asset hash; fail deployment timeout rather than reporting an old site as verified.
- Split only ordinary browser execution; increasing workers/retries would change load or hide failures.

## Execution ledger

- Baseline: main `db4ddcd8`, clean checkout, 251 files / 6763 tests passed before work; previous PR fully green before merge.
- URL: RED observed for file/src HTTP paths; GREEN 2 Chromium + 4 WebKit/Firefox cases, no retries. Committed as `ae350c3d`.
- AI/model: 319 focused tests and scoped types/lint passed; independent scope review approved.
- CI/deployment: 210 focused tests and scoped lint passed; independent scope review approved.
- Recovery/source: 192 focused tests passed after review fixes; the final key-only change passed 68 tests in its three affected files. Independent whole-branch review approved.
- Full coverage: 253 files / 6813 tests passed with two local workers, all coverage thresholds met. An earlier unbounded run was interrupted after unrelated timeouts under severe host contention.
- Production browser regressions: 17 passed / 1 existing WebKit writable-OPFS capability skip across Chromium/WebKit/Firefox, no retries. Production identity and no-store HTTP response verified.
- Ruling: reuse the current clean checkout on a feature branch, with disjoint worker file ownership and root-only Git mutations/builds.
- Ruling: exact source SHA identifies deployment; served-tree digest records each host's actual bytes, since SW timestamps and Docker encoding differ across builds.
- Ruling: source-save completion must await browser persistence before clearing dirty, while storage denial keeps existing successful-disk-save semantics.
- Ruling: a page's saves reuse its runtime-owned slot; copies/reloads receive their own slot and inherited records retain the existing expiry policy. Dormant inherited pointers may see later saved bytes of the same document before opening.
- Ruling: saved precedence includes row creation identity and actual File provenance; key-only guards avoid cloning prior payloads and retain atomic deletion checks.

### PR delivery phases

1. Branch and separate commits: complete through implementation.
2. Full preflight quality/build/browser verification: passed; repeat freshness checks before push.
3. Independent final review: approved; English report accompanies the PR.
4. Resolve actionable findings: complete.
5. Conventional English PR title: set at PR creation.
6. Push/create PR/attach and follow latest-head CI: subsequent delivery; exact runs recorded in the PR.
7. Final checks, temporary report cleanup and result: recorded in the final delivery response.
