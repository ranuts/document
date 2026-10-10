# Source SDK download cancellation port

The isolated source-built SDK lacked installed-package download cancellation patches. The red diagnostic observes missing signal forwarding in metadata, cached-file HEAD and model HEAD requests. After porting the existing source patch for cache-manager, huggingface and model-manager, all three mocked network/storage phases reject with AbortError, forward headers and signal, issue one request and delete no cache entries.

The imported source patch initially fails the upstream exactOptionalPropertyTypes compiler check because optional signal/headers properties are explicitly undefined. Conditional property spreads fix these three request initializers without changing configured options. TypeScript 5.4.5 noEmit then passes, and the rebuilt typed bundle passes the same cancellation diagnostic. Both initial green and final typed raw results are retained. The probe's first red setup hung during cleanup after triggering fallback network work; bounded cleanup was corrected before the saved red run.

This is a source SDK port with mocked fetch/storage, not real browser download, cache persistence or offline acceptance. Native model counting and generation must be rerun with the newly rebuilt combined client before packaging. The upstream checkout is uncommitted; installed application dependencies remain unchanged. Memory64 capability detection and remaining package/source parity still require audit.

Verification: `python3 docs/evaluations/verify-cpu-source-download-cancellation.py`.
