# Combined SDK real storage diagnostic

Two separate fresh Chromium contexts test the same combined source SDK and native CPU compatibility artifact. The initial Cache API fallback run fails during model-cache put with UnknownError: Unexpected internal error, after the model GET. It does not reach native load or cached reload. Cause is unresolved; filesystem observation reports roughly 86 GiB available, which does not establish browser quota or storage reliability.

The OPFS run uses the SDK's default CacheManager, matching the application's preferred storage path. It downloads and caches the 484220320-byte model, loads it, counts 16 prompt tokens and generates. After exiting that runtime, the server blocks the model URL. A fresh SDK instance loads from OPFS and again counts/generates with 16 prompt tokens and the same deterministic reply. The server records no model request after blocking, only a runtime WASM request. This is real storage/native execution, not mock storage.

The SDK/WASM endpoints remain reachable. This proves model-cache reuse in one Chromium OPFS scenario, not full offline PWA reopening, persistent-profile restart, physical-device support, or working Cache API fallback. The inherited top-level scope label names the provider probe; these cache drivers use standalone SDK instances, not WllamaProvider. The browser context is disposable and its storage is isolated; no existing profiles or documents were touched.

The Cache API failure remains a release concern for browsers where OPFS is unavailable. It must be diagnosed before claiming the new SDK supports both application storage paths. No installed product SDK/native activation occurs in this turn.

Verification: `python3 docs/evaluations/verify-cpu-combined-opfs-cache.py`.
