# Larger Hy-MT2 browser CPU initial failure

The fixed 4,624,648,896-byte Q4_K_M model matches the published SHA-256. The exact seven requests and runtime parameters match the prior 1.8B screen. The browser reports ready and cross-origin isolation, but the first generation terminates with WASM RuntimeError ABORT and no completion. Zero translations complete; this is not a model-quality score or a seven-language screen.

The process exits 1 and records closed context/browser/server, with no page errors. Initial receipt SHA-256: `f81b2459e4cbe784f48e88959df12b61acdde5f69d150827a02e51f94136874b`. The initial driver does not capture browser console/native log output, so the abort cause is unresolved. No memory, architecture or tokenizer diagnosis is asserted from ABORT alone. A separately named console-observation driver is prepared without changing requests/model bytes or adopting the candidate.
