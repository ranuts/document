# Official Qwen2.5 0.5B CPU writing candidate

The original requirement proposed Qwen2.5-0.5B Q4_K_M as a small CPU fallback. We tested the official [Qwen GGUF repository](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF), pinned to revision `9217f5db79a29953eb74d5343926648285ec7e67`. Its Q4_K_M artifact is 491,400,032 bytes, larger than the original 300–400 MB estimate. The downloaded size and SHA-256 `74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db` matched the official model API metadata before browser loading.

The model was loaded through the existing local GGUF file setting in isolated Chromium with WebGPU disabled. Current production writing requests, native JSON schema and validation were retained. Only response capture was injected into generated application code; the runner restored its original bytes after terminal completion. Each of three requests returned completed valid JSON with native token/timing measurements.

| Task | Raw model behavior | Result |
| --- | --- | --- |
| Formal Chinese rewrite | Changed Alex paying into an address to Alex with “I will pay”; changed 1,250 EUR into 1250欧元; retained colloquial 哦 | Numeric guard rejected; exact source retained |
| Formal English rewrite | Returned original colloquial text, with a newline | Unchanged-result guard rejected; exact source retained |
| Shorter negation summary | Returned original text | Unchanged-result guard rejected; exact source retained |

Observed response times were 56.01, 56.91 and 59.05 seconds, mostly native prompt processing. These are single observations with stochastic defaults, not a speed benchmark or a general claim that one model family is better. The result establishes that this artifact loads and completes these requests in the current CPU runtime, but all three writing tasks failed. No preview cards, successful document mutations, or page errors were observed. The candidate is not adopted and the default model remains unchanged.

The archived probe/runner hashes, artifact metadata and raw responses are in the report. Local file loading does not prove candidate HTTP download/cache recovery, physical mobile compatibility or document Save/Undo roundtrips. Next optimization should investigate CPU prompt-processing cost and evaluate stronger writing candidates rather than weaken factual guards or switch defaults based only on initialization success. The overall goal remains open.
