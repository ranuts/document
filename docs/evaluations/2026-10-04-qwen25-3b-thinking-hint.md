# Qwen2.5 3B q4f32: system thinking-hint diagnostic

Removing the JSON path’s /no_think suffix does not resolve malformed dates. No production change follows. This tests one prompt factor, not model/asset integrity or complete runtime provenance.

## Source investigation and controls

Current `webllm.ts` normally appends the soft hint only for Qwen3 chat-only prompts, but generateJSON overrides messages with a generic system instruction ending in /no_think for every model. This is a conditioning inconsistency worth investigating, not proof the hint causes corruption or that a model recognizes a command. `parseOpenAIResponse` forwards completion message.content directly as response.text; its source does not replace date fragments. The raw-writing hook records provider output before writing validation/native edits.

Driver/verifier preregistered in `ea11492` before execution. Seven previously observed summary development fixtures, one fixed-order sample for hint/plain. Same Qwen2.5-3B-Instruct-q4f32_1-MLC, current product user messages, schema, temperature 0, top_p 0.8, 512 output tokens, guards and bundle. Plain removes exactly the system suffix “ /no_think”; hint retains it. No other prompt or request field changes. Actual local WebGPU Worker/native Word IM summary route with route-local request mutation/raw recording; generated output/editor results are not substituted.

## Observed output review

| Language | Hint | Plain |
| --- | --- | --- |
| Chinese | Malformed 2044-09-erves; refused | Identical; refused |
| English | Correct date, two-sentence summary applies | Malformed 2044-09-ferences; refused |
| Japanese | Malformed 2044-09-erves plus repeated correct date; refused | Malformed 2044-09-思路23; refused |
| Korean | Two-sentence summary applies | Identical; applies |
| German | Applied summary with interpretive/causal linking | Different causal wording; applies |
| Spanish | Malformed 2044-09-思路缺失-23; refused | Identical; refused |
| Portuguese | Malformed 2044-09-ferences; refused | Malformed 2044-09-思路略- and switches tail into Chinese; refused |

Hint applies three/refuses four; plain applies two/refuses five. These are execution counts, not accuracy. All seven engine-reported prompt token counts decrease by four in plain, corroborating that the changed request affected prefill input. Three pairs have identical raw text; other outputs change but corruption persists or worsens. Therefore hint removal is not a sufficient repair, and the contrast does not establish that the hint has no effects generally.

## Verification and remaining investigation

`python3 docs/evaluations/verify-qwen25-3b-thinking-hint.py` verifies all 14 actual requests, exact source/instruction/task, model/settings/schema, only suffix differing, engine prompt-count delta, bundle/driver hashes, no previews, preserved source on refusal and exact native Undo/Redo on applied outputs. Completed report has no harness errors; bundles remain unchanged. No offline/privacy, CPU/mobile, native Save or general quality certification follows.

The experiment does not inspect cached tokenizer/model shard bytes or capture pre-provider token ids; those remain useful next provenance checks. Do not infer a training/GPU/compiler root cause or edit production prompts based solely on the observed conditioning inconsistency. Defaults remain unchanged, and malformed-output refusals remain protective behavior rather than task completion.
