# Save integrity, agent completion and browser CI implementation plan

**Goal:** Resolve the seven findings from the main-branch audit, balance CI shards, establish the WebKit networking failure's cause, and deliver a multi-commit PR with green CI.

**Architecture:** Keep ownership in the existing document-open and save-stream modules. Bind programmatic exports to their originating document and individual conversion. Preserve partial model output with an explicit incomplete outcome; fit document reads within the existing UTF-8 context budget. Correct browser fixtures and workflow artifact handling without changing production networking to accommodate mocks.

**Tech stack:** TypeScript, Vitest/jsdom, Playwright, GitHub Actions.

## Scope lock

The user approved all seven audit findings, CI balancing, WebKit investigation, regression tests, multiple commits, push and PR creation. No additional feature or merge is included.

| Assumption                                                                            | Evidence                                                               | Status           |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------- |
| Pending A exports can consume B; concurrent Ctrl+S is captured by an autosave request | Source probes of `save-stream.ts` and `open-state.ts` on `283ca850`    | Runtime verified |
| Failed preprocessing leaves B metadata while A remains mounted                        | Actual document/converter probe with `NotReadableError`                | Runtime verified |
| Token/filter termination is treated as success                                        | Actual runtime/controller/queue probe, chat and streaming              | Runtime verified |
| Default document read exceeds the default byte budget                                 | Actual tools/runtime probe: 8000 ASCII and 2200 Chinese characters     | Runtime verified |
| Clipboard permissions and report upload fail on nightly                               | Run 39071219706 logs                                                   | Runtime verified |
| Service-worker control bypasses WebKit route mocks                                    | Reproduced with Playwright 1.64, WebKit 2370 and the production worker | Runtime verified |

- Allowed: `lib/onlyoffice/{save-stream,open-state}.ts`, document-open/mount lifecycle consumers, `lib/document.ts`, corresponding unit/E2E tests; `packages/agent-core/src/{runtime,context-budget,types}.ts`, agent controller/tool/budget consumers and localized messages; browser fixtures/configs, the assistant entry/focus owners and progress-row box sizing for directly reproduced cross-browser acceptance failures, `.github/workflows/{ci,nightly-corpus}.yml`, CI shard selection utilities/tests and this record.
- Untouched: vendor/archive assets, generated output, dependency versions, storage schema, credentials, production deployment configuration.
- Compatibility: preserve public embed request/response shape, original-file fallback opt-in semantics, dirty/save-point protection, read-only behavior, local/offline functionality, mandatory CI check names and per-runner worker counts. Preserve multiple commits as requested; do not squash.
- Simplest choices: existing ownership checks rather than a new event bus; result-level incomplete state rather than discarding partial output; bounded UTF-8 reads rather than raising the global context limit; engine-compatible test network boundaries rather than disabling production SW behavior; stable duration-informed sharding with complete/disjoint selection rather than adding workers.

## Review focus

- A pending export must reject on replacement/close and must never return the replacement's original bytes.
- An old failed open must not roll back a newer successful open's metadata.
- Manual saves during programmatic export must reach disk in both conversion completion orders.
- Incomplete model tool calls must not execute; partial text must remain visible and queued successors must pause.
- Browser mocks must work with a real controlling SW, and a failed first test pass must retain artifacts when the serial pass runs.

## Tasks and acceptance

- [x] Save ownership: add failing real-module regressions in `save-stream-lifecycle.test.ts`/save request tests; bind requests to document/editor/frame, reject retired requests and claim only the conversion initiated by that request; verify replacement, close, timeout fallback, overlap and conversion ordering. Commit separately.
- [x] Open metadata: add failing tests in `document-open.test.ts` with preprocessing rejection and competing opens; stage metadata until successful mount or restore safely without undoing a newer owner. Verify existing local/URL/new/readonly flows. Commit separately.
- [x] Agent completion: add runtime/controller/queue regressions for `length`, `max_tokens`, `content_filter` and streaming, including tool calls; propagate incomplete outcome/history and pause queue. Verify normal completion unaffected. Commit separately.
- [x] Agent read budget: add real tool/runtime tests for ASCII/Unicode document reads and pagination/truncation behavior; coordinate tool result budget without breaking latest-turn protocol or increasing the global limit. Commit separately.
- [x] Browser fixtures and WebKit: reproduce network mock bypass using the installed CI Playwright version and a real SW; fix fixture ownership, unsupported clipboard permissions and any directly exposed engine-specific failures. Keep expected error fixture self-check meaningful. Verify targeted WebKit/Firefox/Chromium suites. Commit separately.
- [x] CI artifacts and balancing: retain separate normal/serial reports and traces, execute serial after normal failure, and ensure uploads find actual output. Measure representative shard distribution, ensure selected sets are complete/disjoint and preserve mandatory check names/worker semantics. Add behavior regressions for selection/artifact paths. Commit separately.
- [ ] Integration: run formatting, lint/types, full unit coverage, production build and focused real-browser regressions sequentially. Obtain a fresh whole-branch review, resolve findings, push/create PR, attach it to this task and follow every CI check until green. Run the corrected cross-browser lane against the PR head as part of acceptance.

