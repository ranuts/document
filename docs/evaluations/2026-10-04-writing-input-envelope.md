# Writing input envelope development contrast

A smaller task envelope changes observed semantic behavior, but does not establish acceptable formal rewriting. No product prompt, model or input format is changed.

## Question and controls

Does repeating task/targetLanguage in user JSON encourage copying or interfere with style transformation? Driver preregistered in `d672258`, before execution. Eight previously evaluated English/Chinese/Spanish/French development fixtures, one fixed-order sample each for `full` and `body`; no heldout/general accuracy claim. `full` retains task, targetLanguage, text, instruction; `body` retains only identical text and instruction. The same minimal system prompt already specifies formal rewriting in the original language. Identical schema, temperature 0, top_p 0.8, max_tokens 512, thinking disabled and Qwen3-1.7B-q4f16_1-MLC. Actual local WebGPU Worker requests through the native Word IM rewrite route, with route-local request transformation and raw recording; no generated output/editor result replacement. Bundles remain byte-identical.

## Manual review

| Cases | Full envelope | Body envelope |
| --- | --- | --- |
| Nora pays Ethan | Omits Ethan, adds “as stated”; applies | Unchanged original; refused |
| Ethan pays Nora | Formal faithful text; applies | Identical output; applies |
| Chinese authorized | Formal text preserving subject/status; applies | Identical output; applies |
| Chinese not authorized | Preserves authorizer and pending authorization; applies | Same role/status, “在” instead of “于”; applies |
| Spanish prerequisite / without prerequisite | Strengthens can to will; second retains casual tag | Retains can and respective condition; both retain casual tag; applies |
| French proposed shipment | Unchanged; refused | Identical unchanged output; refused |
| French completed shipment | Adds unsupported planning claim and retains “Bon”; applies | Replaces planning claim with “comme indiqué” and retains “Bon”; applies |

Full applies 7/refuses 1; body applies 6/refuses 2. Execution counts are not quality metrics. Smaller input fixes the observed Spanish modal strengthening on these cases, without the extra preservation prefix of the earlier roles experiment. French removes the planning claim but still adds unnecessary source-reference commentary and does not fully remove casual style. Nora's English case returns unchanged rather than doing a faithful rewrite. This supports sensitivity to input framing; it does not isolate why any individual generation changes, prove task-field copying is the cause, or justify a production switch.

## Verified evidence and next work

`python3 docs/evaluations/verify-writing-input-envelope.py` passes: 16 recorded actual requests, exact driver/current bundle hashes, identical model/sampling/schema/system messages, exact text/instruction identity, correct full/body key sets, all other request parameters identical, source retained on refusal, no previews, exact native Undo/Redo after every applied output. A temporary report that replaces body JSON with full JSON is rejected. Completed report has no harness errors or recorded external requests.

These are warm desktop GPU diagnostics, not offline/privacy, native Save, CPU/mobile, broader language or general quality certification. Any candidate improvement needs fresh role/condition cases and production-prompt/broader-language validation. Do not infer that deleting task metadata solves factual rewriting across operations; summarize/translate were not tested here.
