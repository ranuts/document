# Qwen2.5 1.5B: current production writing baseline

Do not adopt Qwen2.5-1.5B-Instruct-q4f16_1-MLC as default on this evidence. It loads and completes all 21 browser tasks, but most outputs violate literal preservation and the remaining native edits do not establish faithful writing quality.

Driver/verifier preregistered in `41fbeed` before execution. Installed WebLLM 0.2.85 catalog candidate, same already-seen 21 fixtures covering rewrite/summarize/translate for zh-CN/en/ja/ko/de/es/pt. One fixed-order sample each; not fresh heldout or general accuracy. Actual current production writing prompts/schema/guards, temperature 0, top_p 0.8, max_tokens 512; Qwen3-specific thinking controls are absent for this model. No prompt replacement/few-shot examples. Route-local served plugin instrumentation only records raw outputs/Worker requests and holds temperature at its existing value. No substituted generated output/editor result. The model is selected as a custom SDK catalog id in the diagnostic browser profile; production defaults remain unchanged.

## Manual findings

17 refusals and four native edits are execution outcomes, not scores. Numerous outputs replace ISO dates with prose dates, translate numeric 9 into nine, change personal-name spelling or change currency; guards preserve source on refusal. Chinese/Japanese/Spanish/Portuguese summaries switch to English (Korean summary to Chinese) while also changing date literals. Portuguese rewrite replaces 230 EUR with R$230 and is refused. Japanese translation changes names/relationships and includes broken mixed-language wording; German translation changes replaced sensors into thawed sensors and is also refused for date change.

Applied outcomes still fail requested quality:

- English summary retains the parking meeting excluded by the instruction and uses redundant/unclear unauthorized-shipping language.
- Korean rewrite leaves informal “낼 거야” and changes filler without achieving the requested formal style.
- German summary turns source quantity “11 filters” into “um 11 Uhr” (11 o’clock), keeps the literal 11, and retains the excluded parking meeting. Numeric multiset preservation does not prove what numbers mean.
- Portuguese translation changes allegation attribution wording and omits the source investigation relationship (“não houve confirmação de tal fato” is broader than no investigation has confirmed it). Native application does not establish translation fidelity.

Review is manual and limited to captured outputs. Historical English/German source already contains repayment wording, so the review does not classify repayment vocabulary alone as unsupported.

## Verification and limits

`python3 docs/evaluations/verify-qwen25-15b-seven-language-writing.py` passes: 21 actual Worker requests, exact source/instruction/task/translation targets, seven-language/three-task coverage, real model/engine, temperature/top_p/schema/token cap and absent extra_body, driver/current bundle hashes, no preview cards, source retained on refusal, exact native Undo/Redo for applied results. Report completed without harness errors; bundles byte-identical during the run. Initial model downloads are recorded external asset requests; this is not an offline/privacy certification.

Current-build guards include the new conservative rewrite script-switch rejection; historical model runs used earlier code, so counts are not a controlled ranking. Warm inference after initial model loading, native Save, CPU/mobile memory, cold offline/PWA and broader semantic/style instruction compliance remain unverified. No push/merge/deploy or default change.
