# Consistent summary request: native CPU result

Four fresh-case native Word IM summaries completed using CPU Qwen2.5 3B. Candidate frozen at eb5708e, cases at f00789a and driver at 9f49d2f preceded inference. Original task JSON is byte-identical in each consistent request. Actual recorded final count messages equal completion messages for every row. This proves message parity, not numerical tokenizer accuracy. Raw model outputs and native exact Undo/Redo are retained; no previews or recorded page errors. The browser closed in finally, process exited 0 and built bundle bytes were unchanged.

| Language | Relations baseline | Consistent candidate |
| --- | --- | --- |
| English | One sentence preserves condition and current negatives, but “Harriet proposed hanging” leaves the proposed acting team inferential from the later non-action clause. | Restores explicit exhibition-team proposed action, preserves conservation signing the condition report prerequisite and both current negative states, omits badges. Two sentences: fails frozen form. |
| Chinese | Retains suggestion, execution team, qualifying insulation-record prerequisite and both negative states, omits chairs. Two sentences: fails form. | Retains these actor/condition/current-state relationships but shortens away lighting-system context and uses “new line” instead of newly laid line. Still two sentences: fails form regardless of whether this topic compression is judged material. |

Promotion rejected. The consistent JSON output contract did not produce the required single sentence on either case. Clearer English actor assignment is a local improvement; it does not establish global fidelity or explain the failures causally. This whole-request comparison simultaneously changes length, role placement, task specificity and wording. The competing original output instructions are not proven the root cause.

Response times, baseline/candidate: English 60.690/31.222 s, Chinese 21.849/16.483 s. Fixed order, warmup, altered prompt lengths and one repetition preclude a causal speed claim. The default models, other writing operations, broader seven-language quality, offline/Save/PWA, deployed privacy and physical devices remain unaccepted. No production prompts or defaults changed. Cases are now observed development data.

Run `python3 docs/evaluations/verify-summary-consistent.py` to check frozen bindings, unchanged task data, counted/completed message parity and native history. Semantic judgments remain separate human source/output review, not native-speaker certification or an automated correctness metric.
