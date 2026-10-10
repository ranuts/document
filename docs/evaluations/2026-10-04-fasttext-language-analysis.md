# Local fastText language classifier feasibility — 2026-10-04

The compressed classifier is feasible in a browser Worker, but a whole-document top-language mismatch rule is not ready for direct editing acceptance. No product dependency, model asset or gate was added.

[Official fastText model documentation](https://fasttext.cc/docs/en/language-identification) describes 176-language UTF-8 classification and a compressed ~917KB model. Downloaded public original `lid.176.ftz`: 938013 bytes, SHA256 `8f3472cfe8738a7b6099e8e999c3cbfae0dcd15696aac7d7738a8039db603e83`; URL recorded in the raw native report. Upstream v0.9.2 source revision `5b5943c118b0ec5fb9cd8d20587de2b2d3966dfe`, compiled in private temporary storage. The upstream code is MIT and the original model is CC-BY-SA 3.0 per its documentation; attribution/package review would be necessary if adopting. No newer large NLLB model was used.

## Actual observations

61 classifier inputs: source/output pairs from the twelve existing script controls, source/final-output pairs from the twelve prior real Qwen writing responses, plus thirteen fresh short-language/names/code/numeric/URL controls. This is not fresh heldout task-model accuracy. Language-only expected verdicts do not approve factual writing quality.

The native CLI top-three classifications and the actual Chromium module Worker WASM predictions match for all 61 texts within 1e-5 score tolerance. The browser initialized online through route-local fixture responses, then set the owned context offline and classified the full batch with zero additional requests; Worker terminated and browser closed. This proves initialized-worker offline computation, not cached reload, cold offline process launch, deployed CSP/hosting, simultaneous GPU model resource use, Safari or physical mobile support.

Browser initialization measured 69.2ms and classification batch 5.4ms in this isolated local fixture run. Native CLI process+load+batch measured 68.45ms on this warmed execution; these scopes differ and are not a native-vs-WASM speed comparison. Loader JS 104146 bytes and WASM 238930 bytes (see raw artifact metadata for exact bytes/hashes); model and runtime sum is roughly 1.28MB uncompressed, not total memory or transfer compression. The Emscripten module did not expose HEAPU8; linear memory is explicitly null/unmeasured, not zero.

All seven short prose controls predict the expected language, but Spanish has only .627596 top score. Names predict English at .605079; code predicts Norwegian at .0576555, numeric literals German at .465013, URL English at .592525. These outputs demonstrate why text without natural-language evidence needs abstention. Scores are model outputs, not calibrated probabilities of correct detection.

## Gate calibration, no adoption

At .5/.7/.8 minimum score for both source/output, different top-language labels catch German→English and Spanish→Portuguese, plus the real Chinese→Danish-like model output, but falsely reject the legitimate retained English quotation from a Chinese/English document. They miss the shorter synthetic Chinese→Danish-like control due to classifier confidence. At .9 the legitimate quote is still falsely rejected and the actual bad Chinese result is missed. At .95 the quote is accepted but both Danish-like language drifts are missed. At .99 no mismatch is rejected. This is a small declared threshold sweep, not optimized or calibrated production confidence.

A classifier answers which language dominates the text; it does not decide whether a names-only or quotation-only summary is a valid preservation of intentional mixed content. Do not add repeated confirmation or preview cards to mask that distinction. Next evaluate segmented/mixed-language handling and abstention before considering integration; factual role, condition and negation verification remain independent open requirements.

## Reproduction and build compatibility

The original upstream WASM Makefile fails with Emscripten 6.0.10's removed EXTRA_EXPORTED_RUNTIME_METHODS. Updating command flags exposed C++17 requirements; C++17 then exposed unrelated old training/Meter bindings incompatible with modern embind. The experiment consequently uses a small read-only language loading/prediction binding in `fasttext-language-probe.cc`, while retaining unmodified upstream classifier/model code. It omits training functionality because this experiment only classifies language, not because the product goal was narrowed. The first browser attempt also tried to read unexported HEAPU8; that diagnostic was corrected to null and no memory measurement is claimed.

Build command in the upstream checkout: `em++ -O3 -std=c++17 --bind -fexceptions -s ALLOW_MEMORY_GROWTH=1 -s EXPORTED_RUNTIME_METHODS=FS -s FORCE_FILESYSTEM=1 -s MODULARIZE=1 -s EXPORT_ES6=1 -s ENVIRONMENT=web,worker -Isrc src/args.cc src/autotune.cc src/matrix.cc src/dictionary.cc src/loss.cc src/productquantizer.cc src/densematrix.cc src/quantmatrix.cc src/vector.cc src/model.cc src/utils.cc src/meter.cc src/fasttext.cc language_probe.cc -o webassembly/language_probe.js`.

Raw reports bind driver, model, native binary, small binding and JS/WASM artifact hashes. Sources/model/generated binaries remain under private temporary storage and are not durable repository runtime artifacts. The reusable probes assume those temporary locations exist. Product build/unit/lint were not repeated for this evidence-only turn; scoped syntax and report-control checks suffice for the experiment and do not imply shipped functionality.

Independent review confirmed no Critical/Important issues, and identified a newline-normalization gap in the initial single-line-only browser driver. The driver now replaces actual line-feed characters, with two added multiline English/Chinese controls. The final 61-input parity run includes both. The route-local fixture did not set COOP/COEP or record crossOriginIsolated; “isolated” means an independent browser context, not cross-origin isolation acceptance.
