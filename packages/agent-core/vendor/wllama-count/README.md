# Vendored CPU count runtime

One source-built SDK client and two matched native CPU artifacts: default memory64/JSPI and compatibility Asyncify. Source revisions: wllama e3972797f9d508887440e9d3fa87dc296f2dec44; llama.cpp 83d855c5a6d70487121edbf4020b25c96b7a04e7. Built with Emscripten 4.0.20. Source patches and client preparation script are included under source; licenses under licenses. manifest.json binds original executable bytes. Do not format generated JS or mix native pairs.

Evidence: docs/evaluations/2026-10-04-cpu-count-dual-package.md. CPU fallback uses these local artifacts; normal capabilities select the default or compatibility pair. These tests establish scoped Chromium execution, not all-device or writing-quality acceptance. No model weights are included.

The subsequent `source/cpu-bounded-blob-read.patch` applies to the generated client after the original source build. It limits each model Blob backing read to 8 MiB while preserving the worker response bytes and existing failure cleanup. The manifest binds the patched client; original evaluation byte bindings remain historical. Native WASM/worker pairs are unchanged.
