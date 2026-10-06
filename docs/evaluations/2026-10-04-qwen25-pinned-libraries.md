# Qwen2.5 3B compiled-library provenance

Both cached q4f16/q4f32 WASM libraries match pinned public upstream artifacts by size and SHA256. Repository `mlc-ai/binary-mlc-llm-libs`, revision `025bcaf3780fa8254f5e5efd3bfea0a5397248f4`; catalog path `web-llm-models/v0_2_84/base`. The comparison fetches only public library bytes and does not transmit document content or run inference. It compares the saved read-only cache snapshot; rerun cache collection for a new browser-state observation.

The f16 library is 5,438,957 bytes, SHA256 `bae8a6d2718f52e2ed232f069c175b0858e30b90ebfe2b56ca2edcb4bd40305a`. The f32 library is 5,297,311 bytes, SHA256 `aae12cd18b5c2823df914e07be5fca45768fdbaf726103781b54d8c055e5818b`.

Together with the separate pinned config/tokenizer/full-manifest comparisons and all 124 cached shard checksums, this detects no downloaded-asset content mismatch in the audited profile. It does not establish model/library ABI compatibility, compilation correctness, browser/driver arithmetic correctness or generated-text quality. Malformed dates remain unresolved. Public upstream identity does not prove a model is suitable for autonomous editing. No production defaults change.

`python3 docs/evaluations/verify-qwen25-pinned-libraries.py` checks exact two-library coverage, probe hash, fixed revision URLs and the saved local/remote digests. `compare-qwen25-pinned-libraries.py` performs a fresh public comparison and records the then-current commit before fetching pinned files. Next investigate simple date/token copying separately from longer semantic summary prompts; do not change user-facing defaults based on asset matching alone.
