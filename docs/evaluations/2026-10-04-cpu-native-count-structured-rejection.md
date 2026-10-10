# Native CPU count prototype: first runtime acceptance

The structured rejection build completed with exit code 0. The browser probe and predeclared verifier both passed. Each full-template preflight count matched subsequent actual generation usage:

| Request | Preflight tokens | Actual prompt tokens |
| --- | ---: | ---: |
| ASCII greeting | 16 | 16 |
| Chinese system/user | 25 | 25 |
| Mixed text, date and amount | 45 | 45 |
| Multiple turns | 30 | 30 |

Each case was counted twice with identical results and actual context capacity 2048. Captured SDK actions during these preflights consisted only of `count_chat`; the native implementation shares generation's template/tokenizer path and posts no generation task. This is stronger than the rejected max_tokens=0 completion workaround, but does not certify every possible runtime side effect.

The previously overflowing 1900-character custom Chinese system instruction counted 3821 prompt tokens against capacity 2048, without attempting generation for that oversized request. Unsupported content parts returned success=false, a readable reason and zero counts through the normal glue response. A following valid preflight returned 16 and generation completed; its deterministic greeting matched the first greeting. The prior null-return response-length failure did not recur in this test.

Evidence: [raw report](2026-10-04-cpu-native-count-structured-rejection.json), [predeclared driver](probe-cpu-native-count-structured-rejection.mjs), [verifier](verify-cpu-native-count-structured-rejection.py), [native patch](cpu-native-count-structured-rejection.patch). The raw report binds driver and patch hashes, captures SDK interception, native artifact hashes, per-case options/counts/usage and incremental results. Browser and local server closed normally. No editor write or Save.

This is an isolated Chromium, CPU compatibility, Qwen3-0.6B prototype. Tool-bearing requests, structured-output schemas, exact output reservation boundaries, application history trimming, concurrent/lifecycle cancellation, other models and broader browser compatibility remain unverified. Production has not adopted the patch; the current byte budget remains approximate. Next validate tool/schema overhead and context boundary before planning product integration.
