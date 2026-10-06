# WebKit runtime availability investigation

The current product CPU model fails to load in isolated Playwright WebKit 26.5. WASM feature presence alone is insufficient to establish availability.

| Check | Direct evidence | Result |
| --- | --- | --- |
| Built editor and AI entry | webkit-cpu-model.json | Entry opens; model initialization fails in 336 ms; no page errors or failed requests recorded |
| Source provider diagnostic | webkit-cpu-load-diagnostic.json | UnknownError: operation failed for an unknown transient reason; empty stack |
| OPFS operation | webkit-storage-diagnostic.json | navigator.storage.getDirectory throws the same UnknownError before any model is loaded |
| Cache API | same primitive report | Open succeeds; small response write/read/delete round-trip succeeds |
| WASM feature presence | webkit-capabilities.json | JSPI and MEMORY64 present; not proof of successful model inference |

Severity: high availability gap for this tested WebKit configuration. This is not a claim about every Safari version or actual iOS hardware.

Installed wllama 3.6.1 defaults CacheManager to a COSBackend that delegates private storage to OPFS. Its supported check tests whether getDirectory exists; it does not prove the method succeeds. The direct storage failure and matching provider exception identify OPFS as a concrete obstacle. Other runtime obstacles remain possible after removing it.

The SDK accepts a custom CacheManager backed by StorageBackend. An isolated experimental Cache API backend is currently testing the same revision-pinned 484 MB model. Its actual load and inference must complete before product integration can be justified. Small-file Cache API success cannot establish large-model quota, storage reliability or inference compatibility.

Required follow-up: inspect the live experimental process; do not restart simply because an observation wait expires. If the cache experiment succeeds, implement functional storage selection with same-origin cache keys, stream writes, metadata/list/delete support and offline verification. Preserve existing OPFS caches on Chromium and handle quota/permission errors explicitly. Continue native/compat WASM and actual model verification separately.

