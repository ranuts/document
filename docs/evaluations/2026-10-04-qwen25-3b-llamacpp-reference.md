# Qwen2.5 3B: independent native CPU date-copy reference

All eight native CPU calls copy dates exactly, including the two sources that reproducibly generate invented addresses in the earlier MLC/WebGPU diagnostic. This demonstrates successful copying in an independent representation/runtime combination, not a single-variable proof of the browser anomaly's cause.

The reference uses the [official Qwen GGUF repository](https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF), revision `7dabda4d13d513e3e842b20f0d435c732f172cbe`, file `qwen2.5-3b-instruct-q4_k_m.gguf`: 2,104,932,768 bytes, SHA256 `626b4a6678b86442240e33df819e00132d3ba7dddfe1cdc4fbb18e0a9615c62d`. Expected size/hash were obtained from the repository's fixed-revision tree LFS metadata. The first download was truncated and failed size validation; a server-confirmed HTTP 206 range retrieved remaining bytes, then the entire combined file matched SHA256 before any inference. No partial file was used. Model remains ignored local diagnostic data, not committed or shipped.

Driver preregistered in `8f723ee` and refined before successful inference in `081de93`/`483c020`. Native llama.cpp 0.5.0, build 11146, commit 7fe450e19. Local ephemeral service binds only 127.0.0.1, devices none, GPU layers 0, operation offload disabled, context 4096, four CPU threads, one slot, prompt caching disabled. Driver owns service start/termination; successful service exits 0. The synthetic fixtures never go to an external inference endpoint. This standalone service is a diagnostic, not a new product provider or cloud/native-server fallback.

Four previously observed simple sources retain exactly the earlier minimal system/user message contents. Two calls per source: repetition penalty 1.05/1.0. Temperature 0, top_p 0.8, max_tokens 512, seed 42, same logical JSON schema. The [native server schema shape](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md) is used. All eight raw JSON text fields equal expected dates; response time 1.26–1.39 seconds in this one desktop run.

| Source | Native CPU penalty 1.05 | Native CPU penalty 1.0 | Prior MLC/WebGPU |
| --- | --- | --- | --- |
| ISO date: 2044-09-22. | Exact | Exact | Invented Dublin address |
| ISO date: 2026-10-04. | Exact | Exact | Exact |
| Chinese appointment, 2044-09-23 | Exact | Exact | Invented Dublin address |
| Portuguese appointment, 2044-09-23 | Exact | Exact | Exact |

Important confounds: GGUF Q4_K_M versus MLC q4f32_1, model conversion, template implementation, schema grammar runtime, CPU/GPU arithmetic and sampler implementations all differ. Native penalty window is 4096 and can include prompt tokens; WebLLM's tracked repetition tokens derive from generated output. Neutral penalty calls avoid that penalty confound, but do not eliminate the other differences. Numerical parameter equality is not full sampling-algorithm equality. Do not conclude that the MLC weights, compiler or Chrome alone are faulty.

Two pre-inference HTTP 400 failures are preserved separately. The first wrapper-shaped request's response body was not captured, so its precise reason is unknown; do not attribute it to the schema. The second records that repeat_last_n -1 is rejected by this native server. It was changed to 4096. Neither failed run generated a model result. Their owned services were shut down in finally. The later successful report includes full requests/responses, runtime props/log/version and hashes.

`python3 docs/evaluations/verify-qwen25-3b-llamacpp-reference.py` validates exact fixture coverage, message/schema equivalence, explicit native CPU flags, sampling parameters and captured date-only results. These are standalone native calls: no browser IM, Undo/Redo, mobile, cold offline/PWA or general semantic-quality claim follows. Production code, default models and generation settings remain unchanged. A browser CPU comparison with this same verified GGUF could separate native versus browser-WASM behavior while preserving the intended browser-only product architecture.
