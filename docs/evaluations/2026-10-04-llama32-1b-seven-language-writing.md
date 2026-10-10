# Llama 3.2 1B: current browser writing route

Decision: do not change the default model. This candidate did not satisfy the existing seven-language writing fixtures.

The actual Chromium/WebGPU engine reported `Llama-3.2-1B-Instruct-q4f16_1-MLC`. The test used the previously declared 21 rewrite, summary and translation fixtures, actual IM task and translation controls, selected native Word text, and current production prompts and guards. Each case ran once in fixed order. This is known-case evidence, not heldout accuracy or a general device benchmark. No product bundle was changed and no native Save was performed.

## Observed outcomes

14 requests were refused with original document text preserved. Seven requests had no UI error: five changed native text and two left it unchanged. All five edits had exact native Undo/Redo verification. No preview cards or browser page errors were recorded.

Passing the mechanical guard did not establish writing quality:

- Japanese summary retained proposer, date, quantity and price but omitted the inspection prerequisite, pending inspection and unauthorized shipping.
- Korean summary omitted the inspection prerequisite and retained the parking meeting that should have been omitted; it was several sentences.
- Korean rewrite removed the greeting but retained informal endings rather than producing formal prose.
- Japanese and German translation returned the English source unchanged without a UI error.
- Korean translation returned English plus a literal backslash-n, which changed the native document without translating it.
- Portuguese translation preserved the visible names, quantity, ISO date, denial and lack of confirmation. This isolated reasonable result does not compensate for the other failures.

Refused outputs included unchanged rewrites/summaries, changed numeric formatting, malformed content, and Chinese rewrite repetition reaching the length limit. Refusal protects document contents but is not evidence that the model fulfilled the request.

## Limits and verification

The production system message includes `/no_think`; captured Llama requests do not have Qwen's `extra_body.enable_thinking` field. Therefore this is the actual current integration, not an optimized Llama prompt evaluation or an identical-token model comparison. The driver scope's shorthand “thinking-off” refers to the retained production prompt, not proof of a Llama thinking-control API.

Initial model assets were downloaded. Captured page network requests were GETs with zero request body bytes; Worker network traffic is not comprehensively audited by that observation. This run does not certify offline cold start, memory usage, mobile compatibility or all network privacy behavior. SDK resource estimates are not measurements.

Run `python3 docs/evaluations/verify-llama32-1b-seven-language-writing.py` to independently check fixture identity, captured engine request model, sampling/schema, actual source and translation targets, refusal preservation, native history for edits, probe hash and unchanged served bundle. The verifier checks mechanics, not semantic correctness.

Raw report SHA-256: `2ea5bb5c773160aac4b094d2c1f5689fb2a90153ac5f3ee74eccf31ddbda9fdd`.
