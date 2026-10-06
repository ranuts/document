# Frozen demonstrations: Japanese/Korean/German/Portuguese transfer

The candidate must not be promoted globally. Frozen English/Chinese/Spanish/French demonstrations improve the two German fixtures but fail Japanese and Korean transfer and leave informal Portuguese wording. Earlier four-language improvements are insufficient for a multilingual production change.

## Provenance and controls

Candidate demonstrations unchanged since `bc46afe`. Eight new paired Japanese/Korean/German/Portuguese sources, driver and verifier preregistered in `1268221` before inference. One fixed-order sample per variant/case, narrow targeted transfer screen rather than general/random language accuracy. Both variants receive the same current source and instruction, body-only user JSON and minimal formal-rewrite system prompt. Examples adds the same frozen four user/assistant pairs used in previous screens; none is in these four target languages.

Actual Qwen3-1.7B-q4f16_1-MLC local WebGPU Worker requests and native Word IM rewrite route. Temperature 0, top_p 0.8, 512 output tokens, thinking disabled, identical flat schema/production guards. Diagnostic browser route transforms requests and records actual outputs; model outputs/editor API results are not substituted. Bundles remain unchanged.

## Manual review of captured output

| Cases | Baseline | Frozen examples |
| --- | --- | --- |
| Japanese authorized/pending | Retains Haruka/Ren, approval and unexecuted refund; formal text | Outputs French and substitutes Léa/Marc plus demonstration date 2027-02-19; refused by date guard |
| Japanese unapproved/pending | Retains basic roles/status but remains informal | Outputs French, omits date and uses unclear approval wording; refused by date guard |
| Korean confirmation required | Omits sender Jisoo; malformed subject, informal tag; applies | Omits sender Jisoo, adds “둘째로” (secondly) and malformed subject; applies |
| Korean confirmation unnecessary | Omits Jisoo and changes statement into request to confirm whether Sora can send to Minho; applies | Omits current date/participants and emits unrelated wording; refused by number/date guard |
| German condition required / not required | Both change permission “darf” to obligation “muss” and retain casual tag; applies | Both retain “darf”, respective condition and unpaid status, remove filler/tag; applies |
| Portuguese proposed/not accepted | Retains proposal/status but keeps “Olha”; applies | Identical text, still “Olha”; applies |
| Portuguese sent/no confirmation | Unchanged; refused | Removes tail tag but keeps “Olha”, retains shipment/confirmation status; applies |

Baseline applies 7/refuses 1; examples applies 5/refuses 3. Counts describe execution, not accuracy. Earlier promising short/development and English/Chinese/Spanish/French multi-clause screens do not generalize across all supported languages. First Japanese output copies names/date from the last French demonstration; this is observed example contamination, not proof of its internal cause or a universal order effect. All captured current inputs preserve the preregistered sources, so these wrong outputs are not explained by a swapped source in the harness.

## Verification and implications

`python3 docs/evaluations/verify-writing-demonstrations-language-transfer.py` passes: exact driver/current bundle hashes, 16 actual model requests, exact frozen examples/role sequence, fixed system prompt, identical source/instruction and request parameters, only demonstrations differing, no previews, source preserved on refusal, exact native Undo/Redo on applied output. Completed report has no harness errors or recorded external requests.

Numeric/currency guards reject several contaminated outputs but permit sender loss, changed obligation and altered confirmation roles when literals still match. Their protective scope must not be represented as semantic validation. Do not compensate with fixture-specific names or role regexes, or loosen guards to improve application counts. Existing production configuration remains unchanged; this diagnostic did not evaluate the production prompt against the candidate.

A next diagnostic may separate target-language exemplars from cross-language examples, with new unused validation sources and fixed controls. Any candidate still requires broader instruction/style tests, summarize/translate, CPU/mobile and cold offline/PWA validation. This warm desktop screen does not certify those requirements or native Save/privacy behavior.
