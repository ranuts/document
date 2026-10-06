# Self-built CPU compatibility baseline

The unmodified pinned SDK/llama.cpp CPU compatibility build completed successfully with exit code 0. Browser runtime acceptance failed: the isolated SDK probe raised native `(ABORT)` from the self-built WASM. Compilation success therefore does not establish a usable runtime or a feasible production replacement.

The probe used the current installed patched SDK JS, a custom compatibility worker loaded from the generated `wllama.js`, generated `wllama.wasm`, the existing Qwen3-0.6B GGUF, context 2048, one thread, no GPU layers and reasoning disabled. A narrow capability override forced the compatibility path. This is a mixed SDK/runtime diagnostic, not a shipped-artifact equivalence test. The browser and local file server were closed in `finally`.

The [raw capture](2026-10-04-cpu-native-build-baseline.json) records generated JS/WASM hashes, files served and the exception. It does not capture native console diagnostics, so the abort cause remains unknown; do not infer that the compiler version, compatibility forcing or model caused it. Next run must preserve this failure and collect native logs and loading phase before changing build flags or implementing the count action.

The [driver](probe-cpu-native-build-baseline.mjs) performed no editor write or Save. No product source, dependency or IM interface changed. The native count extension remains unimplemented and the previously declared runtime acceptance gates remain unmet.
