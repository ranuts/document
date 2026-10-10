# Worker CSP: all configured GPU model compatibility

All four configured cached GPU models initialize and produce a hello reply under the same candidate Worker response CSP. Normal-execution eval and a controlled foreign module import are blocked in all four runs. This clears the cached-model compatibility experiment, not production delivery or the overall security gate.

| Model        | Actual reply | Eval          | Foreign module requests | Main page errors |
| ------------ | ------------ | ------------- | ----------------------- | ---------------- |
| Qwen3.5-0.8B | Hello        | CSP EvalError | 0, import rejected      | 0                |
| Qwen3.5-2B   | hello        | CSP EvalError | 0, import rejected      | 0                |
| Qwen3-4B     | Hello.       | CSP EvalError | 0, import rejected      | 0                |
| Qwen3-1.7B   | Hello.       | CSP EvalError | 0, import rejected      | 0                |

The policy remains `default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self' https: http: blob:; worker-src 'self' blob:`. It is injected only on the real hashed WebLLM Worker response. All runs use the same original Worker bytes and identical appended diagnostic timer. SHA-256 of original, diagnostic response and executed probe are recorded; final disk bytes match the original in every run. No product policy/configuration or generated bundle is modified on disk.

As established in `2026-10-03-gpu-worker-csp-analysis.md`, negative controls run from an ordinary Worker timer, not debugger-mediated eval. The earlier no-added-header baseline successfully evaluates 1+1 and imports the controlled CORS/CORP module returning 42 with exactly one request. That baseline remains a separately versioned report without the newly added byte/probe hash fields; it is not presented as rerun in this matrix. The initial debugger-method diagnostic remains excluded from pass evidence.

Actual displayed model identity and WebGPU engine are checked, so CPU fallback cannot masquerade as GPU compatibility. All replies come from the real model, not a mocked Worker response. No page or captured console errors and no visible inference errors occurred. The deliberate eval rejection is stored in the diagnostic result; absence of console errors does not mean no policy rejection happened.

Scope: desktop isolated Chromium/Metal, already cached weights, injected COOP/COEP and CSP, service workers blocked, one short inference per model, sequential use of the existing GPU profile. No fresh model download/redirect, actual hosting-header delivery, offline cached CSP upgrade, CPU blob Worker, vendor iframe, physical device, memory-pressure, native Save/reopen or language-quality claim. Broad connect-src deliberately preserves custom model artifact URLs and is not an exfiltration barrier.

Reproduce using `WORKER_CSP_MODEL=<exact model ID> WORKER_CSP_REPORT=<unique report path> node docs/evaluations/probe-gpu-worker-csp.mjs`. Do not run concurrently against the same profile. `python3 docs/evaluations/verify-worker-csp-models.py` checks all four archived reports, actual identities, exact policy and response/probe hashes, disk byte preservation, expected controls and replies, plus the earlier positive baseline controls.

Next implementation gate: add a narrowly scoped WebLLM Worker policy across preview/dev, Pages and static-web-server, then verify real response headers and model operation without injecting the candidate header. Follow with offline response-cache upgrade checks and fresh artifact fetch coverage. CPU and native iframe policies need their own validation rather than inheriting this conclusion. Existing IM/document flow remains unchanged.
