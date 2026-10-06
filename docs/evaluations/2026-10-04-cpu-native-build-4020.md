# Pinned toolchain browser baseline passed

The Emscripten 4.0.20 CPU compatibility build completed with exit code 0. The standalone browser probe then loaded Qwen3-0.6B and generated `Hello! How can I assist you today?`, ending with stop. It reported 16 prompt tokens and 10 completion tokens, identical to the shipped compatibility control for this single deterministic request.

This establishes a usable self-built baseline for the native count prototype. It does not certify exact shipped-artifact equivalence, broad model quality, performance, physical device compatibility or count-only behavior. Runtime hashes differ from the shipped pair. Compared with the failed 6.0.10 baseline, compiler and detected backend capabilities both changed; OpenMP causality remains unproven. Functional source files were unchanged.

Evidence: [raw 4.0.20 run](2026-10-04-cpu-native-build-4020.json), [driver](probe-cpu-native-build-4020.mjs), [toolchain setup](2026-10-04-cpu-pinned-toolchain-build.md), [compile parameter comparison](2026-10-04-cpu-build-openmp-comparison.json), [shipped control](2026-10-04-cpu-shipped-compat-baseline.md). Each run uses the same SDK import, compatibility override, model artifact, single user message and load/generation options. Browser and local server closed normally; no editor write or Save.

Proceed with the declared native count acceptance plan on this isolated 4.0.20 build. Preserve this unmodified baseline before changing native source. Do not replace production dependencies until actual count equivalence and no-generation/state-preservation gates pass.
