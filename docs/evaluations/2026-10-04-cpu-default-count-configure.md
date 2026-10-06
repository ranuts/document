# Default CPU count runtime configuration

The count extension is currently verified only with CPU compatibility native artifacts. Packaging the public client globally with the unchanged default native runtime would leave its count action unavailable on memory64/JSPI-capable browsers. A separate default CPU native build is therefore required before activation.

A new isolated CMake directory uses Emscripten 4.0.20, WLLAMA_COMPAT=OFF, LLAMA_WASM_MEM64=ON and GGML_WEBGPU=OFF. The SDK fallback is CPU-only; this build does not replace WebLLM GPU inference. Configuration succeeded. Fixed source revisions, hashes, selected cache settings and full configure log are recorded. The build was started separately; configuration evidence does not claim compile or runtime success.

After terminal compile status, the required steps are: preserve native artifacts and hashes; pair the generated default JS with the SDK's embedded module wrapper; rebuild client source and declarations; run actual browser load/count/generation/rejection/Stop tests without forced compatibility, including the applicable thread mode; then create one candidate containing both default and compatibility pairs. Production activation still requires normal provider-loader, IM and offline verification. Existing installed dependencies are untouched.

## Prepared runtime pairing check

`prepare-cpu-default-count-client.mjs` copies source into a separate temporary client directory and replaces exactly one embedded default JS wrapper declaration with the compiled default artifact. It refuses a changed declaration shape and records JS/WASM/generated-file hashes after native build completion. No upstream checkout mutation is needed for that pairing. The browser driver imports the resulting compiled client, does not override capability probes, asserts default runtime selection, and compares repeated counts with generation usage. Both scripts pass syntax checks; execution remains dependent on terminal native build and client bundling.

At the latest live observation, the native build is still running wasm-opt optimization. The build must be resumed by its existing process handle rather than restarted from these notes.
