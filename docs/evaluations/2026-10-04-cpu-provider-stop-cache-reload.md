# Actual provider streamed Stop and cache recovery

The compiled WllamaProvider runs with the combined count-capable source SDK and paired CPU compatibility native Worker in an owned ordinary temporary Chromium profile. The injected engineFactory performs actual SDK load using production CacheAPIStorage and a 2048-token context. The model downloads into Cache API storage once.

Streaming generation uses an output limit of 1024. The first nonempty native text delta (`**`) triggers AbortController.abort. The provider rejects with AbortError, becomes not ready and releases engine 0 exactly once. This observes actual native streamed output before cancellation rather than a fabricated pending completion. It does not measure stop latency or prove where native execution was when termination arrived.

The model URL is then blocked. Provider preload creates engine 1, loads the cached model without a second model request, and generates the greeting with prompt usage 24 and output usage 10. Disposal releases engine 1 exactly once; observed exit IDs are [0,1]. No page errors occur. The raw client/native hashes match the combined candidate package. Created cache/profile data is removed at final cleanup.

This validates the provider's real streaming AbortSignal path and cache recovery through its engineFactory injection seam. It does not click the IM Stop button, exercise normal built-in loader selection, certify writing accuracy, or activate the candidate SDK/native artifacts in the application. The existing CPU-only loader must still select a complete supported pair; default native variants remain unbuilt for the count extension.

Verification: `python3 docs/evaluations/verify-cpu-provider-stop-cache-reload.py`.
