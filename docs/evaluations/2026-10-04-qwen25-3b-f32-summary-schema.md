# Qwen2.5 3B q4f32: schema-removal date diagnostic

Removing response_format does not fix the captured malformed-date outputs. Seven paired generated texts/stop reasons are exactly identical, including four corrupted date fragments. Keep schema and production configuration unchanged.

Driver preregistered in `62806fb`. Seven already-observed summary fixtures from zh-CN/en/ja/ko/de/es/pt; one fixed-order sample per schema/free variant. Same q4f32 model, bundle, original production messages, sampling, token limit and all editor guards. Only free requests delete response_format; no new system prompt or examples. Actual local Worker inference/native Word IM summary route, served-plugin raw recording and request instrumentation, no generated-output/editor-result substitution. This is a diagnostic development screen, not a new heldout accuracy test.

Raw report scope retains inherited q4f16/q4f32 comparison wording from the parent driver. The actual recorded variants and verified requests compare schema versus no response_format on **the same q4f32 model**; this report does not run q4f16.

| Summary languages | Both variants |
| --- | --- |
| Chinese/Japanese | Generated date fragment “2044-09-erves”; refused |
| Spanish | Generated “2044-09-思路缺失-23”; refused |
| Portuguese | Generated “2044-09-ferences”; refused |
| English/Korean/German | Same applied texts as q4f32 baseline; requested quality limits remain |

Each variant applies three/refuses four. Counts are execution, not scores. Exact paired text equality establishes that these specific failures occur without schema; it rejects schema removal as a sufficient repair and does not prove all grammar behavior is harmless. No claim about internal model/runtime cause follows.

`python3 docs/evaluations/verify-qwen25-3b-f32-summary-schema.py` passes all 14 actual requests, correct seven-source inputs/tasks, model/settings/current bundle/driver hashes, only response_format differing, exact paired raw text/stop reason, no previews, preserved source on refusal, exact native Undo/Redo on native edits. Report has no harness errors and bundle files remain unchanged. This warm desktop diagnostic does not certify CPU/mobile, native Save, cold offline/PWA or privacy.

Next investigation should examine tokenizer/model-asset provenance and simpler date-copy controls or an independent backend. Avoid attributing the corruption solely to float16 precision or JSON-schema decoding based on these contrasts, and do not weaken guards or adopt this variant.
