# Actual CPU threading and isolation compatibility

The current runtime selected one CPU thread: native wllama `getNumThreads()` returned 1, `isMultithread()` false and browser `crossOriginIsolated` false (hardwareConcurrency 10). This is consistent with the [official wllama documentation](https://github.com/ngxson/wllama/blob/master/README.md), which requires COOP and COEP for multi-thread inference. The pinned local SDK and application thread selection were inspected, rather than assuming the configured cap of four meant four threads were active.

The isolated control injected COOP `same-origin` and COEP `require-corp` into same-origin responses only. Native runtime methods then returned four threads and multithread true, with browser isolation true. Same default CPU Qwen3 0.6B, same production writing request, same 447 input tokens:

| Observation | Baseline | Isolated control |
| --- | --- | --- |
| Actual native threads | 1 | 4 |
| Prompt processing | 29.04 s | 7.66 s |
| UI response completion | 34.42 s | 9.13 s |
| Completed output tokens | 31 | 29 |

This is one stochastic request per configuration, not a controlled benchmark. Both completed valid JSON and both changed the date spelling, so the existing guard correctly rejected them and preserved the document. The isolated response also changed payment wording; this is not a writing-quality pass. Speed and factual fidelity remain separate requirements.

## Editor compatibility checks

With experimental isolation, real GPU Qwen3 1.7B IM commands edited an isolated Word document, Excel B2 and a new PPT text box. Main page and editor iframe both reported isolation true. Native Undo exactly restored the initial snapshots; Redo exactly restored the edited snapshots. Visible native Save produced actual downloads, and the homepage file chooser reopened each downloaded document with exact matching text snapshots. Sizes: DOCX 25,848 bytes, XLSX 8,426 bytes, PPTX 33,959 bytes. The final three-editor report passed with zero page errors, visible errors or preview cards.

Initial controls are retained as diagnostics, not passes: favicon navigation aborted before CPU testing; an unconditional bootstrap localStorage write failed on opaque about:blank although the first three native edit/history checks passed; and a save probe waited for download while leaving the native file picker enabled. The final probes use an HTML reset, guard storage by origin, and disable the picker to test download fallback. The picker hypothesis is consistent with the final result but was not independently captured in the timed-out run. The initial editor source is retained as exact text to avoid linting its diagnostic-only unused-expression warnings.

All final probe sources and hashes are recorded in their reports. The diagnostic runner restored generated bundle bytes exactly after terminal execution; both original hashes were checked. Final source lint and runner syntax checks pass. No production headers or application source changed in this investigation.

Next: validate offline caches and upgrade from cached responses without isolation headers, then implement the same isolation policy across development, preview and actual hosting if compatible. Also check unsupported browsers and cross-origin imported resources. Native text/save coverage is not complete styling fidelity or physical-device coverage. The overall goal remains open.
