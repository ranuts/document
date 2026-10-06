# Gemma 3 1B with full context: completed diagnostic

Decision: do not adopt this runtime configuration or replace the default model. All 21 previously declared seven-language writing cases completed on actual Chromium WebGPU Gemma, using context window 4096, sliding window -1 and attention sink 0 supplied through diagnostic Worker chat options. Prompts, temperature 0, JSON schema, max 512 completion tokens and production guards remained in place. This is known-case single-sample evidence, not general heldout accuracy or an intrinsic assessment of every Gemma deployment.

Twenty outputs reached the length limit and were refused, preserving native source text. Raw outputs often repeated phrases or whitespace. The sole edited result, the English summary, repeated that inspection was pending and incomplete but omitted Rika, quantity, value, proposed date, prerequisite and unauthorized shipping. Its native Undo/Redo was exact. No preview cards, Worker throws or page errors were recorded. Browser context closed; served bundle bytes were unchanged. Native Save and offline cold start were not tested.

The first 15 complete captured Worker inputs match the prior short-window diagnostic except chatOpts: context -1 / sliding 512 became context 4096 / sliding -1, with attention sink 0 retained. Thus disabling the short window did not recover acceptable performance in this integration. This does not prove the architecture's actual attention/memory policy was otherwise identical or that compiled artifacts are compatible with every override; it does not isolate an intrinsic model defect.

Run `python3 docs/evaluations/verify-gemma3-1b-full-context-writing.py` without --partial to require completed status, all 21 cases, exact fixture identity, actual engine/request model and window options, production sampling/schema, selected native source, target-language controls, preserved refusals, native history for the one edit and unchanged bundle. Partial mode only validates the recorded prefix and cannot certify completion. No production feature or default changed during this diagnostic.

Raw SHA-256: `d9427c5f68361693dc4b9a74e9eef34a00412dda98fa4d57b15ea9c7e8c80347`.
