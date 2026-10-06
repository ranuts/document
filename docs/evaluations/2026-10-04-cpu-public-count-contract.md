# Public count contract diagnostic

Standalone Chromium CPU compatibility execution completed. Explicit enable_thinking=true gives 12 prompt tokens, false gives 16; each exactly matches actual generation usage. This demonstrates why the count must receive the same template parameters as generation.

An already-aborted signal throws AbortError without dispatching native work. An instrumented proxy aborts the signal after the native count response, before the public method continuation; that call also throws AbortError. A subsequent count recovers the original 16-token result. This controlled boundary check does not prove cancellation interrupts native work already executing, nor does it test the application's Stop button.

The one-token generations expose usage, not output-quality acceptance. Load-time default-template-kwargs overlay, no-model behavior, TypeScript build and production provider integration remain unverified. The unchanged locally served client hash and native artifacts are recorded in raw JSON. Driver instrumentation observes actions and injects the post-response abort; actual native counts and generations run in the worker.

Verification: `python3 docs/evaluations/verify-cpu-public-count-contract.py`.
