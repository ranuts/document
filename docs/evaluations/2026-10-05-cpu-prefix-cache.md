# Native CPU identical-prefix cache contrast

Six actual packaged native CPU completions finished: omitted/false/true cache_prompt, each on a newly loaded engine with the same request twice. Final executable frozen at 826c89f, protocol at 43c2815. Existing Qwen2.5 0.5B GGUF identity matches 491400032 bytes and SHA-256 74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db. The report binds model, CPU WASM and helper bytes; the helper was not imported by the final driver. Direct client JS was selected by its built filename but its response hash was not separately captured, so complete executed SDK provenance is not claimed.

| Mode | First / second wall time | First / second cached prompt tokens |
| --- | --- | --- |
| Omitted | 20073.375 / 110.350 ms | 0 / 659 |
| false | 19595.185 / 19593.210 ms | 0 / 0 |
| true | 19610.605 / 109.615 ms | 0 / 659 |

Every response reports 660 prompt tokens and 2 completion tokens. Within each pair, requests are exact duplicates; between modes only cache_prompt changes. The omitted and true modes reuse almost the entire identical prefix, while false recomputes it. Current packaged runtime default caching is effective in this scoped test: do not add an explicit true flag or a user-facing option as a purported missing optimization.

This is a fixed-order, single desktop JSPI CPU 0.5B diagnostic with a long repeated reference prompt and tiny response. It is not a randomized performance benchmark or evidence for changed-source summaries, 3B latency, cancellation, conversations after context trimming, physical mobile, semantic quality, model download cache, disk KV persistence or privacy. Cached-token counters and contrast support the reuse conclusion; wall time alone would not. No production behavior changed.

Three pre-inference failures are retained separately: original product landing, network-idle wait, and isolated diagnostic page all lost their execution context around helper imports. Each had zero completion rows and a closed browser. The final probe uses an isolated HTML response with COOP/COEP and imports the packaged client directly, requiring native Chromium JSPI; it does not claim that a specific product startup side effect was fully isolated. It also does not certify product response CSP enforcement because its HTML headers are diagnostic.

Final process exited 0, all engines exited, contextClosed is true, and captured page errors are empty. `python3 docs/evaluations/verify-cpu-prefix-cache.py` verifies frozen driver, identical-request contrast, native cached-token pattern, model/WASM identities and context cleanup. Next latency work should examine changing prompt prefixes and actual product request reuse rather than assuming the default cache is absent.