## Verification record

Temporary probes and downloaded CI logs stay outside Git. Integration delivery remains open until the PR and the explicitly dispatched cross-browser workflow pass on the pushed head.

### Implementation and review

- Programmatic exports capture document/editor/lifetime identity. Replacement and close abort pending requests; manual saves retain their own disk route. Cold tracking is installed before export. Native deferred PDF pagination preserves conversion ownership through the actual SDK download options.
- Open metadata is published only after mounting succeeds. Preprocessing rejection leaves the mounted document's exact metadata object intact; stale failures cannot undo a newer winner.
- Token, filter and abnormal provider terminations retain partial output, prevent tool execution, mark the result incomplete and pause queued successors. Direct generation consumers share the same completion guard. Gemini explicit abnormal termination defaults to incomplete, including future unknown reasons.
- Only document read results opt into structured UTF-8 fitting. Earlier reads can shrink as later tool exchanges consume space; serialized escaping and Unicode count toward the existing limit. A terminal large write still executes once without a needless further inference.
- Browser API fixtures use a real local HTTP boundary while retaining the production controlling worker. Clipboard tests inspect the application's exact write payload without unsupported permission grants.
- Nightly normal and serial passes have separate reports/results. Serial cases still run after normal failure. A manual-only option can validate browsers and budgets without the weekly corpus matrix; schedules and defaults retain their previous behavior.
- Three independent review partitions found deferred native export ownership, sequential read refitting, and same-basename shard collisions. All were corrected with failing-then-passing regressions and focused re-review.

### WebKit characterization

The production worker causes controlled WebKit requests to bypass Playwright page route mocks; the same characterization passes in Chromium. Missing fixture responses were consequently sent to the network. Real local HTTP fixtures resolve this at the browser network boundary, without disabling worker control or changing production API routing.

A separate offline-worker defect returned `undefined` when both network and cache missed a hashed asset. Returning `Response.error()` preserves a valid response and the expected network rejection. WebKit additionally emits loader page errors for caught optional offline module imports; the offline regression only permits the precise failed optional URLs and still verifies prepared CPU assets load.

WebKit CacheStorage can retain cache names but lose page-written bodies across renderer navigation. Restore setup now seeds outgoing markers immediately before real worker registration in the same document. The application restore path remains under test.

For native keyboard scrolling, a standalone overflowing focused `pre` reproduced the zero-duration key press failure. A 100 ms physical key hold passes without changing the product or weakening the scroll assertion. The original hierarchy case failed three times, then passed three times; the composer code/table case also passed.

### CI partition measurements

Deterministic duration-based selection uses measured per-file main-CI durations, median fallback for new files and the existing worker counts. Estimated work is approximately 1185 seconds per preview/Docker shard and 516–518 seconds per Pages shard. These are estimated execution costs, not wall-clock guarantees. Actual Playwright CLI selection is tested for complete, disjoint coverage, including root/nested files sharing a basename. Existing required summary check names remain stable.

### Local verification

After the implementation freeze, full coverage passed: 249 files and 6712 tests; statements 87.45%, branches 83.51%, functions 88.26%, lines 90.01%. All configured thresholds passed. Formatting (including 1511 immutable archive artifacts), oxlint/TypeScript, production build and Compose configuration all passed. Real deferred PDF export has passed Chromium, WebKit and Firefox; the concurrent manual disk-save regression has passed Chromium. Full browser and deployment matrices remain part of remote CI acceptance.

### Cross-browser acceptance follow-ups

The first main CI matrix exposed two fixture migration defects: an expected Chromium same-origin security diagnostic was missing from its test-local allowance, and request/response observers still compared raw paths after the HTTP transport encoded the original URL. A guarded logical-URL decoder now serves both positive and negative assertions, with real browser network-event regressions. The subsequent main CI run `39094583253` passed every job.

Additional current-build reproductions established two small product defects: Firefox can reject initial cross-frame focus while docking, and the editor rail's mousedown handler can queue a later focus that steals the WebKit composer. A guarded one-frame fallback and isolated assistant-entry mousedown preserve explicit external focus, closure and view-switch intent. Four panel intent cases and an actual ancestor-handler sidebar regression were added. Firefox's native progress border also exceeded its grid track by two pixels; border-box sizing fixes the existing strict geometry regression.

