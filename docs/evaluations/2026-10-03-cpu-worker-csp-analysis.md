# CPU main blob Worker CSP verification

The actual wllama main blob Worker rejects string evaluation and data-module imports while the cached default CPU model still generates Hello. The existing production shell policy supplies the observed restriction; no new CPU policy or product change is needed for this verified main-Worker scope.

The current production editor HTML contains the build-generated meta CSP. The native Worker eval rejection explicitly names the same script-src directive, including wasm-unsafe-eval and the shell's inline bootstrap hash. This establishes actual enforcement in that Worker, rather than assuming that a document policy must protect every Worker type.

The pinned SDK constructs its main blob script with an initialization wrapper before the “Start the main llama.cpp” section. The first probe incorrectly required that section at byte zero, so identification failed before security controls/inference. That failed diagnostic is retained. The corrected observer calls the original URL.createObjectURL unchanged, reads only the generated Blob text, recognizes both the main section and wModuleInit wrapper, then correlates the emitted blob URL with the actual CDP Worker target. No Worker code is replaced, appended or mocked.

| Check                             | Actual SDK main blob Worker under shell CSP | Simple blob Worker on synthetic page without CSP |
| --------------------------------- | ------------------------------------------- | ------------------------------------------------ |
| Eval with CDP bypass disabled     | EvalError naming parent script-src policy   | Returns 2                                        |
| data module importing constant 42 | TypeError, import rejected                  | Returns 42                                       |
| Model                             | Actual CPU Qwen3-0.6B                       | No model; positive execution control only        |

Both controls use the same nested CDP Runtime.evaluate path with allowUnsafeEvalBlockedByCSP:false; module import awaits its actual Promise. The baseline synthetic page has no CSP and only a simple Worker handler, with isolation headers supplied to keep its environment compatible. It is not a second model run and does not claim compatibility without the shell policy. The real model inference occurs after the negative controls, proving those controls leave the main runtime usable.

Observed targets include the identified main Worker and four em-pthread Workers. Only the main Worker is tested here. Their presence is not proof that all pthread execution contexts enforce the same CSP, nor a substitute for SDK thread-count getters or low-memory device testing. Isolation is true for the actual editor page, actual displayed backend/model is CPU/0.6B, and main page/visible inference errors are zero. WebGPU is explicitly disabled in this isolated desktop Chromium profile; weights were already cached and network remained available. No offline, fresh download, Safari/mobile/Windows, native Save/reopen, general semantic quality or complete security-gate claim.

Evidence: `2026-10-03-cpu-worker-csp.json`. Failed identification setup: `2026-10-03-cpu-worker-csp-identification-diagnostic.json`, excluded from pass evidence. Reproduce with `node docs/evaluations/probe-cpu-worker-csp.mjs` on the current-config preview at 5193 and the unused existing CPU profile. `python3 docs/evaluations/verify-cpu-worker-csp.py` checks actual identity, source/target correlation, exact parent directive, both control outcomes and native reply. Probe syntax and root lint are checked; production source is unchanged, so no new product build/full test rerun is claimed.

Remaining security work includes actual pthread execution contexts, native iframe dynamic compilation, development Worker paths and fresh artifact fetches. Wider model/device/product acceptance remains open.