The upstream [compatibility guide](https://github.com/ngxson/wllama/blob/master/compat/README.md) describes alternative builds for missing JSPI/MEMORY64 and self-hosted assets. That is a separate concern from this observed storage failure. The installed source and actual browser probes take precedence over a blanket inference from the browser name.

## Staged experiment findings

The original unstaged experiment was intentionally terminated after its missing phase diagnostics could not be repaired in place; the own browser process exited. An attempted own-process inspector was unavailable because the local port was occupied; no other process was inspected. This administrative termination is not evidence of model-load failure. A new, instrumented diagnostic records request/response and cache operations and has an explicit 180-second bound.

`2026-10-02-webkit-cache-staged-probe.json` records successful HEAD/GET responses, the full 484,220,320-byte download and completed model/metadata cache writes. The default runtime subsequently emits an unhandled CompileError: **Memory64 is not enabled**, and its load promise does not settle before the diagnostic bound. There is no model reply. Cache API removes the observed OPFS obstacle, but it does not solve this separate native-WASM compatibility problem.

`2026-10-02-wasm-memory64-validation.json` directly compares the same minimal memory64 module in both browsers. Chromium validates it; WebKit does not. Both browsers' Memory constructor and JSPI presence probes succeed. Therefore the earlier Memory constructor test, and the installed SDK's equivalent test, are insufficient. Actual module validation must inform runtime selection. Compatibility resources have been installed at matching version 3.6.1 for the next experiment; production runtime integration remains unfinished.

Required next validation includes forced self-hosted compatibility selection when module validation fails, rather than relying on the SDK's inaccurate constructor probe; actual WebKit inference; and bounded worker initialization failure propagation. The last requirement prevents a compile error from leaving the loading UI waiting indefinitely. Cache selection, compatibility selection, CSP and offline restoration must each be verified before claiming WebKit support.

## Reproducible runtime-selection correction

The pinned pnpm patch for wllama 3.6.1 replaces its ESM and CJS Memory constructor probe with validation of a minimal memory64 module. Two regression cases evaluate the installed SDK helper directly: constructor acceptance with failed module validation must select compatibility, successful validation selects native, and validation exceptions return unsupported. Both cases failed before the patch and pass after it. No browser globals or private runtime methods are overridden by product code.

`2026-10-02-wllama-resource-selection.json` records actual fresh SDK resource selection in isolated Chromium and WebKit: Chromium chooses native resources; WebKit chooses the supplied compatibility WASM and worker. This is resource selection only: neither asset compilation nor model inference occurred. The first probe used a stale module from the running Vite server; its result is preserved in `2026-10-02-wllama-resource-selection-before-dev-cache-refresh.json`. Comparing served source established the stale constructor helper, and a cache-busted module URL supplied the patched helper. The production build was regenerated independently.

Matching compatibility assets are pinned at 3.6.1 with lockfile integrity, but the product provider still disables compatibility; integration and functional Cache API fallback remain required. Full regression: 96 files / 3,739 tests pass, lint and TypeScript checks pass, production build succeeds. Existing PromiseRejectionHandledWarning and build chunk warnings remain. Lint initially scanned a temporary upstream patch checkout; moving that checkout outside the repository restored the intended lint scope. This evidence does not establish Safari or iOS model support.

## Actual compatibility-model experiment

`2026-10-02-webkit-compat-model-probe.json` tests the same revision-pinned model and experimental Cache API backend with the patched SDK imported using a cache-busted URL, local compatibility WASM and raw worker code, and public `setCompat(..., 'firefox_safari')`. The full model and metadata writes complete. Worker startup proceeds to cached model reads, but model loading does not resolve within the 180-second diagnostic bound. No inference is attempted and no reply exists. The captured error console contains only `Event`, without a useful exception message; the earlier native Memory64 CompileError is absent from captured logs, which does not prove successful compilation.

The diagnostic exits with status 1 after saving its report and closing its own browser. This is a completed bounded experiment with an **incomplete load result**, not evidence that compatibility inference works or that slow loading is the cause. Next investigation must capture page/worker error details and phase boundaries inside worker initialization, asset response types and model loading before drawing an architectural conclusion or integrating this path into the product. No product provider behavior was changed by this experiment.

## Worker source correction and actual inference

`2026-10-02-webkit-compat-worker-diagnostic.json` captures the missing exception: **SyntaxError: Unexpected end of script** in the compatibility worker. The diagnostic fetched the Vite-served JS as text; Vite appends a sourceMappingURL line comment without a trailing newline. The SDK wraps that source inside a function on the same final line, so the comment consumes its closing code. A separate syntax-only check of the SDK's exact wrapping reproduces failure with the served source and succeeds with the original package source. This was a diagnostic asset-loading defect, not evidence that compatibility WASM cannot run. The SDK also logs worker errors without rejecting pending initialization tasks, explaining the unresolved promise after this syntax error; product initialization failure handling remains required.

The corrected experiment imports the worker using Vite `?raw`, as prescribed by the upstream compatibility guide. `2026-10-02-webkit-compat-raw-worker-probe.json` records actual success: the same 484,220,320-byte model loads in 64,492 ms and returns **Hello! 😊**, with 16 prompt tokens and 5 completion tokens. Captured console errors and page/worker errors are empty. This establishes one real inference in isolated Playwright WebKit using local compatibility assets and experimental Cache API storage. It does not establish production integration, offline restoration, actual Safari/iOS availability, sustained lifecycle reliability or multilingual quality. The extra emoji also fails the request's strict output constraint.

Next product work can now proceed from a successful reference: lazy self-hosted raw compatibility assets selected by actual WASM capabilities; functional OPFS selection with Cache API fallback; pending initialization error propagation and cancellation ownership; then production CSP and offline/model lifecycle verification. Keep the native Chromium cache path intact when functional.

## Product storage fallback

The provider now opens the actual OPFS cache directory before choosing the SDK's default storage. A successful open retains that backend and its existing cached models. Missing or rejecting OPFS selects a dedicated Cache API backend with same-origin synthetic keys, streamed Response writes, Blob reads, metadata-aware listing and idempotent deletion. Quota/write/open failures propagate; no ephemeral fallback reports false persistence. Cancellation is checked after storage selection before creating the runtime.

Five regression tests failed against unimplemented storage and pass with the backend and selector. They cover URL-like/Unicode keys, independent metadata, missing sizes, deletion, quota failure, functional OPFS preservation, method-present-but-rejecting OPFS and unavailable fallback. The first test run encountered a Node-environment setup error; the repository's required jsdom environment was restored before observing the five behavioral failures.

`2026-10-02-wllama-cache-storage-browser.json` runs the actual new storage helper in isolated browsers: Chromium retains default storage, WebKit selects Cache API and writes/reads/lists/deletes a six-byte file successfully. This is a small-file integration check, not a product model or offline inference check. The earlier full-model experiment supports the approach but used an experimental backend. Product compatibility assets and pending worker-error handling are still not integrated, so current WebKit product inference remains unproven. Full regression now passes 97 files / 3,744 tests and lint/TypeScript; existing asynchronous rejection warnings remain.

## Product compatibility integration and build verification

The provider now lazily imports matching self-hosted compatibility WASM with `?url` and the original worker code with `?raw` only when JSPI or validated memory64 support is absent. It configures the SDK using the public Firefox/Safari compatibility mode; native-capable browsers disable compatibility without downloading these assets. Local asset failures propagate without an implicit CDN fallback. Five capability/asset-error regressions failed before implementation and pass afterward. The first lint run found a TypeScript ArrayBufferLike/BufferSource mismatch; the probe parameter now explicitly uses Uint8Array<ArrayBuffer>, and lint/TypeScript passes.

Production verification exposed two distinct stale-build problems. Workspace imports resolve to package `dist`, while the root build previously did not recompile it. `bin/build.sh` now builds all @ranuts workspace packages before Vite. Separately, the bare SDK import reused Vite's cached unpatched entry. The provider now imports the patched `@wllama/wllama/esm/index.js` explicitly. Inspection of final bundled SDK confirms the minimal memory64 validation and absence of the old address-i64 constructor probe. The earlier report's successful application build alone was insufficient evidence that the new storage provider had reached the application bundle.

Failed production snapshots are preserved: `webkit-product-compat-model-before-package-build.json` records the old provider's rapid failure; `webkit-product-compat-model-before-explicit-sdk.json` and `webkit-product-compat-worker-errors.json` record the cached SDK selecting native WASM, a Memory64 CompileError and an unresolved loading promise. SDK logger handling additionally throws `t.replace is not a function` when given a worker event, obscuring the original error. This remains an independent failure-propagation gap. A source-provider diagnostic was interrupted by a destroyed execution context during rebuild and produced no valid inference result; its process was subsequently confirmed terminal, so it is not evidence for model availability.

`2026-10-02-webkit-product-compat-model.json` records the corrected **actual built editor UI**: model loads in 69,189 ms, engine status identifies CPU/Qwen3-0.6B, and a real chat completes in 28,448 ms with Hello. (the captured message DOM also includes its Write to document action). The UI displays first text 28.25 s, overall response rate 0.11 token/s and 3 tokens. Captured page errors, failed requests and visible errors are empty. This verifies one production UI inference in isolated Playwright WebKit 26.5, not offline restoration, iOS hardware, broader languages, dedicated CSP injection coverage, cancellation or sustained resource reliability. CPU latency remains a material limitation.

Final regression after explicit SDK entry selection: 98 files / 3,749 tests pass; lint/TypeScript and the new recursive workspace-plus-application production build succeed. Existing asynchronous rejection and build warnings remain.

## Fatal worker error propagation

The pinned SDK patch now handles Worker error events directly instead of passing an Event to its string-oriented logger. It terminates and detaches the failed worker, rejects both pending task queues through the existing runtime-error mechanism and retains that failure so future requests reject immediately. It does not retry or replay inference automatically. The change applies to the explicit ESM entry and CJS parity entry.

Two regression cases evaluate the installed SDK's actual ProxyToWorker class with a controlled worker error. Before the patch, initialization remains pending; after the patch, initialization rejects with the original error message, the worker terminates, and the next task rejects with the same failure. The first test-helper attempt lacked the transpiler's generator receiver binding and failed for that unrelated reason; correcting the helper established the actual pending-initialization RED result before implementation.

`2026-10-02-wllama-worker-failure-browser.json` verifies the **newly built SDK** in isolated WebKit: malformed raw worker code and a tiny diagnostic Blob trigger a real worker syntax error; initialization rejects as RuntimeError with fallback message Wllama worker failed in 21 ms, and the worker terminates once. No model inference or model/runtime asset download occurs in this probe. The original dev-origin attempt failed at module import after the dependency patch and produced no worker-behavior evidence; the production-built module test replaces it. This check does not prove cancellation ownership, model loading retry UI, device loss, all native abort signals or offline restoration.

Final checks: 99 files / 3,751 tests pass, lint/TypeScript passes, recursive workspace and production application build succeeds, and diff whitespace passes. Existing asynchronous rejection and build warnings remain. Continue lifecycle cancellation and production offline restoration separately.

## Loading cancellation ownership

The provider previously retained its engine only after successful model initialization. A dispose during SDK loading therefore aborted the download signal but had no reference with which to terminate an already-created Worker. It now owns the loading runtime immediately after construction, releases it on dispose, and deduplicates release promises per engine so disposal and the loading catch path do not terminate twice. Disposed loading reports the lifetime AbortError and cannot publish a ready engine. Late factory resolution retains its existing cleanup behavior.

The SDK's existing explicit exit also terminated its worker without rejecting pending tasks. The patch now detaches that worker and aborts both task queues on exit, retaining the failure for subsequent calls. Two added ESM/CJS cases reproduced initialization remaining pending after exit, then passed after the patch. A provider-level controlled SDK test reproduced zero exit calls while initialization was pending, then verified one release, AbortError settlement, repeated-dispose idempotence and no ready engine. Its first attempt mocked the wrong package-resolution path and failed before reaching initialization; the corrected resolved-entry mock established the behavioral RED result before implementation. Existing inference-cancellation and late-factory cleanup tests continue to pass.

`2026-10-02-wllama-loading-exit-browser.json` runs the newly built SDK in isolated WebKit. A tiny diagnostic Blob and raw worker code deliberately block initialization; an independent worker message confirms that the blocking initialization was entered before exit. Explicit exit rejects pending loading with RuntimeError / Wllama worker terminated, terminates once, and completes within the Date.now timer resolution (recorded 0 ms; not a zero-cost claim). No model inference or actual model download occurs. This is SDK initialization cancellation plus separate provider-ownership evidence; actual model UI cancellation/retry, offline restoration and other devices remain required.

Final regression: 100 files / 3,754 tests pass; lint/TypeScript, recursive workspace/application build and diff whitespace pass. Existing asynchronous rejection and build warnings remain. The complete objective remains open.

## Offline navigation result

`2026-10-02-webkit-offline-refresh.json` records actual built DOCX UI in an isolated persistent WebKit profile. Online model loading succeeds in 64,526 ms and `/sw.js` controls the page. After `context.setOffline(true)`, refreshing fails with **WebKit encountered an internal error** on the editor navigation; offline model initialization and inference are not reached. There are no captured page errors before this navigation failure. This is a failed offline-restoration check, not a model-cache failure diagnosis and not proof that every real Safari version behaves this way.

The persistent profile's cache names include application core/runtime only; unlike prior private-context probes, it does not show the dedicated model Cache API name. Functional OPFS selection can therefore differ between context types. Continue by inspecting actual navigation response/cache matching and isolating service-worker/offline behavior before changing cache architecture. Preserve the profile for follow-up rather than redownloading the model unnecessarily. Cold-process offline launch also remains unverified in WebKit.
