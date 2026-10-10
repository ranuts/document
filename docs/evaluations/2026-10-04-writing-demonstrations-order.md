# Fixed demonstration pair order development contrast

Reversing the same four example pairs changes output language but does not solve multilingual rewriting. More applied outputs include wrong-language and role-changing text. No candidate prompt is promoted.

Driver/verifier preregistered in `b8bb0da`. Same eight previously evaluated Japanese/Korean/German/Portuguese fixtures now used as development data; one fixed-order sample per variant. `forward` uses English, Chinese, Spanish, French; `reverse` uses French, Spanish, Chinese, English. User/assistant order within each pair remains intact. Identical example contents, minimal system prompt, current body-only source/instruction, schema, temperature 0, top_p 0.8, max_tokens 512, thinking disabled and Qwen3-1.7B-q4f16_1-MLC. Actual local WebGPU/native Word IM requests, route-local request instrumentation, native Undo/Redo; no substituted outputs/editor results and bundle files unchanged.

## Observations

| Cases | Forward | Reverse |
| --- | --- | --- |
| Japanese approved/pending | French, copied Léa/Marc and example date; refused | English, current names/date preserved; applies despite wrong source language |
| Japanese unapproved/pending | French, missing date; refused | Spanish, current names/date retained; applies despite wrong source language |
| Korean signature required | Korean malformed subject, sender Jisoo omitted and “secondly” added; applies | English, changes actor/confirmation relationship and may to will; applies |
| Korean signature unnecessary | Omits date/roles; refused | Korean sender Jisoo omitted and no-confirmation clause lost; applies |
| German required / without signature | Preserves permission and corresponding condition | Identical text |
| Portuguese proposed/not accepted | Keeps informal “Olha”, past proposal | Removes “Olha” but changes past proposed to present proposes |
| Portuguese sent/no confirmation | Keeps informal “Olha” | Removes “Olha”, retains completed sending and absent confirmation |

Forward applies five/refuses three; reverse applies eight/refuses zero. Execution counts are not quality. First Japanese output becomes English when English is the final pair, consistent with order sensitivity; the second becomes Spanish, so final-example language alone is not a complete explanation. This controlled screen cannot identify internal model causes or generalize order effects. Existing numeric/date/currency guards cannot reject wrong-language rewrites when all literals still match.

`python3 docs/evaluations/verify-writing-demonstrations-order.py` passes all 16 actual requests, exact pair contents/order, identical source/instruction/system/settings, driver/current-bundle hashes, no previews, preserved source on refusal and exact native Undo/Redo for applied outputs. No harness errors or recorded external requests. This is warm desktop GPU evidence; Save, CPU/mobile, offline/privacy and other writing operations remain outside scope.

Next product fix: conservatively reject complete Latin/CJK writing-system switches during rewrite. This is a narrow protective guard, not language identification, successful rewriting, role validation or a substitute for improving generation. Candidate defaults remain unchanged.
