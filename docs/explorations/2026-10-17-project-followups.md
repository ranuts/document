# Complete the project analysis follow-ups

Baseline: `a3b9eb3c`; continuation of PR #279. The user authorized completing
all six items in the original analysis, preserving separate commits and updating
the existing PR. Recovery rollback, request deadlines and Gemini classification
already have verified fixes. This plan covers the remaining gaps.

## Scope and evidence

| Item                     | Current evidence                                                                        | Planned result                                                                                                                            |
| ------------------------ | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Response memory bound    | `provider-http.ts` appends decoded bytes without a size check                           | Enforce a configurable total byte ceiling for JSON and streams; cancel on overflow.                                                       |
| Optional offline runtime | `offline-assets.mjs` gathers every emitted runtime; `agent-entry.ts` requests all of it | Prepare only selected capability assets; retain prepared capability state through updates.                                                |
| Panel ownership          | `panel.ts` owns configuration controls, request execution and workspace coordination    | Extract cohesive owners with explicit narrow dependencies; preserve lifecycle and product behavior.                                       |
| Incremental answers      | OpenAI, Gemini and Loopback expose only `chat`                                          | Implement their native incremental protocols using existing `chatStream`; keep tool and document writes on completed validated responses. |

## Change boundaries

- Request work: `packages/agent-core/src/llm/{provider-http,openai,gemini,ollama,loopback}.ts`,
  small protocol helpers, provider unit tests and streaming browser regressions.
- Offline work: `bin/offline-assets.mjs`, `public/{sw,sw-register}.js`,
  `lib/assistant-offline.ts`, capability activation call sites and offline tests.
- Panel work: `lib/agent-plugin/ui/panel.ts`, cohesive adjacent owners and focused
  UI tests. The offline task owns runtime activation hooks; coordinate overlapping
  call sites before editing.
- Parent owns shared changelog, documentation, Git commits/push and PR updates.
- Do not edit immutable evaluation archives, vendored editor/runtime code,
  dependencies, save destinations, document approval policy or model defaults.

## Compatibility and simplest alternatives

Use existing neutral provider methods and runtime events rather than a new UI
streaming contract. Stream only tool-free requests initially; tool-bearing
requests fall back to the complete response path. Use build-owned capability
allowlists rather than accepting asset URLs from pages. Extract concrete panel
responsibilities without introducing a generic dependency framework. Preserve
caller cancellation, the five-minute total deadline and safe status errors.

A missing terminal stream marker is a failure, not a completed answer. Keep
schema-constrained document generation complete and validated before applying.
Cloud requests never start local inference downloads. Prepared capabilities must
remain usable after service worker updates and in offline sessions.

## Execution and acceptance

1. Add failing response-size and native streaming regressions; implement bounded
   shared transport plus OpenAI/Gemini/Ollama and Loopback support.
2. In parallel, split offline capabilities and panel owners in disjoint files;
   run focused tests and reverse-verify changed behavior.
3. Review every task against its consumers, then run full unit coverage, lint,
   types, formatting, build and targeted real-browser regressions including
   recovery, requests, streaming and offline upgrades.
4. Commit each topic independently, push and update PR #279 with final evidence.

This document records the accepted implementation boundary for the user's
request to complete the original list. Regression tests establish runtime
behavior; source inspection alone does not establish memory or timing gains.

## Implementation evidence

- Added a configurable 8 MiB response ceiling. Twelve byte-bound regressions
  failed without it; 47 combined HTTP lifetime/bound tests passed afterward.
  Limits count the actual stream bytes, so a missing or false Content-Length
  cannot bypass them. Host-only `json()` transports retain a post-read check.
- Shared transport now owns bounded incremental decoding and early consumer
  cancellation. Tool-free OpenAI/Ollama use SSE, Gemini uses
  `streamGenerateContent?alt=sse`, Loopback uses native NDJSON. Compatible complete
  JSON responses remain accepted without resending the request. Schema generation
  and tool-bearing requests keep the complete-response path.
- Thirty-two streaming regressions cover byte-split UTF-8 and CRLF, early text,
  incomplete EOF, total deadline, size ceiling, host JSON responses, callback
  failure, reentrant Stop, thought exclusion and safe in-band errors. The initial
  24 cases failed while the APIs were absent. Independent review reproduced two
  further bugs (Gemini terminal event waited for EOF; Loopback rejected bodyless
  host JSON); their tests failed then passed with fixes. Scoped re-review is clean.
