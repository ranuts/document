# Summary-specific prompt: four GPU model observations

The summary-specific candidate is **not adopted**. It introduces serious factual regressions on the default 1.7B and 2B models, while stronger 4B output still adds unsupported causal explanations. The current prompt also fails some explicit requirements. Neither mechanical success nor using a larger model closes writing-quality acceptance.

## Experiment controls

Six cases were written before inference: English/Chinese conditional shipment, payer/recipient, allegation/denial, conditional repair, and cancellation with an exception. Each instruction specifies a shorter single sentence and details to omit. These fixtures are now observed regression cases, not future independent held-out acceptance samples.

Each of the four configured GPU models ran each case once with the current messages and once with the summary-specific message combination, in that fixed order. The candidate changes both system wording and user-message packaging, so the result is a complete message-combination comparison, not isolation of one prompt sentence. Model, schema, temperature 0, numeric/currency guards and other non-message request fields stay equal within each pair. This is cached desktop Chromium/Metal production IM with route-local bundle instrumentation and Worker request transformation; production files are unchanged. The inherited report scope says “default WebGPU model”; this applies only to 1.7B. The authoritative modelId, displayed engine and outgoing Worker request establish 4B, 2B and 0.8B in their respective reports.

[Mechanical verifier](verify-gpu-summary-focused.py) checks all 48 actual inference rows, source/instruction identity, schema and non-message parameter equality, exact rejection preservation or native Undo/Redo, zero previews, recorded external requests and page errors, and unchanged built bundle bytes. It does **not** evaluate semantics. No native Save/reopen, offline, CPU inference, physical devices, deployment/CSP/SW acceptance or reliability repetitions were performed here.

## Application outcomes, not quality scores

| Actual model | Current messages       | Candidate messages     |
| ------------ | ---------------------- | ---------------------- |
| Qwen3 1.7B   | 6 applied / 0 rejected | 6 applied / 0 rejected |
| Qwen3 4B     | 6 applied / 0 rejected | 6 applied / 0 rejected |
| Qwen3.5 2B   | 3 applied / 3 rejected | 5 applied / 1 rejected |
| Qwen3.5 0.8B | 0 applied / 6 rejected | 3 applied / 3 rejected |

“Applied” means guards allowed the text and native history worked. Several applied results are wrong. “Rejected” means exact source selection was retained, not that the model generated a correct alternative.

## Semantic review

| Case / model                             | Observed issue                                                                                                                                                                                                                                     | Decision                                                                                                                                                           |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Allegation / 1.7B candidate              | `no investigation has confirmed it` becomes `investigation confirmed`; applied with all literals intact.                                                                                                                                           | Severe factual polarity reversal; reject candidate.                                                                                                                |
| Conditional repair / 2B candidate        | `Rui` becomes `刘`; applied.                                                                                                                                                                                                                       | Person changed; existing numeric/currency checks do not protect names.                                                                                             |
| Allegation / 0.8B candidate              | Drops the accuser `Tomas` despite explicit attribution requirement; applied.                                                                                                                                                                       | Attribution incomplete.                                                                                                                                            |
| Shipment / 1.7B candidate, Chinese       | Omits requested `2036-02-19`; applied.                                                                                                                                                                                                             | Summary guards allow dropping source numbers generally; they do not understand facts requested in free-text instructions.                                          |
| Shipment / 4B, both message combinations | Current uses “not authorized as the inspection is pending”; candidate uses “not authorized due to the pending inspection.”                                                                                                                         | Source states pending inspection and non-authorization but does not explicitly give this causal explanation. Strict fidelity remains unproven.                     |
| Shipment / 4B current, Chinese           | `17个价值480NOK的阀门` permits a per-item value reading.                                                                                                                                                                                           | Amount scope ambiguity, not proof that the value definitely changed. Candidate preserves clearer total-value wording but omits explicit pending-inspection status. |
| Shipment / 2B current, English           | Raw generation swaps the status objects: shipment pending, inspection unauthorized, and retains excluded meeting.                                                                                                                                  | It was rejected for excessive length; do not claim a semantic validator caught the object swap.                                                                    |
| Several applied cases                    | 1.7B candidate shipment/cancellation use two sentences; 1.7B current allegation also uses two. Conditional summaries sometimes state pending parts without retaining explicit prerequisites.                                                       | Formatting and dependency requirements remain incomplete despite shorter text.                                                                                     |
| 2B cases                                 | Candidate Chinese shipment weakens “inspection passes” to “inspection completes” and retains the excluded warehouse meeting; candidate allegation appends “omitting the cafeteria menu notice”; current repair adds lunch and “因” causal wording. | Literal retention is not instruction compliance or semantic fidelity.                                                                                              |

The 0.8B current combination returned source text unchanged in all six cases and was rejected. The candidate applied three: cancellation preserves the requested distinction; English shipment still violates the single-sentence constraint, and attribution loses Tomas. This does not support adopting the candidate to gain more applied actions.

4B preserves several names/conditions/denials better in these observations, including the allegation denial and conditional repair, but the causal and value-scope issues prevent a blanket quality claim. Do not change the default model based on six cases or ignore its resource cost.

## Result and next work

Repository lint, probe syntax and the 48-row evidence verifier pass. Read-only review confirmed the polarity/name/attribution failures and the decision not to adopt; it also identified the 4B causal/value-scope limits. This is evidence-only work: no product source, dependency or built bundle changed, so the previously passing build/full test suite was not rerun.

Keep the current product prompt and default model. Preserve wrong outputs and rejection evidence. Future work must address requested-fact retention, polarity, entity attribution and unsupported causal compression; neither a generic number guard nor an automatic second generation establishes these guarantees. Test rewrite/translation separately. Do not substitute previews or repeated confirmations for content quality.

Reproduce with `WRITING_GPU_MODEL=<configured-model-id> WRITING_EXAMPLES_CASES=docs/evaluations/2026-10-03-summary-focused-cases.json WRITING_EXAMPLES_REPORT=<unique-report-path> node docs/evaluations/probe-gpu-summary-focused.mjs` against the built preview at 5193 and the exclusively owned cached GPU profile. Never launch concurrent probes with that profile. Current saved reports are the first observations; subsequent runs are regressions, not fresh held-out results.

Artifacts: [probe](probe-gpu-summary-focused.mjs), [fixtures](2026-10-03-summary-focused-cases.json), [1.7B](2026-10-03-gpu-summary-focused.json), [4B](2026-10-03-gpu-summary-focused-4b.json), [2B](2026-10-03-gpu-summary-focused-2b.json), [0.8B](2026-10-03-gpu-summary-focused-0_8.json).

The separate [CPU follow-up](2026-10-03-cpu-summary-focused-analysis.md) adds twelve observations on the same fixtures, with current CPU sampling controls. It does not retroactively turn the GPU experiment into an all-engine or controlled cross-engine benchmark.
