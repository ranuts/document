# Role-separated compact writing prompt experiment

Decision: do not adopt. A writing-specific system prompt with compact source JSON improved several familiar English/Chinese rewrite fixtures, but introduced accepted multilingual failures and a summary regression.

## Intervention and scope

Actual cached default Qwen3-1.7B WebGPU desktop Chromium/Metal, selected-text Word actions. The candidate replaces the generic structured-response system and long user instruction combination with a compact writing-specific system and the unchanged source request JSON. The system explicitly mentions semantic roles, delivered goods versus value, negation, conditions, uncertainty, attribution and removal of conversational expressions for formal style. This changes both message organization and wording; it does not isolate the effect of system placement alone. The delivered-goods wording is informed by earlier inspected failures.

The probe intercepts outgoing Worker requests before forwarding them to the real Worker, records the actual resulting requests and captures raw actual responses. Model, schema, temperature 0, top-p, maximum tokens, thinking switch, validators and native application stay unchanged. No product source/on-disk bundle modifications. Service workers are blocked and isolation headers injected on the existing preview. No physical mobile, memory, Save/reopen, cold offline or model-wide reliability claim.

The regression run contains six already inspected fixtures, 12 actions. The fresh run contains seven newly authored language fixtures plus one conditional summary, 16 actions. All run current first then candidate, once each; no counterbalancing/repetition, so these are exploratory and cannot establish pass rates or speed benchmarks. The fresh fixtures are now inspected tuning/regression evidence, not reusable independent acceptance cases.

## Findings

On the regression cases, current applies 4/6 and candidate 6/6. The candidate removes conversational endings and preserves dates in inventory/attribution rewrites that current rejects. Its English goods-value rewrite retains the goods instead of substituting money. Chinese wording is less explicit about value (“42 EUR 的物资”) but still identifies supplies. However, the candidate summary says “a delivery of 42 EUR” and drops supplies, regressing from the faithful current summary. The inventory rewrite also drops the explicit “only” qualifier.

On the fresh cases, current applies 3/8 and candidate 5/8; these counts measure validator acceptance, not quality.

| Language/task             | Candidate observation                                                                                                                                                                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| English formal rewrite    | Clear faithful sentence removing conversational language.                                                                                                                                                                                                          |
| Chinese formal rewrite    | Retains facts but awkward word order and no final punctuation; current wording is more natural.                                                                                                                                                                    |
| Japanese formal rewrite   | Localized date, rejected by the literal guard.                                                                                                                                                                                                                     |
| Korean formal rewrite     | Same colloquial raw response as current, omits Leon and localizes date; rejected.                                                                                                                                                                                  |
| German formal rewrite     | Accepted malformed grammar, “Die Gesamtanzahl an 23 Pumps wird ... prüfen, wie folgt: Leon”; instruction and agent/action fidelity fail. Current unchanged output is rejected.                                                                                     |
| Spanish formal rewrite    | Original colloquial source returned unchanged; rejected.                                                                                                                                                                                                           |
| Portuguese formal rewrite | Accepted after removing only final punctuation; keeps “Ei” and “tá bom”, failing formal style. Current unchanged source is rejected.                                                                                                                               |
| Conditional summary       | Retains proposed shipment, goods/value/date and lack of inspection/approval, but omits explicit “subject to inspection” dependency. One sentence as requested; current keeps dependency but returns two sentences. Full requirement satisfaction remains unproven. |

Every applied action has exact native Undo/Redo, every rejected action retains exact selected text, and both runs have zero previews/page errors/external requests and unchanged bundle bytes. These mechanical results cannot establish semantic correctness. The literal guards reject changed dates but cannot recognize the accepted German grammar/action failure, Portuguese style failure or goods-value summary substitution.

## Verification and reproduction

`python3 docs/evaluations/verify-gpu-writing-roles.py` checks all 28 rows: actual Worker model, equality of every non-message request field per fixture, identical source/instruction/task, candidate system placement, schema preserved, native history and exact rejection retention. It deliberately does not assert semantic quality.

Use `node docs/evaluations/probe-gpu-writing-roles.mjs` with `WRITING_EXAMPLES_CASES` pointing to `2026-10-03-gpu-model-fidelity-cases.json` or `2026-10-03-gpu-writing-roles-fresh-cases.json` and a unique `WRITING_EXAMPLES_REPORT` path. Existing cached GPU profile and preview at port 5193 are required. Do not run simultaneous processes with that profile.

Probe syntax, formatting and repository lint are checked. Production code is unchanged, so this evidence-only turn does not require a new build/full product test rerun. Broader writing quality remains open; improve rewrite and summary prompts separately, and evaluate cross-language generalization before adopting.
