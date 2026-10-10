# Pinned Emscripten CPU build control

Docker daemon inspection failed because the user Docker socket was unavailable. Instead installed the official emsdk 4.0.20 release in `/private/tmp/document-emsdk-4020`, without editing shell startup files or replacing the system compiler. emsdk checkout: `96c657fc60920d2a6a82318aa50e0abf82749604`; selected release hash: `c387d7a7e9537d0041d2c3ae71b7538cc978104e`. The absolute compiler reports Emscripten 4.0.20, commit `6913738ec5371a88c4af5a80db0ab42bad3de681`.

Configured a fresh build directory `/private/tmp/document-wllama-count-build-4020` against the same unmodified SDK 3.6.1 and pinned llama.cpp sources. Configuration exited 0 with the same CPU-only compatibility flags: `GGML_WEBGPU=OFF`, `WLLAMA_COMPAT=ON`, `LLAMA_WASM_MEM64=OFF`, `WLLAMA_TEST_BACKEND=OFF`. No assertion or exception tracing additions are used in this baseline control.

Important observed difference: the 6.0.10 configuration found OpenMP 5.1, while 4.0.20 reports OpenMP unavailable. Both fall back to generic CPU architecture. This comparison changes the toolchain and its detected capabilities; a successful runtime would not alone prove a specific compiler or OpenMP cause. Preserve this distinction in analysis.

Started `cmake --build /private/tmp/document-wllama-count-build-4020 --target wllama -j 4`; log `/private/tmp/document-wllama-count-build-4020.log`. Build completion and browser runtime acceptance remain pending. Use the same standalone model request and retain separate raw reports when the build finishes. Product dependencies, defaults and IM remain unchanged.
