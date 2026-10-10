# Localized summary instructions — 2026-10-04

Localized user instructions improve observed language retention on some known regressions, but do not make Qwen3 1.7B summaries reliable. No product prompt/default/guard change is adopted.

Commit `d36492c` predeclared seven translated summary instructions before inference. Source text, rubrics and driver are unchanged from the prior seven-language cases. Instructions retain the same requested relationships/omissions rather than supplying a reference output. English is an unchanged control. Translation is AI-assisted, not certified semantic equivalence by native speakers. These are known regressions sharing one relation template, one sample per language, not independent task families or generalization evidence.

Actual Word/IM inference used Qwen3-1.7B-q4f16_1-MLC, unchanged temperature 0, 512-token limit, schema and disabled thinking. Captured requests differ from the prior baseline only in the instruction field. The new build contains the intervening refusal-guidance display fix, so bundle hashes differ from the old baseline; request comparisons establish unchanged inference inputs outside that field. Raw report scope is inherited seven-language/three-task boilerplate: this run actually contains seven summaries with localized instructions, not 21 tasks. Preserve raw provenance.

| Language | Observed final response |
|---|---|
| Chinese | Applied in Chinese; requested relationships retained, two sentences instead of one. |
| English | Applied, identical instruction control; passing condition, pending/unapproved states retained, two sentences. |
| Japanese | Applied in Japanese rather than earlier English; passing prerequisite omitted, two sentences, goods-value wording less explicit about collective value. |
| Korean | Refused by length; raw English says Rika shipped rather than proposed, omits date and has two sentences. Original source preserved. |
| German | Applied in German rather than earlier English; retains parking meeting, three sentences and almost the entire source. Length guard accepts even this very small reduction. |
| Spanish | Applied in Spanish rather than earlier English; two sentences, “apenas si” is less precise than the intended strict “solo si” prerequisite. No claim of certified idiomatic style. |
| Portuguese | Applied in Portuguese rather than earlier English; two sentences and “11 filtros de 430 PLN” weakens the explicit collective goods-value relation. |

Six native edits have exact Undo/Redo; one refusal preserves selected source. All seven normal stop reasons, zero previews, no page errors, unchanged product bundle bytes within the run. No external HTTP requests observed in the warmed profile. No forced offline, cold launch, Save/reopen, Excel/PPT generation, physical devices or measured memory acceptance. Browser context closed and owned process exited 0. Median response 2597ms is a single warmed fixed-order observation, not a causal performance comparison.

Independent final-text review confirmed the important defects above, including Japanese/Portuguese possible per-item value readings and the ambiguous Spanish prerequisite. All seven final responses exceed one sentence.

The verifier binds cases/driver/model, native edit/refusal mechanics, all request differences and the unchanged English control. It does not establish semantic correctness. Native instruction language is a useful next experimental variable for rewrite/translation and fresh families, not a reason to silently translate user requests or impose a detected output language in product. Preserve the compact direct-edit/native Undo/Save workflow while improving actual task fidelity.
