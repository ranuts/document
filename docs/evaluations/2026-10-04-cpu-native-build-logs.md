# Native baseline abort with console evidence

The second run reproduced the same abort with unchanged generated artifact hashes. Phase capture identifies `load`: no completion was invoked. Native logs show the model context and output/KV/compute buffers were created; after graph reservation the runtime terminated through libc++abi. This narrows the failing boundary but does not identify the exception cause.

The symbol map identifies function 815 as `std::terminate()`, 1276 as `__abort_message`, 7877 as `demangling_terminate_handler()` and 7749 as the generated `dynCall_viii` wrapper. These do not identify the originating C++ throw. No unsupported stub or compiler mismatch is proven causal.

Evidence: [console and phase capture](2026-10-04-cpu-native-build-logs.json), [instrumented driver](probe-cpu-native-build-logs.mjs), [original failure](2026-10-04-cpu-native-build-baseline.md). Browser and local server closed after the terminal failure. Runtime route responseBytes remains zero because that counter only instruments the model stream; zero does not mean runtime files were empty.

Preserved baseline JS, WASM and symbol map under `/private/tmp/document-wllama-count-baseline-artifacts`. Configured the same isolated build with `CMAKE_EXE_LINKER_FLAGS=-sASSERTIONS=2 -sEXCEPTION_STACK_TRACES=1`; configuration completed with exit code 0. Started relinking with output at `/private/tmp/document-wllama-count-assertions-build.log`. This is diagnostic instrumentation, not a proposed fix or production change. Preserve a separate report for the next actual runtime test.
