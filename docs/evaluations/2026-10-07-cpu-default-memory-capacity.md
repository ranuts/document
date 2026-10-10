# CPU default memory capacity

The [binary-bound inspection](2026-10-07-cpu-default-memory-capacity.json) reads the WASM imported memory limits and corresponding generated-JS constructor. Both cap memory at 65,536 pages: 4,294,967,296 bytes (4 GiB). The observed Hy-MT2 7B tensor allocation requests 4,617,129,952 bytes, exceeding that ceiling even before other runtime allocations. Memory64 support alone does not remove this compiled limit.

This explains a hard capacity restriction, not the complete peak-memory requirement or feasibility of an 8 GiB build on any device. Increasing only the JS constructor cannot change the binary's imported memory type. A fresh matched build must be tested, and model quality remains separate.

The current available compiler differs from the recorded product compiler. Cached SDK source lacks the active native-count patch. Exact pinned source recovery precedes any capacity build, and compiler differences must remain explicit. No product runtime, fallback model, privacy policy or acceptance threshold is changed.
