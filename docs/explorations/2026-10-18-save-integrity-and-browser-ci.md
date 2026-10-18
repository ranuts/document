# Save integrity, agent completion and browser CI implementation plan

**Goal:** Resolve the seven findings from the main-branch audit, balance CI shards, establish the WebKit networking failure's cause, and deliver a multi-commit PR with green CI.

**Architecture:** Keep ownership in the existing document-open and save-stream modules. Bind programmatic exports to their originating document and individual conversion. Preserve partial model output with an explicit incomplete outcome; fit document reads within the existing UTF-8 context budget. Correct browser fixtures and workflow artifact handling without changing production networking to accommodate mocks.

**Tech stack:** TypeScript, Vitest/jsdom, Playwright, GitHub Actions.

## Scope lock

The user approved all seven audit findings, CI balancing, WebKit investigation, regression tests, multiple commits, push and PR creation. No additional feature or merge is included.

| Assumption                                                                            | Evidence                                                                        | Status                 |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------- |
| Pending A exports can consume B; concurrent Ctrl+S is captured by an autosave request | Source probes of `save-stream.ts` and `open-state.ts` on `283ca850`             | Runtime verified       |
| Failed preprocessing leaves B metadata while A remains mounted                        | Actual document/converter probe with `NotReadableError`                         | Runtime verified       |
| Token/filter termination is treated as success                                        | Actual runtime/controller/queue probe, chat and streaming                       | Runtime verified       |
| Default document read exceeds the default byte budget                                 | Actual tools/runtime probe: 8000 ASCII and 2200 Chinese characters              | Runtime verified       |
| Clipboard permissions and report upload fail on nightly                               | Run 39071219706 logs                                                            | Runtime verified       |
| Service-worker control bypasses WebKit route mocks                                    | Reproduced with Playwright 1.62; current CI-version reproduction still required | Known measurement task |

- Allowed: `lib/onlyoffice/{save-stream,open-state}.ts`, document-open/mount lifecycle consumers, `lib/document.ts`, corresponding unit/E2E tests; `packages/agent-core/src/{runtime,context-budget,types}.ts`, agent controller/tool/budget consumers and localized messages; browser fixtures/configs, `.github/workflows/{ci,nightly-corpus}.yml`, CI shard selection utilities/tests and this record.
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

- [ ] Save ownership: add failing real-module regressions in `save-stream-lifecycle.test.ts`/save request tests; bind requests to document/editor/frame, reject retired requests and claim only the conversion initiated by that request; verify replacement, close, timeout fallback, overlap and conversion ordering. Commit separately.
- [ ] Open metadata: add failing tests in `document-open.test.ts` with preprocessing rejection and competing opens; stage metadata until successful mount or restore safely without undoing a newer owner. Verify existing local/URL/new/readonly flows. Commit separately.
- [ ] Agent completion: add runtime/controller/queue regressions for `length`, `max_tokens`, `content_filter` and streaming, including tool calls; propagate incomplete outcome/history and pause queue. Verify normal completion unaffected. Commit separately.
- [ ] Agent read budget: add real tool/runtime tests for ASCII/Unicode document reads and pagination/truncation behavior; coordinate tool result budget without breaking latest-turn protocol or increasing the global limit. Commit separately.
- [ ] Browser fixtures and WebKit: reproduce network mock bypass using the installed CI Playwright version and a real SW; fix fixture ownership, unsupported clipboard permissions and any directly exposed engine-specific failures. Keep expected error fixture self-check meaningful. Verify targeted WebKit/Firefox/Chromium suites. Commit separately.
- [ ] CI artifacts and balancing: retain separate normal/serial reports and traces, execute serial after normal failure, and ensure uploads find actual output. Measure representative shard distribution, ensure selected sets are complete/disjoint and preserve mandatory check names/worker semantics. Add behavior regressions for selection/artifact paths. Commit separately.
- [ ] Integration: run formatting, lint/types, full unit coverage, production build and focused real-browser regressions sequentially. Obtain a fresh whole-branch review, resolve findings, push/create PR, attach it to this task and follow every CI check until green. Run the corrected cross-browser lane against the PR head as part of acceptance.

## Verification record

Implementation and measured results will be recorded here as tasks complete. Temporary probes and downloaded CI logs stay outside Git.
