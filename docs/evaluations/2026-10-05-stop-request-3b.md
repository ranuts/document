# 3B matched post-Stop history shapes

All three fresh native CPU Qwen2.5 3B engines returned exactly `BRAVO` with finish_reason stop: original system/user/user, truthful stopped assistant boundary, and system/current-user only. Original product request content is pinned to b4d2100; executable and protocol frozen at 08a3c6c. Temperature 0.7/top_p 0.8 preserved. All shapes use the same diagnostic max_tokens 32/nonstream transport with stream-only options removed, rather than the original 1024-token UI stream. No seed was added and sampling is not presumed deterministic.

| Shape | Wall time | Prompt / completion tokens |
| --- | --- | --- |
| Original | 17257.340 ms | 193 / 4 |
| Boundary | 17932.065 ms | 201 / 4 |
| Fresh only | 14429.005 ms | 161 / 4 |

Every engine is freshly loaded; cached prompt tokens are zero. This shows the original consecutive-user history can produce the requested current instruction on this different supported model. It contradicts treating consecutive roles alone as a sufficient universal explanation. It does not isolate parameter count, prompt transport, budget, sampling variation or native runtime state as the cause of earlier 0.5B failures. One observed development sequence is not default-model quality acceptance. Do not delete history or promote a 3B default from this label task.

Model file is 2104932768 bytes, SHA-256 626b4a6678b86442240e33df819e00132d3ba7dddfe1cdc4fbb18e0a9615c62d. Model/WASM and actual served SDK hashes verify. The raw report's inherited initial scope phrase says 0.5B; this is a stale descriptive label, not the executed model identity. The frozen path, asserted hash and actual file identity establish 3B. The final driver was not changed during execution.

All engines exited, browser context closed, captured page errors empty, process exit 0. The isolated page injects COOP/COEP and invokes packaged SDK directly: no real Stop/UI in this run, no device/latency/offline/privacy certificate. `python3 docs/evaluations/verify-stop-request-3b.py` checks exact mode-matched requests, frozen source bindings, model/WASM/served-SDK identity and cleanup; it prints actual outcomes separately. A same-harness 0.5B contrast would strengthen model-versus-history diagnosis without pretending the earlier UI runs were matched benchmarks.
