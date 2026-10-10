# Model-recommended sampling: narrow positive result, no adoption

The [frozen protocol](2026-10-07-gemma4-sampling-protocol.md) and [driver](2026-10-07-gemma4-sampling-native.mjs) were committed in 63d14d1 before inference. Both use the same already-observed prototype-delivery source, original product messages, JSON schema, pinned model and output limit. Both add seed 42. The recommended variant changes only temperature/top_p/top_k to 1/.95/64, as recommended by the [official Gemma 4 model card](https://ai.google.dev/gemma/docs/core/model_card_4). This is a joint sampling configuration comparison, not isolated temperature causality, independent native sampler certification or reproducibility evidence.

Product output: `宋远建议周五交付样机但未获批准，采购零件需韩岚确认预算，目前采购条件未满足，周五交付并非确定承诺。`

Recommended output: `宋远建议周五交付样机未获批准；采购零件需韩岚确认预算，目前预算仍待确认，采购条件未满足，周五交付并非确定承诺。`

The product output repeats the prior omission: generic unmet procurement conditions substitute for explicitly pending budget confirmation. Recommended output keeps the proposer, suggested Friday prototype delivery, unapproved proposal, Han Lan confirming the budget before procurement, explicitly pending budget, unmet procurement condition and non-guaranteed commitment. It is one shorter Chinese sentence with no observed new claim. This passes this source's stated rubric. One observed development source and one sample per configuration cannot establish general quality or a default choice.

[Raw receipts](2026-10-07-gemma4-sampling-native.json) record 127.476/128.543 seconds excluding model setup, no previews/page/chat errors, exact output-to-document application and native Undo/Redo, both contexts and browser closed, process exit 0. Existing default-model routes and prompts were not changed. This higher-resource 2.84-GB imported model is not accepted as the mobile CPU availability fallback; observed latency also remains a usability concern.

[Bindings](2026-10-07-gemma4-sampling-bindings.json) record source/receipt hashes and an initial asset snapshot taken after process launch during setup, with all those bytes matching after the run. This is not prelaunch asset certification. `python3 docs/evaluations/verify-gemma4-sampling.py` checks exact request contrast, count/completion parity, raw native application and history. It does not grade semantics or prove sampler implementation.

No production adoption. Next gate is this frozen configuration, without prompt tuning, on other previously unused seven-language rewrite/translate/summary sources preserving actors, negatives, permissions, dates/units and requested structure. Full lifecycle/device/offline acceptance remains required independently. A narrow improvement neither replaces the full objective nor changes historical failures.
