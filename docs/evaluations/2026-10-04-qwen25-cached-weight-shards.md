# Qwen2.5 3B cached weight-shard audit

All 124 cached q4f16/q4f32 weight files match the declared size and MD5 in the complete manifests previously found structurally identical to fixed public repository revisions. Total local bytes read: 3,472,375,808. No mismatches or missing files. This rules out a detected accidental shard corruption in this profile; MD5 is not an adversarial authenticity guarantee.

The read-only Playwright probe enumerates existing cache/IndexedDB entries and transfers each cached Blob to a Node digest in sequential 1 MiB chunks. It performs no model inference, asset downloads, browser-storage writes, cache deletion or document operations. The browser closes in finally. The report binds the probe SHA256. `python3 docs/evaluations/verify-qwen25-cached-weight-shards.py` verifies exact coverage of all manifest records, no duplicates, sizes/checksums and earlier pinned structural equality. This verifier checks saved evidence, not a new cache read; rerun the probe for a fresh audit.

Compiled WASM libraries have not yet been compared to pinned upstream artifacts. Matching weights/config/tokenizer does not establish numerical runtime correctness, generation quality, semantic safety, offline/PWA support or mobile behavior. Malformed dates remain unresolved; no production model or generation defaults change.
