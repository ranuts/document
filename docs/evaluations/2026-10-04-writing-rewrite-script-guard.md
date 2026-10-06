# Reject complete Latin/CJK writing-system switches during rewrite

Product rewrite validation now rejects clear complete Latin/CJK switches before returning an edit result. It does not make the model semantically reliable or adopt the diagnostic demonstration prompt.

## Reproduction and implementation

The pair-order diagnostic recorded three wrong-script results that retained all numeric/currency literals and were applied: Japanese→English, Japanese→Spanish and Korean→English. Unit tests using the captured Japanese/Korean source/output pairs plus Latin→CJK failed first (three promises resolved instead of rejecting). Two controls retained native Japanese writing with Latin personal names and allowed predominantly Latin mixed-source rewriting. After implementation all 92 writing tests pass.

Only rewrite is affected. Reject when source has at least 16 CJK letters, CJK dominates Latin, and output has zero CJK with at least 16 Latin letters; also reject Latin source of at least 16 letters with no CJK when output has zero Latin and at least 16 CJK. Conservative minimum evidence avoids classifying short labels/names. Existing localized wrong-language error is reused. Existing translate rules remain intact. Short text, mixed output, languages sharing scripts, roles, negation and other semantic changes remain outside this guard; one retained CJK letter can bypass its intentionally complete-switch criterion.

## Native current-build regression

Post-build driver/verifier preregistered in `c88d535`; 16 actual WebGPU Worker requests use the identical source, instruction, demonstrations/order, model/settings and raw generated text/stop reason captured before the fix. Raw outputs are not replaced. Diagnostic route transforms prompts only as in the prior order experiment; production defaults do not adopt those prompts. Bundle files remain unchanged during inference.

`python3 docs/evaluations/verify-writing-rewrite-script-guard.py` verifies identical pre/post requests and generated text, exact current bundle/driver hashes, exact demonstration contents/order, no preview cards, preserved source on refusal, and native Undo/Redo for all applied outputs. Exactly the three previously applied wrong-script results now preserve source and show the localized language error. The other thirteen guard outcomes/output texts are unchanged. Forward remains five applications/three refusals; reverse changes eight applications/zero refusals to five applications/three refusals. Counts are not quality.

Completed report contains no harness errors or recorded external requests. The verifier expectation was adjusted to the existing displayed English localization (“does not match the requested language”), rather than internal exception wording. Current-source readonly reviewer found no blockers and confirmed translation isolation/localization; suggested short/threshold/mixed and explicit translation controls remain nonblocking test extensions.

## Checks and limits

Full `pnpm test`: 128 files, 4,376 tests pass. Two PromiseRejectionHandledWarning messages appeared; do not represent this as warning-free. TypeScript noEmit and scoped oxlint pass. Production build succeeds with SDK node-module externalization and large-chunk warnings. No push/merge/deploy.

This establishes the protective complete-switch behavior on tested current native IM calls, not successful rewrite quality, native Save, CPU/mobile, cold offline/PWA or complete privacy certification. Existing Korean role-loss outputs still apply when their script remains Korean. Improving generation and semantic fidelity remains required.
