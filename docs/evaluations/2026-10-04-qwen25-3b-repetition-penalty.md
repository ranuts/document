# Qwen2.5 3B q4f32: inherited repetition-penalty diagnostic

Neutralizing repetition penalty does not resolve the malformed-date problem or justify a default change. It improves some wording but introduces an unsupported per-item valuation in an applied Spanish summary.

Driver/verifier preregistered in `eb7002b`. Seven known summary development sources; one fixed-order sample for explicit repetition_penalty 1.05 (cached model default) versus 1.0 (neutral). All other actual Worker request fields are identical: original production messages/schema, temperature 0, top_p 0.8, 512 output tokens, same q4f32 model and current editor guards. Native Word IM route, route-local request mutation/raw recording, no generated-output/editor-result substitution. Distribution bundles unchanged.

| Language | Neutral 1.0 observation |
| --- | --- |
| Chinese | Still corrupts date into 2044-09-erves, refused |
| English | Correct literals and facts; joins two sentences into requested one, applies |
| Japanese | Still corrupts date into 2044-09-erves and omits pending inspection/approval status, refused |
| Korean | Preserves explicit filter valuation and pending status; still two sentences, applies |
| German | Retains literals/status with causal/interpretive linking, applies |
| Spanish | Date now correct, but adds “430 PLN cada uno” (430 PLN each) where source states value of 11 filters; applies despite changed amount relationship |
| Portuguese | Identical corrupt 2044-09-ferences, refused |

Penalty 1.05 applies three/refuses four; neutral applies four/refuses three. Execution counts are not correctness. Exact names/counts/amount/date cannot prove that the amount values the correct thing. Do not promote neutral setting or add fixture-specific value-binding regexes based on this single screen.

`python3 docs/evaluations/verify-qwen25-3b-repetition-penalty.py` verifies 14 actual requests, source/instruction/task/model, sampling/schema/current bundle and driver hashes, only penalty differing in paired request bodies, no previews, source retained on refusal and exact native Undo/Redo on applied output. Completed report has no harness errors. This does not establish physical mobile/CPU, Save, cold offline/PWA/privacy or general semantic quality. Defaults remain unchanged; cached weight shards and lower-level numeric/token behavior still require investigation.
