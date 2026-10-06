# CPU native count build feasibility

Retrieved the upstream SDK tag `3.6.1` into `/private/tmp/document-wllama-count-361` at commit `e3972797f9d508887440e9d3fa87dc296f2dec44`, including its exact llama.cpp submodule `83d855c5a6d70487121edbf4020b25c96b7a04e7`. Both checkout commands completed successfully. This is an isolated experiment; installed product dependencies were not changed.

The npm package omits the llama.cpp submodule. Its build script pins Emscripten 4.0.20 (ARM variant on this host), while installed local `emcc --version` reports 6.0.10-git. A local build cannot yet be claimed equivalent to the shipped artifact. The SDK's documented script also builds both normal JSPI/memory64 and compatibility Asyncify variants with WebGPU; a CPU-only compatibility configuration is a feasibility prototype, not a replacement for those distributions.

The pinned native source exposes the necessary building blocks: `oaicompat_chat_params_parse` in `tools/server/server-common.cpp:1133` accepts the actual chat parameters and produces the prompt; `tokenize_input_prompts` is declared in `server-common.h:293`. Generation tokenizes through that function with `add_special=true` and `parse_special=true` in `server-context.cpp:2228`. An extension must match that path and reject unsupported multimodal input rather than silently undercount it. The model's chat parameters, special tokens and effective slot capacity must come from the loaded native context.

Started a configuration experiment with:

```sh
emcmake cmake -S . -B /private/tmp/document-wllama-count-build \
  -DGGML_WEBGPU=OFF -DWLLAMA_COMPAT=ON \
  -DLLAMA_WASM_MEM64=OFF -DWLLAMA_TEST_BACKEND=OFF
```

Configuration session `84193` completed with exit code 0: configuring and generating succeeded, using the generic CPU backend. It warned that CPU architecture was unknown. This establishes configuration only; no native extension, compiled artifact or actual count-only runtime result is established yet. The next baseline build uses `cmake --build /private/tmp/document-wllama-count-build --target wllama -j 4` with output in `/private/tmp/document-wllama-count-build.log`.
