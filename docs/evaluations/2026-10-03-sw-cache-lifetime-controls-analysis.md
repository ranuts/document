# Size, cache use and quiet timing controls

The [four controlled observations](2026-10-03-sw-cache-lifetime-controls.json) narrow the large-response promotion failure. Each uses a fresh owned Chromium context, Brotli transport, the same response reconstruction, body-reader draining with releaseLock, an installed waiting Worker and an acknowledged SKIP_WAITING. There is no native editor, document save or WASM compilation.

| Body and consumption | Timing before update | Observed controller |
| --- | --- | --- |
| Actual x2t, 42,111,200 decoded bytes; second request cached | Immediate | Old throughout 20-second bound |
| Valid empty WASM, 8 decoded bytes; second request cached | Immediate | New acquired |
| Actual x2t; both requests network, no Cache API | Immediate | Old throughout 20-second bound |
| Actual x2t; second request cached | 40-second quiet interval | New acquired |

The cache controls include a server request counter: the second request produces zero upstream requests when cached and one when network-only. Each body is read to exactly its decoded size. Large rows share the actual product WASM digest; the tiny row is an explicitly synthetic valid empty module.

Cache use, native document saving and compilation are unnecessary for a bounded failure. The large-versus-tiny comparison does not isolate size from module content or encoded size; it cannot establish a size threshold. The quiet interval changes the outcome in this run, suggesting lifecycle timing is relevant. A fixed 40-second production delay is not justified: this is a diagnostic interval, not a measured minimum, robust recovery or acceptable UX. The active VERSION polling itself may affect idleness, so a separate saved-session observation delays the observer while leaving the product updater and landing prefetch unchanged.

`python3 docs/evaluations/verify-sw-cache-lifetime-controls.py` checks source and asset hashes, exact consumed sizes, cache/network counters, quiet-interval timestamps, switch delivery and controller outcomes. All four rows are preserved, including negative outcomes; product migration remains unaccepted.

## Actual saved-session quiet-observer control

The [saved Word observation](2026-10-03-sw-saved-quiet-observation.json) uses the original two-build artifact probe through the full-Chromium driver, delaying only its first landing VERSION query by 40 seconds. The product updater, landing prefetcher, document save, candidate artifacts and caches remain unchanged. There is no manual skipWaiting, Worker termination or cache deletion. The driver records start/end timestamps proving the delay occurred.

The native old save completes, the correct candidate waits installed, but the controller still reports the old vendor throughout the remaining observation interval. The total promotion observation deadline is 60 seconds, of which the initial 40 are deliberately silent; this is not 60 seconds of VERSION sampling. The small isolated control's success therefore cannot be promoted into a saved-session fix. Delaying the harness alone is insufficient in this real workflow; landing background activity and other lifecycle differences still need investigation. This run does not establish the internal browser idle state.

JS syntax, both scoped evidence verifiers, lint and diff checks pass. Product code is unchanged; no product build or full unit suite is repeated for these diagnostic files.
