# Qwen3.5 0.8B Word replacement reliability

Evidence: [production IM matrix](2026-10-03-word-im-replacement-qwen35-08-matrix.json).

The production bundle `editor-C2N-hO8C.js` was exercised in an isolated Chromium profile with WebGPU and Qwen3.5-0.8B-q4f16_1-MLC. Each case started a fresh IM conversation on the same page and selected `Alpha` in a two-paragraph Word document. There was no pre-existing redo branch. These are four controlled cases, not a statistical reliability estimate.

| Case | Result | Duration | Document checks |
| --- | --- | --- | --- |
| Long Chinese literal replacement, first attempt | No accepted executable operation | 1487 ms | Entire document unchanged |
| Identical long request, second attempt | No accepted executable operation | 930 ms | Entire document unchanged |
| Chinese literal replacement with `Alex` | Applied | 1119 ms | Exact text, outside text preserved, native Undo/Redo exact |
| English literal replacement with `Alex` | Applied | 1133 ms | Exact text, outside text preserved, native Undo/Redo exact |

The long payload was `项目付款 / Payment · Alex · 1,250 EUR · 2026-10-08 · NOT approved`. Both failures displayed “No executable operation was selected.” There were no captured page errors or diagnostics, and no preview cards in any case. The report's `outsideTextPreserved: false` on unsuccessful cases means the successful-replacement assertion was not satisfied; `documentUnchanged: true` establishes that these failures did not modify the document.

This reproduces the longer-request failure without the earlier cancellation experiment's prior redo history. It does not establish a payload-length threshold, prove all long requests fail, or isolate the underlying model response: raw planner output was not captured. Earlier successful multiline replacement evidence remains valid for those individual cases.

## Current implementation and next investigation

`lib/agent-plugin/document-tool-plan.ts` recognizes these affirmative literal commands, pins `replace_selection` input to the exact supplied text, and rejects any returned change to that text. It still permits an `unsupported` operation. The observed UI outcome is consistent with that path, but direct raw-output evidence is needed before assigning the failure to a particular emitted response.

The next diagnostic should capture the planner response in an isolated harness and compare identical requests while varying only the payload. Any prompt or schema experiment should preserve the current negative-prefix controls, editor/selection validation, exact literal data, and native cancellation/history behavior. A deterministic command route would be a separate product improvement, not evidence of better model capability. No planner behavior or model fallback was changed by this evaluation.

## Follow-up: raw output and isolated prompt experiment

[Worker message trace](2026-10-03-word-im-replacement-qwen35-08-worker-trace.json) reproduces the four cases using an isolated Worker constructor interceptor. Both long requests returned a completed `unsupported` JSON operation (`finish_reason: stop`); both short requests returned `replace_selection` with `Alex`. This directly establishes the model's chosen operation for these repetitions. It does not identify a general semantic or length threshold.

[Prompt experiment](2026-10-03-word-im-replacement-qwen35-08-prompt-probe.json) keeps the model, schema, application validator and native SDK unchanged, but appends a diagnostic instruction to the three tested Chinese requests before sending them to the Worker. The instruction states that the supplied names, numbers, dates and approval wording are plain replacement data rather than additional operations, and asks for an exact replacement of the existing nonempty selection. Both long requests then succeeded (2362/1969 ms), as did both short controls (1274/1115 ms). Exact text, surrounding text and native Undo/Redo passed in all four cases.

The interceptor's eligibility check is specific to this synthetic five-character selection and Chinese command; it is not product routing. The English control received no added instruction. The successful experiment provides a candidate prompt improvement, not production reliability proof. Before adopting it, add the instruction only under the existing anchored affirmative literal-command parser, cover nonmatching/negated prefixes and empty selection, and verify actual production UI across models, multiline/whitespace data and cancellation. No application source changed in this follow-up.

## Adopted bounded guidance and production verification

The application now adds literal-data guidance only when the existing anchored parser recognizes an affirmative Word replacement command and the context reports a nonempty selection. The schema still allows `unsupported`; exact-text validation and native execution guards remain in place. Four new planner cases cover Chinese/English eligibility, an empty selection and a negated prefix. The two positive cases failed before the change and all 46 planner cases pass afterward.

