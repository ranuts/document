# Cancel during capability detection

The local initialization path checks its lifetime signal after awaited GPU adapter detection and before constructing a GPU or CPU provider. This protects the settings cancellation/provider-switch boundary even when capability detection resolves late.

A new two-case regression controls the pending adapter result, disposes the local provider, then resolves detection with either GPU availability or absence. Both cases reject with AbortError, construct neither backend, remain not ready with no selected backend, and reject later preload attempts. This proves that the audited boundary cannot initiate either backend's model loading after cancellation; it does not simulate a hanging browser API or real-device resource failure.

Current focused verification: local-provider and panel-loading suites, 56 tests in two files passed. Root TypeScript and scoped oxlint passed. No product implementation changed and no production rebuild was needed.

Existing native evidence is separate: [controlled Worker failure receipt](2026-10-04-local-init-fallback-worker.json) used real CPU inference after injected GPU initialization failure, with warm cache and network available. [Observed status transitions](2026-10-04-gpu-cpu-status-transition.md) confirm backend/model identity in that older build. Those receipts do not independently certify today's build, cold offline fallback, physical GPU/OOM failures, or semantic summary fidelity. The earlier initialization tests also prohibit replaying failed streaming generation through another backend.

The core requirement remains local initialization fallback, with incomplete-generation recovery kept distinct. Broad model quality and physical mobile acceptance remain unresolved.
