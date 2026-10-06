# Cache API large streamed response diagnostics

Three fresh Chromium executions stream actual local GGUF prefixes through the production CacheAPIStorage helper: 1 MiB, 64 MiB, 256 MiB and the complete 484220320-byte model. Stored lengths are read back. Diagnostic-only cache entries are deleted after each case.

In Playwright newContext (incognito), the first two sizes succeed and the latter two fail with UnknownError after all bytes pass through the stream. navigator.storage.estimate reports initial quota roughly 3 GiB. A second incognito run declares exact Content-Length on the cache response and produces the same results; missing length does not explain this observed failure.

A fresh launchPersistentContext with an owned temporary profile saves and reads back all four sizes, including the complete model. It reports initial quota roughly 10 GiB. The temporary profile is removed after browser close; existing user profiles are untouched. This establishes an environmental difference associated with context mode and storage allocation, not the exact internal Chromium cause or a universal per-entry limit. There is no basis yet to rewrite the storage helper solely for the observed incognito failure.

The ordinary-profile test is direct helper storage, not complete SDK cache reload or PWA offline reopening. Full SDK model-origin-blocked reload in this environment remains the next check. Incognito fallback reliability remains incomplete and should not be hidden by ordinary-profile success. The source/native candidate is not activated in the application.

Verification: `python3 docs/evaluations/verify-cpu-cache-api-size-diagnostic.py`.
