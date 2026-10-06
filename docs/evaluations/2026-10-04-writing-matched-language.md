# Language-matched demonstration development screen

All eight observed matched-example outputs improve or retain formal factual rewriting on this small development screen. This is a candidate result, not production acceptance, automatic language identification or general multilingual accuracy.

## Provenance and controls

Driver, matched examples and verifier preregistered in `3a5a7f8` before inference. Same eight previously evaluated Japanese/Korean/German/Portuguese sources are development data. `cross` adds the original four English/Chinese/Spanish/French examples; `matched` adds four authored examples in the preregistered fixture language. Counts and paired user/assistant layout match. Current source/instruction, minimal system prompt, body-only final JSON, model Qwen3-1.7B-q4f16_1-MLC, temperature 0, top_p 0.8, max_tokens 512, thinking disabled, flat schema and current production guards stay fixed.

The driver chooses example language from the case id. This is oracle fixture metadata, not product source-language detection. Examples address previously observed failures; test sources/names/dates are not inserted into examples. Names, amounts and dates broadly parallel the earlier demonstration facts, but local instructions/phrasing differ, and Japanese/Korean third examples use payment wording where the Spanish example releases funds. Thus this compares authored demonstration sets, not a causal isolation of language alone or exact translated-token equivalence. Earlier commentary about preserving example facts should be understood with this distinction.

Actual local Worker inference/native Word IM rewrite route, diagnostic route-local request transformation/raw recording, no substituted generated output/editor results. Bundle files unchanged during inference.

## Manual review of captured text

| Cases | Cross-language set | Same-language set |
| --- | --- | --- |
| Japanese authorized/pending | French with copied example names/date; refused | Japanese, Haruka authorizer/Ren recipient, approval completed and refund not executed; formal text |
| Japanese unapproved/pending | French and missing current date; refused | Japanese, approval absent and refund unexecuted; formal text |
| Korean confirmation required | Sender Jisoo omitted; malformed subject/unsupported “secondly”; applies | Jisoo sending to Minho only after Sora confirms; formal text |
| Korean confirmation unnecessary | Missing date/roles; refused | Jisoo may send to Minho without Sora confirming; formal text |
| German required / unnecessary signature | Faithful formal text | Identical faithful text, permission remains darf |
| Portuguese proposed/not accepted | Keeps “Olha” | Removes filler, preserves past propôs and absent acceptance |
| Portuguese sent/no confirmation | Keeps “Olha” | Removes filler, preserves completed shipment/absent confirmation |

Cross applies five/refuses three; matched applies eight/refuses zero. Counts describe execution, not accuracy. Manual review found no concrete role/modal/negation/status loss in these eight matched outputs; this targeted development observation is not universal semantic proof. It must be tested on unused sources before considering product adoption. A product candidate also needs reliable language routing, mixed-language/style/instruction handling and bounded context cost.

## Verification and next gate

`python3 docs/evaluations/verify-writing-matched-language.py` passes all 16 actual requests: exact driver/current bundle hashes, correct original or language-specific example objects/order, fixed system prompt and all other request parameters, exact final source/instruction identity, no previews, source preserved on refusal and exact native Undo/Redo for applied output. A temporary report substituting cross-language examples into matched messages is rejected. Completed report has no harness errors or recorded external requests.

Freeze these example sets before new unused multi-clause/role/condition fixtures. Do not retune on subsequent outputs and continue labeling them heldout. These diagnostic prompts always request formal rewrite; other styles, summarize/translate, CPU/mobile, native Save and cold offline/PWA/privacy certification remain outside scope. No production prompt/model/input or language-routing change is adopted.
