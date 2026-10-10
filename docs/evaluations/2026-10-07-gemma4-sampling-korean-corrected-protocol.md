# Korean source-readiness correction: freeze before inference

Original 21-task screen is still running. Its three Korean rows have empty native source/selection, no SDK counts or inference requests, no-selection UI errors and driver errors. Preserve that failed evidence; do not count it as model quality or rewrite the original receipt.

The separate native-only readiness probe reproduces an immediate empty paragraph/selection after pluginMethod_InputText. Waiting for exact complete document text succeeds after font requests return 200; reselecting then captures the full source. This identifies an asynchronous input/selection race in diagnostic setup, not a demonstrated product writing failure. The probe made no model call.

Freeze corrected driver before any Korean inference. Select only the three original Korean fixtures, unchanged. Fresh native contexts/models, original product prompts/schema, recommended temperature 1/top_p .95/top_k 64/seed 42/max_tokens 512 and pinned model remain identical. After inserting, wait at most 90 seconds for exact original source plus native CRLF, then select all and require exact source selection before any writing request. No font prefetch, API replacement, capability override, prompt tuning, generated-output substitution or retries.

Do not launch until the original process is confirmed terminal. Run each corrected task once and retain its separate report, close state, failures and source/driver/build hashes. The original three rows executed zero inference, so this is their first valid model call, not a resample after poor generated output. The language sources are correlated with earlier tasks; no independent benchmark claim.

Assess original task rubric and document Undo/Redo separately. Combined coverage requires 18 valid original tasks plus these three corrected tasks, with original failures retained and matching exact configuration/source identities. Never label the original 21-row run fully passing. No model/default/prompt adoption; existing Chinese/Japanese summary failures already reject broad acceptance. Broader factual, latency, injection, device/editor/offline requirements remain active.
