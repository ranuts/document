# Frozen demonstration prompt: new multi-clause transfer screen

The frozen demonstration candidate improves this narrow screen but still leaves informal wording in two cases. It is not adopted as a production configuration; broader operations, languages and CPU/mobile behavior remain unverified.

## Provenance and scope

Four fixed examples and diagnostic driver preregistered in `bc46afe`. After the eight-case development experiment, the examples/system prompt were frozen. Eight new multi-participant/multi-clause source fixtures, baseline/examples driver and verifier preregistered in `b7c91ad`, before transfer inference. No candidate tuning occurred between development and transfer. These new sources were not used to construct the candidate, but their targeted categories were chosen from known failure modes; this is a narrow transfer screen, not random sampling or general heldout accuracy.

Both variants retain identical current source/instruction, body-only user JSON, minimal system prompt, model Qwen3-1.7B-q4f16_1-MLC, temperature 0, top_p 0.8, max_tokens 512, thinking disabled, flat JSON schema and production parse/apply guards. Examples adds only the frozen four user/assistant pairs. Actual local WebGPU Worker through native Word IM rewrite route with diagnostic route-local request mutation/raw recording. No generated-output/editor-result substitution; bundle files unchanged.

## Manual review of actual outputs

| Fixture | Baseline | Frozen examples |
| --- | --- | --- |
| English conditional/unpaid | Changes “no payment has been made” to “payment remains unapproved”: unsupported status change | Preserves no payment made, may reimburse, parties and signature prerequisite; removes filler |
| English paid/not-approved | Preserves completed payment and absent approval, formal text | Preserves facts but retains “Hey” |
| Chinese authorization recipient/not authorized | Preserves three roles, missing authorization and inability to refund; removes filler | Preserves roles/status but retains sentence-final “呢” |
| Chinese authorizer/authorized/pending refund | Preserves authorizer, executor, recipient and unexecuted refund | Preserves same distinctions, removes filler |
| Spanish negative permission | Retains “A ver” and changes tag to “entendes?”; no useful formalization | Preserves negative permission and necessary signature, removes filler/tag |
| Spanish permission without signature | Unchanged, refused | Preserves permission without signature, removes filler/tag |
| French proposal/not accepted | Preserves proposal and absent acceptance but retains “Écoute” | Preserves same distinctions, removes filler/tag |
| French completed transfer/no confirmation | Unchanged, refused | Preserves completed transfer and absent confirmation, removes filler/tag |

Baseline applies six/refuses two; examples applies eight/refuses zero. These are execution counts, not accuracy. Manual review found no concrete role/negation/modal/status defect in the eight candidate outputs, but two have incomplete formal style. This does not prove universal semantic fidelity. The baseline unpaid→unapproved change illustrates why native application and numeric/currency guards alone are insufficient.

## Verification and limitations

`python3 docs/evaluations/verify-writing-demonstrations-transfer.py` passes: 16 actual requests, exact frozen demonstrations/role order, fixed system prompt, same source/instruction, only demonstration messages differing, identical request parameters, exact driver/current bundle hashes, no previews, preserved source on refusal and exact native Undo/Redo on every applied output. A temporary report with a substituted assistant example is rejected. Completed report has no harness errors or recorded external requests.

One fixed-order warm desktop GPU sample per case/variant. Native Save, CPU/mobile, cold offline/PWA, all supported languages, summarize/translate and broad style/content behavior are not certified. Demonstrations also increase input context and observed latency. Do not tune this candidate on these transfer outputs and continue calling this set heldout. Future candidate changes require additional unused validation inputs. Production defaults remain unchanged.
