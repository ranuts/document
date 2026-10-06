# Combined SDK persistent Cache API verification

Two fresh owned temporary profile runs use the combined source SDK and the production CacheAPIStorage helper. The complete 484220320-byte model downloads into real Cache API storage and native CPU compatibility inference counts/generates successfully. After the model server is switched to reject its URL, a fresh SDK instance reloads the cache without any model request and produces the same deterministic reply with 16 prompt tokens.

The second run additionally closes the entire browser context/process, relaunches Chromium with the same owned temporary profile, reloads the SDK and creates a fresh runtime. The model URL remains blocked. The cache entry survives, loading/counting/generation succeed again, and no model HEAD or GET occurs after blocking. Both runs use context capacity 256 for diagnostics, not the application's normal capacity. All created profile data is removed after final browser close.

SDK/worker/WASM endpoints remain reachable. This is model-cache persistence across an actual browser restart, not full PWA offline reopening. It does not resolve large Cache API writes in incognito, establish mobile compatibility or activate the candidate SDK in the app. The inherited scope label names a provider probe; actual execution here is standalone SDK with Cache API storage.

Verification: `python3 docs/evaluations/verify-cpu-combined-persistent-cache.py` and `python3 docs/evaluations/verify-cpu-combined-cache-browser-restart.py`.
