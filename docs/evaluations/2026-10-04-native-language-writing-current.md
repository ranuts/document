# Fresh same-language writing inputs

Eight new cases were committed before inference, using Chinese instructions for five Chinese sources and English instructions for three English sources. Actual default Qwen3-1.7B WebGPU, current production writing prompts/guards, temperature 0, JSON schema, thinking disabled and 512-token limit. This is a fresh input diagnostic after earlier experiments, not blind independent review or a causal comparison against translated instructions. No model/prompt changes.

| Case | Actual output assessment |
| --- | --- |
| Chinese approval granted | Formal Chinese preserves approval, future payment direction and repair service, but changes CNY to Chinese currency wording; existing literal currency guard refuses it. |
| Chinese approval absent | Chinese preserves absence of approval and payment direction, but drops date and changes CNY wording; refused. |
| Chinese inspection not passed | One shorter Chinese sentence retains proposer, proposal/date/count/value, pass prerequisite, current non-pass status and unauthorized shipment; excludes tea meeting. Narrow observed positive. |
| Chinese inspection passed | Chinese keeps prerequisite, completed inspection and unauthorized shipment, but omits explicitly requested date and uses two sentences; applied. |
| Chinese allegation | One shorter Chinese sentence retains claimant, alleged replacement actor/date/count, denial and unconfirmed investigation; excludes menu. Narrow observed positive. |
| English payment | Keeps payment direction and numbers, but retains Hey and fails requested formal register; applied. |
| English approval absent | Keeps lack of approval but changes 3 to three, USD to dollar symbol; refused. |
| English inspection pending | Retains important condition/status/date/count/value and excludes curtains, but uses two sentences despite one-sentence instruction; applied. |

All eight responses completed. Five native edits had exact Undo/Redo; three refusals preserved the original selection; preview count zero and served bundle unchanged. No harness errors. Browser context closed and no Save performed. Application counts are not semantic pass counts. Same-language user instructions show some faithful Chinese results but do not establish the general quality gate or isolate instruction language as the cause. Previously observed failures and native preservation guards remain relevant.

Run `python3 docs/evaluations/verify-native-language-writing-current.py` to check exact fixtures/requests/native mechanics in the raw report. Required facts/style are assessed manually against predeclared rubrics, not inferred from the verifier passing.