The main-site save test now independently measures the browser's native filename policy while asserting the exact application download attribute and edited document bytes. This retains the application contract across platform filename formatting.

Observed successful matrix job durations in run `39094583253`: preview shards 8m32s / 10m26s / 10m30s; Docker 10m33s / 10m51s / 10m23s; Pages 8m00s / 9m37s / 10m01s / 9m21s / 6m52s. The previous measured longest preview shard was 14m05s and Pages 13m17s. These are per-run observations, with runner-load variation, rather than a controlled benchmark.

Final local acceptance after the follow-up fixes: 249 unit files / 6712 tests passed with all coverage thresholds (statements 87.45%, branches 83.51%, functions 88.26%, lines 90.01%). Formatting, oxlint/TypeScript, production build and Compose configuration passed again. On that fresh production build, the existing focus/loading/save scenarios passed on WebKit/Firefox (8 cases) and Chromium (4 cases), followed by all four WebKit/Firefox serial font-ordering and silent-worker-update cases, with zero retries.

A final fixture audit reproduced another WebKit route bypass in the loading-layout test: despite a controlling worker, its Hugging Face page-route interception count remained zero. That test now holds model fetches through the real HTTP fixture and asserts requests are held for both the initial load and retry before measuring layout or cancelling. Existing strict layout, focus and cancellation assertions passed on WebKit/Firefox (4 cases) and Chromium (2 cases). This follow-up changes only the test boundary; production sources match the already verified build.

### Nightly engine partition scope lock

The user-authorized CI partition optimization also applies to the remaining nightly bottleneck. Main CI now completes roughly 332 Chromium cases with six workers across three runners in about ten minutes; the complete nightly pass puts both engines, roughly twice that work, on one runner with two workers. The first diagnostic run has exceeded fifty minutes. Split the existing nightly browser work by engine without increasing per-runner concurrency.

- Files: `.github/workflows/nightly-corpus.yml` and focused workflow/CLI selection regressions only.
- Design: a fail-fast-disabled WebKit/Firefox matrix, engine-specific browser installation and project selection in both normal and serial passes, unique per-engine artifacts containing both report directories, plus an aggregate job retaining the original `Cross-browser (WebKit + Firefox)` check name.
- Compatibility: unchanged scheduling, gate decisions, corpus/budget jobs and manual defaults; two workers per normal runner and one per serial pass; serial execution after a normal-pass failure; no application or dependency changes.
- Acceptance: actual project selection covers each engine exactly once; workflow regressions prove both passes use the selected project, artifacts cannot collide and the summary rejects any failed matrix result; focused tests and formatting pass, then the complete split workflow passes on the pushed PR head.

The engine partition is implemented and independently reviewed without actionable findings. Focused workflow regressions passed 69 tests after the expected RED run. Independent real CLI discovery proved complete, disjoint sets: normal 688 cases = 344 WebKit + 344 Firefox, serial 4 cases = 2 + 2. The final runtime acceptance is the split workflow on the next pushed head.

### Full nightly fixture acceptance

The first complete split run (`39096982286`) passed Firefox but exposed five deterministic WebKit fixture failures. Both engine artifacts retained normal and serial HTML reports; WebKit's failed normal pass still ran and passed its two serial cases, confirming failure-report retention in the actual workflow.

- Two remaining URL-open fixtures still used page routes. Instrumented original tests recorded zero route interceptions while the embed host was worker-controlled. Both now use the existing HTTP fixture, assert exactly one handler request, and retain precise 404, successful replacement, retry and saved-byte assertions.
- Native WebKit exposes the save button as `Save (⌘+S)`. The formatted-content round trip now accepts the exact native Ctrl/Command labels while retaining saved-content and Undo checks.
- GTK WebKit normalizes spaces in downloaded filenames. Structured CSV export independently measures native filename policy, asserts the application's exact `Release table.csv` anchor name, and verifies all 26 rows, edited content and escaped formula bytes.
- WebKit discarded the history fixture's instance-level `indexedDB.open` override during startup. An exact local reproduction found the init probe present but untouched, the method restored to native and saved history already rendered. Patching `IDBFactory.prototype.open` preserves the receiver and arguments. Early held-history/status/empty-transcript preconditions now prove the intended startup ownership race actually runs before request submission.

These follow-ups change only test boundaries and assertions. All five affected scenarios passed on Chromium, WebKit and Firefox (15 cases total, no retries). Fresh focused reviews found no actionable issues; final remote acceptance remains attached to PR #281 on its latest pushed head.