- Native protocol references checked during implementation:
  [OpenAI streaming events](https://developers.openai.com/api/reference/resources/chat/subresources/completions/streaming-events),
  [Gemini generate content](https://ai.google.dev/api/generate-content), and
  [Ollama chat](https://docs.ollama.com/api/chat). Fixtures exercise local adapters;
  they do not certify a live account or endpoint.
- Offline build graphs now separate WebGPU, Wllama, CPU, compatibility runtimes
  and PDF. Runtime activation callbacks request only the matching allowlist.
  Per-capability markers restore the union across older worker caches and retain
  legacy prepared users. Remote-only setup performs no local runtime preparation.
- Panel model configuration, destination policy, deterministic command execution
  and workspace navigation have concrete adjacent owners. Request/session
  lifetimes remain with the existing lifecycle owners. The panel shrank from
  3,480 to 3,116 lines. Cross-review also removed unwanted WebGPU cache discovery
  during service/CPU setup; explicit cache inventory remains available.
- Integrated review found the same unwanted scan after CPU model preload. Its
  regression observed four GPU cache checks while the CPU model was already
  usable; both automatic refresh sites now require WebGPU selection or explicit
  inventory visibility. A native delayed disclosure event also triggered scans
  after panel removal; its failing regression now checks the connected-state
  guard. Tests wait for the native event instead of manually dispatching it.
- The first combined coverage/build run reported three wall-clock timeouts in
  unchanged large-inflation/model-byte fixtures. All 18 tests in those two files
  passed in a single-worker rerun without changing test deadlines. Two SW
  lifetime cases exposed an incomplete Cache mock; adding native `match`
  semantics preserved their existing retention/deletion assertions, and 197
  SW/offline tests passed. Final verification below uses a new assembled run.

## Final verification

- Full unit coverage: **6,288 tests in 238 files pass**, with 89.56% lines,
  83.08% branches, 87.90% functions and 86.99% statements. Every repository gate
  passes. Command: `pnpm run test:coverage --maxWorkers=2`.
- Archive integrity, full lint/workspace declaration/app type checks and full
  formatting pass. The final cache-lifecycle changes additionally pass focused
  oxlint and app TypeScript checks against refreshed workspace declarations.
- Production build passes on final sources. Existing large-chunk and ineffective
  dynamic-import warnings remain; this work does not claim to eliminate every
  bundler warning.
- Independent scoped and integrated reviews are clean after the terminal-stream,
  host-JSON, post-load CPU-cache and detached-disclosure corrections.
- All 35 distinct Chromium cases are verified. The main run passed 34 and found
  a rewritten offline fixture missing its baseline online editor warm-up. The
  trace identified the intentionally on-demand vendor SDK chunk, while CPU
  assets were already available offline. Restoring that precondition yielded
  3/3 passing offline cases in 9.1 seconds; no production change was needed.

Measured optional asset sizes from the production capability lists (raw files,
not compressed transfer size): WebGPU 11.42 MiB; Wllama 8.26 MiB; its compatibility
runtime 14.82 MiB; CPU 6.42 MiB; CPU compatibility 12.52 MiB; PDF 1.41 MiB. A
runtime prepares its compatibility capability only when the platform needs it.

Browser verification command (production build served by Vite preview):

```sh
E2E_BASE_URL=http://127.0.0.1:4197 E2E_PORT=4197 pnpm exec playwright test \
  test/e2e/history-quota.spec.ts test/e2e/agent-error-recovery.spec.ts \
  test/e2e/autosave-recovery.spec.ts test/e2e/main-site.spec.ts \
  test/e2e/agent-request-queue.spec.ts test/e2e/agent-cloud-streaming.spec.ts \
  test/e2e/assistant-offline-assets.spec.ts test/e2e/agent-document-references.spec.ts \
  test/e2e/agent-workspace.spec.ts test/e2e/agent-workspace-consistency.spec.ts \
  test/e2e/agent-sources-artifacts.spec.ts --workers=1 --reporter=line
```

This verification uses Chromium and deterministic endpoint/storage faults. It
covers real editor/UI, IndexedDB, CacheStorage and service-worker behavior. It
does not certify live cloud provider accounts, physical disk exhaustion, a real
model inference on every backend, or complete Firefox/WebKit/Docker/hosting
coverage of this final revision. Upgrade restoration uses genuine persisted
older-build CacheStorage markers, without changing a deployed worker script.
