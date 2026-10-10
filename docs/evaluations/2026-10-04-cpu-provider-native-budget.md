# Actual CPU provider measured budgeting

The compiled production WllamaProvider class was served as local ES modules and supplied an engineFactory wrapping the source-built count-capable SDK and native CPU compatibility Worker. Context capacity is deliberately 256 tokens and output limit 32. This tests actual provider logic and native counting/generation, without activating the installed application SDK or editing documents.

An initial fixture used 1000 repeated x characters and did not trigger the required trim; its raw failed diagnostic is retained. The diagnostic expectation was unsuitable for a token budget. The subsequent driver uses 200 repetitions of the previously measured high-token character and saves partial count/generation records.

The completed run measures 436 prompt tokens before trimming and 24 after dropping the complete older user/assistant turn. Actual generation usage is 24, the exact last-counted request equals the generation request, contextTrimmed=true, and source history remains byte-for-byte unchanged. A 200-character custom system prompt then measures 419 tokens and raises agentContextTooLong without another generation. Restoring the short system prompt measures 24 and generates successfully. Total native generations: two.

There are no page errors. Provider module hashes, native/client hashes and driver hashes are recorded. The test uses the provider's injection seam with an already-loaded isolated engine; shipping SDK/native packaging, normal preload/cache/offline paths, UI notice rendering, GPU parity and full document tool fidelity remain unverified by this run. This is context handling acceptance for one native CPU provider scenario, not writing-quality acceptance.

Verification: `python3 docs/evaluations/verify-cpu-provider-native-budget.py`.
