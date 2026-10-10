# Source SDK lifecycle repair

Before changes, the compiled source proxy leaves both pending and later requests unresolved after worker exit. An object-valued native abort throws message.replace is not a function and leaves requests pending. The red diagnostic preserves these outcomes.

The isolated source patch ports existing installed-SDK worker lifecycle fixes: store terminal failure, reject queued/in-flight tasks on exit, reject later tasks, terminate on worker errors, normalize abort messages and settle tasks before optional logging. The diagnostic logger deliberately throws; patched task rejection remains intact. The same mock-transport test of the rebuilt source rejects all four requests and terminates each fake worker exactly once. TypeScript 5.4.5 noEmit check passed.

These are compiled source proxy tests using a mock Worker transport, not browser WASM execution or IM Stop verification. The driver uses a 50 ms observation window to expose pending promises; this is not a cancellation latency benchmark. The patch is confined to the isolated upstream checkout; no upstream commit, publication, installed dependency change or product integration occurred. Actual browser regression remains required. Other installed cache/provenance/capability patches still need a complete source-port audit.

Verification: `python3 docs/evaluations/verify-cpu-source-worker-lifecycle.py`.
