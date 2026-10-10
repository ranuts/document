# Attachment Llama 3.2 3B candidate: no default adoption

The attachment's Llama-3.2-3B-Instruct-q4f16_1-MLC is executed through the actual existing custom-model setting, WebGPU Worker and production writing route. No default/catalog, prompt, guard, product dependency or document workflow changes. Six previously observed summary fixtures run once with current messages; these are regression comparisons, not independent held-out acceptance or a controlled multi-model accuracy ranking.

The installed WebLLM prebuilt configuration includes the exact model ID, 4096-token context override and its compatible v0_2_84 model library. Its 2263.69 MB VRAM estimate is an SDK estimate, not measured device allocation, download size or total RAM. The run's actual engine label and each outgoing Worker request identify Llama 3.2 3B. Temperature remains 0, max_tokens 512 and the existing schema remains enabled. Five results are applied with exact native Undo/Redo; one is refused with source unchanged. No preview cards or page errors appear. Served SDK/plugin instrumentation observes the boundary; original bundle bytes remain unchanged on disk.

The initial load records 123 external static GET requests with zero request-body bytes to Hugging Face/model CDN and the MLC binary library host. This first-network-load run must not be described as zero external requests or cold-offline acceptance. URL requests disclose artifact choices/network metadata; no request bodies containing document text are recorded. Model weight hashes/revision identity are not independently established, and this does not prove every possible content egress path.

## Observed semantics

| Fixture | Actual outcome |
| --- | --- |
| Conditional shipment, English | Retains Mira, proposed shipment, goods/value/date and pending inspection/authorization, omits the separate meeting. It drops the explicit inspection-pass prerequisite: pending inspection is not the same constraint as only if inspection passes. |
| Conditional shipment, Chinese | Omits Mira and the proposal status, retains pending/not-authorized facts and inspection-pass condition, but includes the excluded warehouse meeting and multiple sentences. It changes a separate meeting to the next meeting, adding unsupported temporal order. The bare shipment phrase cannot be treated as full preservation of a proposed action. |
| Payer/recipient | One shorter English sentence retains who receives from whom, amount/date and repair service; omits the logo discussion. |
| Allegation/denial | Retains Tomas as claimant, Noor's denial, no confirmation, count/date; omits cafeteria detail in one English sentence. However, the added pronoun she assigns Noor a gender absent from the source. Relationship retention therefore does not establish full factual fidelity. |
| Conditional repair, Chinese | Raw output changes ISO date to Chinese date formatting, omits Rui and retains excluded lunch content/multiple sentences. The existing numeric/date guard refuses it, leaving native source text unchanged. This is correct refusal of that output, not a successful summary. |
| Cancellation/exception | Keeps canceled motor order, value/date and active pump order, omitting sports detail in one English sentence. |

The payer/recipient and cancellation examples preserve the requested relationships in these observed outputs; they do not cancel the conditional omission, unsupported gender inference or Chinese instruction/identity/temporal failures. Passing native application is not a factual-quality score. A default replacement is not justified by these six fixed-order, one-sample comparisons. No native Save/reopen, arbitrary styling, actual GPU memory/thermal behavior, repeated reliability or physical-device acceptance is measured here. Independent semantic review caught the unsupported pronoun and meeting order before this analysis was committed; neither is silently counted as a successful summary.

Meta's [official model card](https://huggingface.co/meta-llama/Llama-3.2-3B-Instruct) names eight supported languages: English, German, French, Italian, Portuguese, Hindi, Spanish and Thai. Chinese/Japanese/Korean are not in that list. Its broader multilingual training is not an app-specific guarantee for those languages or this MLC quantization. The [MLC conversion repository](https://huggingface.co/mlc-ai/Llama-3.2-3B-Instruct-q4f16_1-MLC) identifies the converted artifact; its existence does not establish quality. The SDK configuration and actual execution are the runtime evidence, rather than an inference from advertised benchmark performance.

## Scope and verification

The reused probe's generic scope string mentions the default model/new fixtures. Those phrases do not describe this run: the explicit modelId is a custom Llama candidate and the six fixture IDs are already-observed cases. Raw data is preserved; this analysis corrects its interpretation rather than rewriting history. No summary-specific candidate prompt runs in this report.

`verify-llama3b-summary-current.py` checks probe identity, actual Worker model, source/instruction/schema/controls, static request-body absence, five native applications and the unchanged refusal. It does not automate semantic judgment, compare Llama/Qwen accuracy or independently verify weights. Syntax, scoped evidence verifier and lint pass. This evidence-only turn does not repeat product builds/full unit tests.

Reproduce with a unique report path using `WRITING_GPU_MODEL=Llama-3.2-3B-Instruct-q4f16_1-MLC WRITING_EXAMPLES_VARIANTS=current WRITING_EXAMPLES_CASES=docs/evaluations/2026-10-03-summary-focused-cases.json WRITING_EXAMPLES_REPORT=<unique-path> node docs/evaluations/probe-gpu-summary-focused.mjs`. The owned GPU profile must be exclusive; the first load's downloads may differ from cached repetitions. Future evaluation must include fresh predeclared cases and the requested languages before choosing a replacement; the overall semantic quality gate remains open.
