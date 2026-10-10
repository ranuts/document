# Paired CPU count candidate

The default memory64/JSPI CPU runtime passes the four actual usage comparisons, repeated count-only intervals, overflow detection, unsupported-content rejection and deterministic recovery with an actual pthreadPoolSize of 4. No browser capability overrides are applied in that default count driver.

The default four-thread provider also begins actual streamed generation, aborts after the first nonempty delta, retires the old runtime once, reloads a new runtime from real Cache API storage with the model URL blocked, and generates again. Both native loads log a four-thread pool. The provider uses the injection seam rather than the built-in application loader.

The same default-source-built client also passes the original forced-compatibility one-thread count/generation/rejection scenario with the compatibility native pair. Thus one client is now verified against both candidate native variants. The ZIP listed in the package JSON contains that client and separate default and compat JS/WASM pairs, source patches/preparation script, license files and entry hashes. Every entry was read back and compared to its original bytes. A matrix verifier checks client and both native file hashes against the terminal browser evidence.

This is an isolated candidate archive, not product activation or a full reproducible build certification. Compatibility multi-thread behavior, normal loader selection, deployed CSP, IM Stop/trim notices, complete PWA offline flow and physical-device/model fidelity acceptance remain incomplete. The package does not include model weights or a full upstream source tree. Existing product dependencies remain unchanged.

Verification: `python3 docs/evaluations/verify-cpu-default-count-multithread.py`, `python3 docs/evaluations/verify-cpu-default-provider-stop-cache-reload.py`, `python3 docs/evaluations/verify-cpu-dual-client-compat-count.py`, and `python3 docs/evaluations/verify-cpu-count-dual-package.py`.
