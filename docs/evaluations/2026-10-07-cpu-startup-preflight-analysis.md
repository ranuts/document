# CPU startup readiness allocation regression

A resolved SDK load could expose metadata even when native allocation failed. The verified official 7B screen showed zero vocabulary/context and zero completion calls despite the prior loaded UI note. Initialization now requires the matched native token-count preflight to succeed with a valid context before the provider is reported ready. The preflight tokenizes a fixed synthetic message; it does not evaluate or generate model text. Failure propagates through existing runtime cleanup.

The new unit regression first fails against the old provider, then passes after the change. Production build and TypeScript pass; all 141 test files / 4,533 tests pass. The suite retains an asynchronously handled rejection warning, not a failed test.

Real current-build Chromium checks show the 7B allocation failure displayed as model-load failure with empty model status, one SDK load, one failed native count, zero completion calls and one exit. A fresh context imports the ordinary .6B model, counts 14 tokens against context 2048 and successfully generates one hello reply. Both contexts and browser close. The failure message remains generic and mentions first-download connectivity; this evidence certifies readiness/error propagation, not detailed allocation diagnosis in the UI.

Served build core1791357432/vendor a048b43b3e2b, editor-a29E5U4S.js. Hashes below are after-run observations, not a separately frozen initial-to-final runtime certification. Model bytes were verified in the preceding download receipt. No seven-language quality, physical-device or full offline/privacy acceptance is claimed.
