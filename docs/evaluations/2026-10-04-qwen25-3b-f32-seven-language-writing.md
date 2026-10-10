# Qwen2.5 3B q4f32 current writing contrast

The q4f32 catalog variant does not resolve malformed-date generation and is not adopted. All 21 actual tasks complete: 17 refused, four applied. Native execution counts do not establish correctness.

Driver/verifier preregistered in `3a37509` before inference. Same previously evaluated 21 seven-language rewrite/summary/translation fixtures, current production prompts/guards, temperature 0, top_p 0.8, max_tokens 512, schema and no Qwen3 extra_body. The verifier checks all 21 request bodies exactly equal the prior q4f16 run on the same bundle. Model id/weights repository/compiled library change to Qwen2.5-3B-Instruct-q4f32_1-MLC. Thus this is a catalog-variant comparison, not an isolation of arithmetic precision alone. One fixed-order sample; no general accuracy claim.

## Actual findings

Four summaries still corrupt the date: Chinese “2044-09-erves”, Japanese “2044-09-erves” plus later repeated correct date, Spanish “2044-09-思路缺失-23”, Portuguese “2044-09-ferences”. These are generated text, not altered current input or editor output. q4f16 had malformed dates in six summaries; q4f32 differs but does not eliminate the failure. This observation cannot isolate training, tokenization, model assets, compiled kernels or GPU cause.

Four native edits: English summary preserves basic facts but returns two sentences instead of one; Korean summary also returns two sentences and phrases 430 PLN as “430 PLN에” rather than explicitly retaining filter valuation; German summary retains quantities/status but introduces causal/interpretive linking; Spanish rewrite retains colloquial “Oye”/“¿vale?” and switches the grammatical address to Neri. None establishes general quality acceptance. Other outputs still change date format/numeric spelling, names/currency, omit source roles or switch language. For example Chinese translation omits Teo as alleged actor, Japanese rewrite says dollars instead of EUR, Korean rewrite drops date. Literal guards retain source on refusals.

## Verification and limits

`python3 docs/evaluations/verify-qwen25-3b-f32-seven-language-writing.py` passes: all actual current-source task controls/model/settings, bundle/driver hashes, exact request-body identity with q4f16, no previews, source preserved on refusal and exact native Undo/Redo on applied outputs. No harness errors, bundles unchanged during inference. Model asset requests occur during initial loading; no offline/privacy certification follows. Native Save, CPU/mobile and broader quality are outside scope. The current-build counts cannot be used as a global ranking against historical runs with other guards.

The separate schema-removal screen tests whether grammar constraints are necessary for the malformed-date behavior. Neither production model nor prompt/guards are changed. No push/merge/deploy.
