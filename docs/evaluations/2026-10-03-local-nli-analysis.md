# Independent local NLI: runtime works, adoption rejected

Neither tested NLI path is adopted as a document-edit safety gate. The pinned q8 artifact/runtime rejects every hypothesis, including source-supported controls. The same revision's fp32 path passes identity controls but confidently accepts four unsupported changes and refuses three source-supported hypotheses. Confidence is not a factual guarantee, and source entailment is not full summary quality.

## Fixed experiment

This is a separate local browser experiment, not the product IM. Transformers.js 3.8.1 runs an ONNX multilingual MiniLM NLI model in a Dedicated Worker, on isolated desktop Chromium. The local server serves self-only script/connect policy with wasm-unsafe-eval and self/blob workers; there is no unsafe-eval. The corpus contains seven languages' simple positive/polarity controls, archived actual generation errors and source-supported hypotheses, plus payer/proposal/condition minimal pairs. It was declared before classifier observations. The decision remains top label entailment and entailment probability at least 0.8; neither threshold nor labels were fitted afterward.

Model: onnx-community/multilingual-MiniLMv2-L6-mnli-xnli-ONNX, revision `ca5daf3d11b6c4b3143b1f4602a2edfb64c3ad7e`. [Asset manifest](2026-10-03-local-nli-model-assets.json) pins URLs, sizes and SHA256. Inference consumes local files; model acquisition used the remote Hub beforehand. Browser requests are recorded as local GETs without request bodies, and remote routes are aborted. This does not prove every product content exit is closed.

Model labels are read from config: 0 entailment, 1 neutral, 2 contradiction. The original author config agrees. Decoded input shows premise first, paired hypothesis second and expected XLM-R separators. No input exceeds 512 tokens, and truncation is disabled. The SDK receives no expected-support labels. Four complete reports match the current probe hash. configuredThreads=4 and three SDK subworker creations are observed; this is not an independently measured native thread count.

## Evidence, not quality certification

| Path / dataset              | Source-supported hypotheses retained | Unsupported hypotheses accepted |
| --------------------------- | ------------------------------------ | ------------------------------- |
| q8 / 28 cases               | 0 of 13                              | 0 of 15                         |
| fp32 / 28 cases             | 10 of 13                             | 4 of 15                         |
| q8 / identity calibration   | 0 of 2                               | 0 of 2 unsupported controls     |
| fp32 / identity calibration | 2 of 2                               | 0 of 2 unsupported controls     |

The 13 source-supported hypotheses are **not 13 correct summaries**. One intentionally drops the required accuser Tomas: it is consistent with the source but violates the original instruction. Its fp32 acceptance illustrates a coverage gap, not a quality success. Sentence count, requested omission, requested-fact retention and language style need separate assessment. The unrelated calibration sentence is classified contradiction rather than neutral by both paths; its binary rejection must not be described as correct three-way NLI classification.

Four fp32 false acceptances under the unchanged rule:

| Unsupported change                                                                       | Entailment probability |
| ---------------------------------------------------------------------------------------- | ---------------------- |
| Rui becomes 刘 in the actual 2B Chinese output                                           | 0.9914                 |
| Cargo value becomes `运至 480 NOK`, with changed date-event binding in actual CPU output | 0.9885                 |
| A proposed shipment becomes a definite future shipment                                   | 0.8478                 |
| Repair only if parts arrive becomes repair regardless of parts arriving                  | 0.8445                 |

The value/destination example contains multiple relationship errors; this experiment does not isolate which sub-error a classifier detects. The unsupported-causality case (`due to` pending inspection) scores 0.7496 and is rejected by the threshold even though its top label is entailment. Its annotation means the cause is not explicitly supported, not that the opposite cause is proven.

q8 fails both identity controls. fp32 gives entailment 0.9916 / 0.9868 to those same controls and contradiction 0.9934 to direct negation. This implicates the **tested q8 artifact/quantized execution path** after input/label calibration; it does not identify whether the export, quantization scheme or runtime kernels caused the degradation. It does not imply all q8 NLI models fail. No post-hoc label permutation or threshold lowering was used to manufacture success.

## Resources and limits

The q8 weights are 107,415,176 bytes; fp32 weights are 428,150,190 bytes. The tokenizer adds 17,082,832 bytes, excluding SDK/WASM. Observed local model initialization is approximately 1.1 seconds for q8 and 2.5–2.7 seconds for fp32, after artifacts are already on local disk. This is not initial network download time, a repeated performance benchmark or process-cold offline acceptance. Peak RAM, concurrent generative-model memory and physical-device behavior were not measured. The semantic failures already prevent adoption; weight size alone does not establish browser resource suitability.

[SummaC](https://arxiv.org/abs/2111.09525) motivates sentence-level NLI aggregation because document/sentence granularity affects consistency detection. We tested short complete premise/hypothesis pairs here, not the SummaC aggregation algorithm or its benchmark. [Task-taxonomy research](https://arxiv.org/abs/2402.12821) studies explicit factual-error categories; it motivates further targeted experiments but does not establish that this lightweight checker or our existing generators meet the requirement. Do not replace the general writing goal with blanket refusal, extractive-only output or confirmation cards to avoid these failures.

## Harness diagnostics and reproduction

The first SDK entry used transformers.web.js, which expects a bundler to resolve bare onnxruntime-common imports. That zero-row [diagnostic](2026-10-03-local-nli-sdk-entry-diagnostic.json) is a harness failure. The standalone transformers.js entry resolves this. A later diagnostic passed BigInt token data directly to decode; it failed before recording rows and is retained [separately](2026-10-03-local-nli-decode-diagnostic.json). Converting IDs to integer arrays fixes the diagnostic metadata. The [first q8 report](2026-10-03-local-nli-first-q8.json) is preliminary evidence from an earlier probe version; the current q8/full/calibration and fp32/full/calibration reports are the mechanically verified set.

Install the research SDK outside the repository: `npm install --prefix /private/tmp/document-nli-lab --ignore-scripts --no-audit --no-fund @huggingface/transformers@3.8.1`. Run `python3 docs/evaluations/prepare-local-nli.py` to fetch/verify pinned files. Then run `node docs/evaluations/probe-local-nli.mjs`; use `NLI_DTYPE=fp32` and a unique `NLI_REPORT` for fp32, and `NLI_CASES=docs/evaluations/2026-10-03-local-nli-calibration-cases.json` for calibration. Each run starts and closes its own local server and browser. Do not overwrite historical results and call them independent held-out observations.

[Verifier](verify-local-nli.py) checks all 64 final inference rows, model/SDK/probe provenance, exact archive bindings, softmax/rule computation, observed requests, input bounds and failed-diagnostic status. It deliberately prints failures and never labels this a safety pass. No product source, dependency, built artifact, preview/confirmation flow or deployment changed. The overall writing-quality objective remains open.
