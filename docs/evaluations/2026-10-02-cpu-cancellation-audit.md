# CPU cancellation latency

Severity: high usability issue. Local CPU cancellation is functionally recoverable but not responsive during prefill.

`2026-10-02-offline-cpu-cancel-ui.json` starts a new isolated Chromium process offline, forces CPU, loads the cached Qwen3-0.6B model, submits a request and clicks Stop 500 ms after the running button appears. No assistant text is visible before Stop. The input remains unavailable for another **23,282 ms**. A subsequent real request eventually returns Hello in 7,320 ms. Page errors are empty. The script's `passed` result means recovery succeeded; it does not mean cancellation latency meets a usability gate.

The refreshed CPU shell uses the current core-1790920954 build. This reproduces the issue after the WebLLM stream-lock fix; it is a separate CPU problem, not evidence that the GPU fix regressed.

## Direct dependency evidence

Installed wllama 3.6.1 `esm/index.js`, `getResponse()` checks `options.abortSignal.aborted` before awaiting `proxy.wllamaAction('get_result', ...)`. The signal is checked again only after the current action returns. Its finally block then cancels the native request. Therefore forwarding AbortSignal does not guarantee prompt cancellation during an outstanding prefill action.

The same installed SDK's `exit()` delegates to `proxy.wllamaExit()`. That method calls `worker.terminate()` directly. This provides a path to stop CPU work immediately rather than merely unlock the UI while inference continues.

## Required next change and evidence

- Race the active CPU operation against cancellation, terminate its owned worker and suppress all late output. Verify this with an engine whose prefill promise never resolves; a normal short mock cannot expose the observed problem.
- Make the stopped request reject promptly without replaying it or uploading anything. Restore a fresh engine from existing model cache before allowing another request, with an honest loading state. A destroyed worker must not continue to appear ready.
- Preserve explicit first loading, history, generation parameters and no-cloud behavior. Handle disposal while recovery is in progress, recovery failure and repeated cancellation without duplicate worker cleanup or stale state publication.
- Run the actual offline prefill-stop experiment again and separately measure immediate stop responsiveness, model restoration and subsequent real inference. Keep this original measurement for comparison.

## Implemented correction and validation

WllamaProvider now races inference against the combined request/lifetime signal. Cancellation invalidates the engine, invokes exit to terminate its Worker, and settles the request without awaiting the blocked action. Reload waits for cleanup. Disposal owns the same cleanup, preventing duplicate termination. Late chunks are ignored. The panel unlocks input, shows Preparing AI with the selected backend, and restores the model using the normal loader; the stopped request is not replayed. The controller labels explicit user cancellation as Stopped.

The stalled-prefill test first timed out before the implementation; it now passes and requires an explicitly loaded fresh engine before the next call. A disposal test confirms a stalled request rejects and releases its Worker exactly once. Panel recovery and cancellation-label regressions were observed failing before their respective fixes. The existing deferred-factory disposal test also exposed an unwanted initialization scheduling change; initial preload no longer awaits an unnecessary resolved cleanup promise.

`2026-10-02-offline-cpu-cancel-ui-before-termination.json` preserves the 23,282 ms baseline. The final built version (core-1790921811) is tested from an offline cold browser process. Stop takes **25 ms**, the model restores in **1,693 ms**, the UI shows **Preparing AI… · CPU**, the transcript says **Stopped**, and a subsequent real request returns Hello in 22,878 ms. Page errors are empty. An earlier implementation-only run measured 20 ms stop and 1,631 ms reload; final UI evidence supersedes it. This improves cancellation; it does not improve CPU prefill speed itself.

CPU stop during streamed decoding, cancellation across slow devices, cleanup/reload failure and repeated real recovery remain separate verification work. No broad stability or full-goal completion is claimed.

Subsequent `2026-10-02-offline-cpu-repeat-cancel-ui.json` verifies two consecutive prefill cancellations in one offline cold session. Stops take 17 and 22 ms; model restoration takes 1,736 and 1,452 ms. Both show Preparing AI and Stopped. The final real request returns Hello in 23,942 ms, with no page errors. This covers two repeated recovery cycles; it does not establish long-run memory stability or decoding-phase cancellation.