### Native focus ownership follow-up scope lock

The next full run passed WebKit but Firefox failed the first dictation setup twice. Actual trace snapshots show `Connect first` in the SDK's hidden `area_id` textarea while the parent composer remains empty. Local nominal runs pass, identifying a timing-dependent focus race rather than a changed readiness label. SDK source and instrumented focus stacks identify unconditional native/deferred editor-focus paths; the precise late callback differs with timing.

The existing user-authorized cross-browser acceptance scope includes assistant focus owners. Bound this repair to a same-origin iframe focus guard, its existing preparation integration, explicit assistant focus claims and focused unit/E2E regressions. Preserve native focus calls unless a connected, visible assistant control currently owns focus. Explicit editor pointer/keyboard handoff, external focus, closure and hidden views must release that ownership. Keep vendor assets, public APIs, storage and provider contracts unchanged. Prove the real SDK's delayed focus cannot redirect composer text, and genuine editor input remains usable; rerun source checks and complete CI on the pushed head.

The actual SDK regression failed on both Firefox entry paths before the guard. It now protects only exact native document focus targets (including live SDK input references), leaving modal and toolbar focus native. A second instrumented reproduction showed Firefox delivering the parent composer click without transferring focus out of the iframe; a single animation-frame retry completes that explicit handoff only while the same visible target still owns it and the guarded editor remains active. New editor/other-control intent cancels the retry. Tests retain genuine document typing and native modal focus assertions; no retries or timeouts were relaxed.

Final local source validation: 250 unit files / 6753 tests passed; statement/branch/function/line coverage 87.49% / 83.56% / 88.30% / 90.03%. Production build, full formatting, oxlint/TypeScript and Compose validation passed. The native focus regression passed both entry paths on Chromium, WebKit and Firefox (6 cases, no retries). CLI discovery confirms normal nightly selection 692 = 346 + 346 and serial selection 4 = 2 + 2. Independent focused review found no unresolved actionable issues.

### Cached browser system dependency follow-up scope lock

Run 39103182477 cannot launch WebKit: every browser-dependent case exits before navigation because `libevent-2.1.so.7` is absent. Setup logs prove a binary-cache hit skipped apt entirely on the fresh Ubuntu runner. Browser binaries do not cache system libraries. Bound this follow-up to `.github/scripts/install-playwright.sh`, its executable unit regressions and existing workflow contract comments. Preserve cached Chromium's established fast path and explicit advisory refresh; require bounded, retried system dependency installation for every cached non-Chromium browser (including mixed selections), and fail installation clearly if it cannot succeed. Cold browser installation, job topology, schedules and test retries remain unchanged.

### Cache fixture ownership after navigation

Final-head run 39103705490 passed main/preview/budget and both complete browser passes, but WebKit's cached-model command-style case retried after seeing zero models. A focused production-build rerun reproduced that precondition failure three times without retries. Instrumented probes observed the instance-level `navigator.storage.getDirectory` override restored to native after navigation, and separately observed seeded Cache API entries unavailable after navigation. The browser's underlying storage behavior is not inferred beyond these observations.

Bound the repair to this UI fixture: define its fallback override on the storage prototype, navigate to the ready editor before seeding, and verify the override and two real cache entries before opening the assistant. This case tests delete/confirmation/pending styling, so it does not need a landing-to-editor persistence precondition. Keep all existing cancellation, danger styling, pending deletion and final-removal assertions and existing retry/timeout policy. Independent focused review found no actionable issues; the corrected case passed three consecutive runs on each of Chromium, WebKit and Firefox (nine cases, no retries).

### Exact baseline before the overlapping save

Run 39106538022 passed the final cache-model fixture but Firefox's overlapping recovery/manual-save case failed twice: saved text was `Recvery version manual version`, then `Reovery version manual version`. The trace's screencast at 1547492.945 already shows `Recvery version` before the recovery hook is installed at 1547624.42, proving the missing letter precedes conversion. The individual native callback responsible for initial key loss is not inferred.

Keep this regression focused on ownership of a real blank-document save: prepare initial text through one real browser `keyboard.insertText` input after a physical editor click, assert exact live paragraphs before arming recovery, and assert the unchanged real per-key manual edit before actual Ctrl+S while conversion delivery remains held. Preserve exact saved bytes, one committed disk write, one picker call and the eventual recovery row. Do not alter the shared typing helper, product code, retries or timeouts.

The corrected overlap case passed three consecutive runs each on Firefox and Chromium (six cases, no retries). WebKit retained its existing three capability skips because writable OPFS is unavailable; no skip logic changed. Independent focused review found no actionable issues.
