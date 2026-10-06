# WebLLM Worker CSP integrated with hosting

Pages, static-web-server and Vite dev/preview now add the previously evaluated policy only to WebLLM Worker responses. No deployment, push or merge. IM/document flows and generation defaults are unchanged.

The policy is `default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self' https: http: blob:; worker-src 'self' blob:`. Native iframe scripts and other assets receive no additional response CSP. Existing COOP/COEP and cache/encoding rules are retained. Broad connect-src preserves configurable artifact fetches and is not an exfiltration barrier.

Pages uses the [static _headers contract](https://developers.cloudflare.com/pages/configuration/headers/) and one splat in `/assets/webllm.worker-*.js`. Docker uses the corresponding static-web-server rule. Vite middleware covers fingerprinted build assets and the local package Worker module path in development. Actual dev-browser import paths still need runtime coverage; production preview was exercised.

## Immutable cache correction

Read-only review identified that headers alone would leave the same Worker URL under existing immutable caches. A banner-only attempt did not survive the build and was removed. Vite's [worker.plugins](https://vite.dev/config/worker-options) now adds read-only Worker metadata containing the exact policy during renderChunk. That metadata changes the emitted bytes/content hash whenever the policy changes, without new UI or inference behavior.

Actual build changes `webllm.worker-BX0TIRUM.js` to `webllm.worker-CMk6FPDh.js`. The emitted file contains one metadata definition, and actual Worker execution reads the exact policy fingerprint. The new application requests the new URL, so an old cached response at the old URL cannot satisfy that request. This is not a retrospective update of already running Workers or old app shells. The subsequent [automatic cache upgrade and cold offline check](2026-10-03-worker-csp-offline-analysis.md) records the desktop default-model transition and fresh-process result; this hosting run itself did not exercise that sequence.

## Direct runtime evidence

`2026-10-03-worker-csp-hosting-headers.json`: 12 real GET responses from freshly started preview (5198), static-web-server 2.42.0 container (5195), and Wrangler Pages 4.146.0 local server (5196). Each host serves the model Worker with the exact CSP and identical built Worker bytes, and agent-plugin/editor/native Word iframe controls without this additional response policy. Existing isolation headers remain present. Local Pages does not prove deployed edge behavior.

`2026-10-03-worker-csp-hosted-preview.json`: actual new preview Worker response forwarded to the existing cached model origin, without injecting the candidate CSP. Diagnostic bytes are appended solely for normal-execution controls. Default Qwen3-1.7B remains WebGPU, returns Hello., and records the policy fingerprint. Eval is rejected with a CSP EvalError, the controlled foreign module import is rejected before any module request, and disk Worker bytes remain unchanged. Main page errors and captured console errors are zero.

The app shell still uses the isolated probe's injected COOP/COEP and service workers are blocked. This proves real preview delivery and Worker restrictions, not a complete new-host app migration, offline cache upgrade, fresh artifact redirect coverage, physical devices, CPU blob Worker policy, vendor iframe dynamic compilation protection or general model quality. Four-model cached compatibility belongs to the preceding matrix, not a newly repeated four-model hosting run.

## Validation

Two hosting-contract tests were observed failing for missing policy, then all 18 passed. Final production build passed; full suite 116 files / 4161 tests and root lint passed. Existing converter rejection-handled and build dependency/chunk warnings remain. A read-only review found no new Important/Critical issue after the Worker URL correction.

Reproduce header checks with `node docs/evaluations/probe-worker-csp-hosting-headers.mjs` while the three local hosts run. Use `WORKER_CSP_HOST_PORT=5198 WORKER_CSP_REPORT=<unique report path> node docs/evaluations/probe-gpu-worker-csp.mjs` for real-header inference/controls. The older four-model verifier now pins its historical executed probe hash at commit 1c080b8, rather than incorrectly comparing archived reports to the extended current probe.

Next: exercise warm-cache and cold offline policy upgrade, verify development Worker requests and fresh artifact fetches, then continue CPU/native iframe policy investigation. The complete goal and overall security gate remain open.
