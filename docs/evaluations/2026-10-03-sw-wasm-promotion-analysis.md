# Cached WASM narrows the saved-session activation failure

A smaller owned-browser experiment reproduces a bounded promotion failure without opening any native editor or saving a document. It serves the actual compressed x2t WASM with Brotli transport, first drains a network response through a cache-first ServiceWorker, waits for its cached entry, then consumes the same cached asset with zero additional upstream WASM requests. Each mode runs in a fresh browser context. The decoded module is 42,111,200 bytes. No product sources or deployed artifact bytes change.

The old Worker answers VERSION, the new Worker waits installed and answers its own VERSION, and the landing page receives an acknowledgement for SKIP_WAITING. The probe polls the controlling VERSION for 20 seconds. The [direct-response run](2026-10-03-sw-wasm-direct-response.json) and [reconstructed-response run](2026-10-03-sw-wasm-reconstructed-response.json) use the same current probe hash, browser channel and asset digest, varying whether the SW returns the response directly or reconstructs it with isolation headers.

| Cached consumption | Direct response | Reconstructed response |
| --- | --- | --- |
| Read body to completion, release reader | Old controller throughout bound | Old controller throughout bound |
| Main-thread compileStreaming | New controller acquired | Old controller throughout bound |
| Dedicated-Worker compileStreaming, then page navigation | Old controller throughout bound | Old controller throughout bound |

Both compilation modes compile a real module and record 31 exports and 104 imports. They do not instantiate the converter, allocate its configured heap or convert document bytes. The dedicated Worker belongs to the page being navigated away from; the probe does not manually terminate it to obtain a pass. An [initial reconstructed-response experiment](2026-10-03-sw-wasm-promotion.json) also fails all three modes, but predates the explicit reconstruction/modes parameters and intentionally has an older source hash.

These observations establish that native editing, document saving, converter instantiation, stream compilation and response reconstruction are each unnecessary to reproduce at least one bounded failure. They do not prove every large cache response causes failure, that size or Brotli encoding is necessary, that streaming is broken, or that promotion can never happen later. The single direct main-thread success makes timing a relevant uncontrolled dimension rather than a production fix. Earlier bare-SW and native Blob-download positive controls still delimit the problem; this experiment adds cache/body traffic absent from those controls.

The next controls should vary asset size, cache use and timing while retaining the real saved-session regression as the final gate. Removing WASM caching or killing an old Worker would undermine offline behavior or bypass the required migration lifecycle. No such product change is made.

`python3 docs/evaluations/verify-sw-wasm-promotion.py` verifies both current report hashes, actual asset digest/decoded size, cache-hit evidence, compilation metadata, delivered switch acknowledgements and recorded controller outcomes. The verifier uses Node's built-in Brotli decoder and requires no extra Python packages. It explicitly reports product migration as unaccepted. JS syntax, lint and diff checks pass; full product build/unit tests are not repeated for this diagnostic-only change.
