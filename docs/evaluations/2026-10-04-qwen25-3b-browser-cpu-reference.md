# Same Qwen2.5 3B GGUF in browser CPU Worker

All four browser CPU date-copy calls produce exactly the expected date. The two sources that reproducibly generate invented addresses under MLC/WebGPU are correct here. Combined with the independent native CPU result, this demonstrates successful copying in native CPU and browser CPU representations; it does not isolate a particular MLC compiler, weights, GPU driver or sampler defect.

The exact official GGUF used for the native reference is read as a browser File. Before input selection the probe streams the entire local file through SHA256 and requires `626b4a6678b86442240e33df819e00132d3ba7dddfe1cdc4fbb18e0a9615c62d`, 2,104,932,768 bytes. No model fetch, native inference server or hosted inference endpoint is involved. Models are ignored diagnostic data. This is a new ephemeral Chromium context; GPU capability is disabled and service workers blocked.

The probe loads the unmodified built `client-D5_UYdz1.js` and CPU default WASM `wllama-BITawafS.wasm`. It applies the same JSPI/memory64 compatibility condition as the production loader; this Chromium selects the default memory64 Worker, not the compatibility Worker. Cross-origin isolation is true, n_gpu_layers 0, four threads, context 2048 and reasoning disabled. Exact asset hashes and selected resources are saved. The standalone page copies loader selection to avoid importing the application entry; it does not exercise the whole production provider/UI.

Each request preserves the earlier minimal system/user message contents and logical JSON schema: temperature 0, top_p 0.8, max_tokens 512, non-streaming. Wllama uses its own native schema request shape, template and sampler defaults. Repetition penalty is not exposed by this shipped SDK, so the probe does not send an unsupported field or claim identical penalty semantics. Native CPU reference context was 4096, while browser uses production CPU context 2048. These and the different MLC quantization/conversion/grammar/GPU implementation remain confounds.

| Source | Browser CPU raw text field | MLC/WebGPU repeated reference |
| --- | --- | --- |
| ISO date: 2044-09-22. | 2044-09-22 | Invented Dublin address |
| ISO date: 2026-10-04. | 2026-10-04 | Exact date |
| Chinese appointment, 2044-09-23 | 2044-09-23 | Invented Dublin address |
| Portuguese appointment, 2044-09-23 | 2044-09-23 | Exact date |

One development call per source. Response times: 6.34, 3.22, 3.66 and 3.94 seconds in this desktop run, including first-call overhead; do not infer steady-state or mobile performance. No page errors. The context routes block non-origin requests; recorded page HTTP requests stay on the owned preview origin. This is not a broad privacy/offline/PWA certificate. No native editor/IM action, Undo/Redo or Save is claimed in this standalone comparison.

Driver preregistered in `dccf10d`, revised before successful inference in `9c1ee19`/`eb718e4`. Two failed zero-output harness runs are preserved: execution context was destroyed while importing the application-coupled loader; its compiled module imports the application plugin and the captured requests include the application root. A dedicated page alone did not resolve this. Loading the shipped SDK/resource modules directly avoids that app-entry dependency. Neither failed run is counted as inference evidence.

`python3 docs/evaluations/verify-qwen25-3b-browser-cpu-reference.py` verifies four exact captured outputs, current asset/probe hashes, selected CPU resources, file identity, isolation and message/schema/sampling controls. No production source/default changes. The next useful checks are full native IM writing tasks with this GGUF and further isolation of the MLC path; successful date extraction is not general summary fidelity.