Actual production bundle `editor-XEpe337s.js`, without Worker message interception:

- [0.8B original matrix](2026-10-03-word-im-replacement-qwen35-08-prompt-fixed.json): both long requests and both short controls passed.
- [0.8B multiline matrix](2026-10-03-word-im-replacement-qwen35-08-multiline-fixed.json): both multiline requests preserved line breaks, leading/trailing spaces and literal `<b>Alex & Co</b>` data; short controls passed.
- [1.7B original matrix](2026-10-03-word-im-replacement-qwen3-17-prompt-fixed.json): all four cases passed.
- [0.8B controlled Stop/recovery](2026-10-03-word-im-stop-qwen35-08-prompt-fixed.json): held native preparation was cancelled, original history and prior redo recovered, the late callback was suppressed, and a subsequent IM replacement succeeded. This is controlled callback timing, not a physical slow-font test.

Every successful matrix case checked exact text, neighboring content and native Undo/Redo. Build, all 110 unit-test files (3957 cases), lint and an independent planner review passed. These finite cases establish the specific regression improvement, not universal model reliability or completion of all document/model/device requirements. The UI gained no preview or confirmation step.

## Remaining GPU candidates

The same unmodified production bundle was also exercised with the two remaining configured GPU models on the same isolated Chromium device/profile, using each model's cached weights. Both passed the original four-case replacement matrix:

| Model | Long Chinese first/repeat | Short Chinese/English | Evidence |
| --- | --- | --- | --- |
| Qwen3.5 2B | 3187 / 2627 ms | 1780 / 1683 ms | [Native matrix](2026-10-03-word-im-replacement-qwen35-2-prompt-fixed.json) |
| Qwen3 4B | 3967 / 3682 ms | 2504 / 2390 ms | [Native matrix](2026-10-03-word-im-replacement-qwen3-4-prompt-fixed.json) |

Exact native paragraph/character-format snapshots before and after Undo/Redo were checked against the corresponding pre-operation and successful-operation snapshots. Neighboring content remained unchanged, there were no captured page or visible operation errors, and no preview cards appeared. These timings describe these synthetic cases on this device, not cross-device performance benchmarks.

Controlled native preparation cancellation also passed for [2B](2026-10-03-word-im-stop-qwen35-2-prompt-fixed.json) and [4B](2026-10-03-word-im-stop-qwen3-4-prompt-fixed.json): original document/history restored, prior independent redo remained usable, resumed late preparation did not mutate the document, and the subsequent IM replacement plus its native Undo/Redo succeeded. Native busy, temporary HTML and paste state were clear after cancellation. This closes the configured GPU-model coverage for this particular replacement matrix; CPU, physical devices, general language interpretation, complex Word structures and actual file round trips remain separate requirements.

## CPU fallback verification

[CPU matrix](2026-10-03-word-im-replacement-cpu-06-matrix.json) uses real Qwen3-0.6B Q4_K_M GGUF inference in isolated desktop Playwright WebKit with `navigator.gpu` unavailable, the existing cached CPU model and the same production bundle. Both long Chinese requests and both short Chinese/English controls succeeded, preserving exact text and neighboring paragraph/character-format snapshots through native Undo/Redo. No preview cards or visible operation errors appeared.

The first long request took 37507 ms, the identical repeat 7781 ms, and the short Chinese/English cases 10429/9155 ms. Fresh IM conversations do not guarantee a cold model or backend prompt cache; this experiment does not isolate why the repeat was faster. These are desktop measurements, not Safari/iOS hardware validation or a general latency guarantee.

[CPU Stop/recovery](2026-10-03-word-im-stop-cpu-06-prompt-fixed.json) also passed with a controlled native preparation delay: cancellation restored original document/history, preserved the prior independent redo, suppressed a late callback, and allowed the next IM replacement with exact native Undo/Redo. This verifies cancellation during native preparation after real CPU planning; it does not verify stopping mid-inference or physical slow-font behavior. Model/device reliability, complex document structures and file persistence remain open beyond this bounded test.
