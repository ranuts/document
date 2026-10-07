# 8 GiB single-thread model load and incomplete generation

The matched capacity candidate loads the fixed 7B model and returns a valid native count preflight (4 prompt tokens, 2,048 context tokens). The 4 GiB single-thread control fails allocation with the same sources/compiler/model and corresponding client wrapper. This demonstrates scoped capacity improvement, not production adoption.

The first translation does not finish within the frozen driver's 300-second observation window. The driver then tears down context/browser/server and exits 1. Zero translations complete, so no semantic quality score is possible. A sampled Chromium renderer was busy; that observation is not request-bound timing or throughput evidence. No final response or full latency is established. This is not evidence that the model would return an incorrect translation, nor proof that an unlimited wait would succeed.

The [derived receipt](2026-10-07-hymt2-7b-memory-candidate-single-thread-derived.json) removes console material containing compile-machine paths and pins the ignored original bytes. All requests, artifact bindings, preflight, error and closure data are retained. The compiler is 6.0.10, while the existing product pair records 4.0.20. Matching that toolchain in isolation is the next compatibility/performance contrast; no user-global toolchain or product runtime is changed.
