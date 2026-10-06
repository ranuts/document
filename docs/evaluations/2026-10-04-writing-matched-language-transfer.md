# Frozen matched-language candidate: unused-source transfer

Do not adopt this candidate as a general writing configuration. It improves seven observed transfer outputs, but the remaining Japanese case loses a critical negation and is applied. Successful short development cases did not establish general fidelity.

## Provenance and method

Four-per-language example sets frozen from `3a5a7f8`; new Japanese/Korean/German/Portuguese multi-participant/condition/status fixtures, driver and verifier preregistered in `5f8b415` before inference. Examples are unchanged and their SHA256 is recorded/verified. This is a narrow targeted screen of previously unused sources, not random/general language accuracy. No tuning on these outputs occurred during the run. `baseline` has no examples; `matched` has four examples chosen from oracle case-language labels. This is not product language detection, nor a comparison against the production writing prompt.

Same minimal system prompt, body-only final source/instruction, flat JSON schema, temperature 0, top_p 0.8, max_tokens 512, thinking disabled, current guards and Qwen3-1.7B-q4f16_1-MLC. Actual local WebGPU Worker/native Word IM rewrite route; route-local request instrumentation, no model-output/editor-result substitution; bundle files unchanged.

## Manual output review

| Fixture | Baseline | Frozen matched examples |
| --- | --- | --- |
| Japanese permission recipient, absent permission | Awkward wording retains absence/inability, adds confirmation commentary | Changes “許可をまだ受けていない” to affirmative “許可をまだ受けており”; loses negation while still claiming cannot refund; applies |
| Japanese permission granted, refund pending | Preserves roles/status with awkward subject order | Preserves 健太 authorizer, 綾乃 executor, 美咲 recipient and pending refund |
| Korean approval required, absent | Invents restaurant/meal setting, omits named parties, turns may into obligation; applies | Preserves 유진 sender, 서준 recipient, 하린 approver and required/absent approval |
| Korean approval unnecessary, shipment pending | Returns instruction-like meal wording and omits literals; refused | Preserves parties, no-approval prerequisite and uncompleted sending |
| German reimbursement complete, approval absent | Unchanged; refused | Retains completed reimbursement and missing Niklas approval, removes filler |
| German conditional/unpaid | Changes darf to muss and adds already-approved wording; applies | Preserves permission, conditional approval and unmade reimbursement |
| Portuguese proposal/unaccepted | Adds “conhecendo todos os participantes” unsupported wording and keeps filler | Retains past proposal/unaccepted state, removes filler |
| Portuguese completed delivery/no confirmation | Keeps filler | Retains completed delivery/no confirmation, removes filler |

Baseline applies six/refuses two; matched applies eight/refuses zero. Counts are execution, not correctness. Seven matched outputs have no concrete semantic defect identified in this manual screen; the Japanese negative-permission case is enough to reject broad adoption. All names/date/amount survive that negative-case output, demonstrating that literal/script guards do not prove negation or logic preservation. Do not add a fixture-specific Japanese negation regex as a substitute for semantic validation.

## Verification and next direction

`python3 docs/evaluations/verify-writing-matched-language-transfer.py` passes all 16 actual requests, exact frozen example hash/objects/order, system prompt, final source/instruction identity and identical non-message request settings, driver/current-bundle hashes, no previews, preserved source on refusal and exact native Undo/Redo on applied results. Completed report has no harness errors or recorded external requests. No claim of CPU/mobile, native Save, cold offline/PWA or general privacy certification follows.

The new case set is now observed and cannot remain heldout for subsequent tuning. Preserve this failure, do not promote the candidate or reinterpret eight applications as accuracy. Further work should compare alternative model families/task conditioning on broader writing requirements, while retaining the original browser-local/privacy and concise-IM objectives. Other styles, summarize/translate, language routing and resource budgets still require validation.
