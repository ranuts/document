# Fixed writing demonstrations development experiment

The four fixed demonstrations improve all eight known development cases in this run. This is a promising diagnostic candidate, not evidence for a production replacement or general semantic correctness.

## Method

Driver and demonstration examples preregistered in `bc46afe`. Both variants use the same minimal system prompt and user JSON containing identical source text and instruction. `examples` adds four user/assistant example pairs with different names, dates and amounts; `baseline` adds none. Same Qwen3-1.7B-q4f16_1-MLC, local WebGPU Worker, temperature 0, top_p 0.8, max_tokens 512, thinking disabled, flat JSON schema and production guards. Actual native Word IM rewrite route and native Undo/Redo; route-local request mutation/raw recording, no model-output or editor-result substitution. Distribution bundles unchanged.

Examples deliberately address failures in the already-seen four-language corpus: retaining payer/recipient, authorizer/status, permission/condition, proposal/completion while removing casual style. Their structural similarity means the development results cannot demonstrate generalization. The examples are not generated from the current source during inference.

## Manual review of captured text

Baseline applies six and refuses two. It leaves Nora's English case and the French proposal unchanged; Spanish retains casual tags; French completed shipment retains “Bon” and adds “comme indiqué”. Example variant applies all eight. English outputs remove greeting/tag and retain both payment participants; Chinese retains authorizer and authorized/not-authorized status; Spanish retains “puede” and respective prerequisite/absence-of-prerequisite while removing tags; French removes filler and retains proposed versus completed shipment. No concrete role/status/modality defect was identified in manual review of these eight example outputs. This is not an automatic correctness score, and applies only to these short fixtures.

Adding demonstrations increases observed median response time from approximately 1.10 seconds to 2.03 seconds on this warm desktop run. Fixed-order single samples do not establish a performance benchmark, variance or mobile cost. More context also uses model input budget.

## Verification and transfer requirement

`python3 docs/evaluations/verify-writing-demonstrations.py` checks all 16 actual model requests, exact example objects/role order, paired source/instruction and fixed system prompt, identical sampling/schema, driver/current-bundle hashes, no preview cards, source preserved on refusal, and exact native Undo/Redo for applied results. Completed report has no harness errors or recorded external requests. No CPU/mobile, cold offline, native Save or general privacy certification follows.

Freeze this candidate and test newly preregistered multi-participant/multi-clause role/negation/condition cases before any adoption. Do not retune after seeing those outputs and still label them heldout. Broader languages and summarize/translate remain untested by this candidate.
