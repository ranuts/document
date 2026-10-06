# Product CPU count loader integration

The CPU-only local fallback now loads the vendored hash-pinned count SDK and the matching default CPU WASM. Existing JSPI/memory64 detection chooses local compatibility assets when required. Existing storage selection, model progress, cancellation and thread selection remain in the provider. Explicit custom WASM configuration retains its original SDK path to avoid mixing arbitrary native files with the count client. The experimental non-CPU GGUF path also retains its original runtime.

Vendored executable bytes match the previously verified dual candidate manifest. Licenses, source patches, source revisions and preparation script accompany the files. Package files include vendor assets. Generated executable files are excluded from formatting/linting to preserve their hashes; application source and declaration adapter remain checked. No upstream commit/publication is performed.

The initial integrity test fails with missing manifest before vendoring. Normal-preload mocked-loader tests verify CPU asset selection and count-before-generation; provider/budget/runtime tests verify final request assembly and trimming notices. TypeScript initially reports an unexported compatibility-return interface; exporting that existing interface resolves declarations and typecheck. Full product build completes, and both emitted count WASM assets exactly match source manifest hashes. Separate native compatibility four-thread count/generation/rejection/recovery tests also pass.

This is code and build integration, not IM browser acceptance. The normal built-in loader, visible Stop/trim behavior, complete PWA offline flow and quality/fidelity gates still need actual UI execution. Private-context Cache API large-write limitations remain unresolved. The full goal remains active.

Full test run: 118 files and 4278 tests pass. Source lint and root typecheck pass. The full product build, emitted-native hash verification and tests do not substitute for the outstanding normal-loader/IM browser checks.
