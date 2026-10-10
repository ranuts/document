# Actual IM tool dispatch under candidate vendor CSP

Actual production IM UI ran three document commands using cached local Qwen3-1.7B WebGPU inference on Metal: insert `Hello tools` into Word, write that value to Excel A1 and add one PPT slide using the current layout. All commands completed without visible errors or page errors, and preview-card count remained zero.

For each document, the native Undo operation restored the prior observed state; Redo restored the post-command state. A real click on the native header Save button produced a nonempty download with no failure. Reopening the downloaded file through the actual home file chooser reproduced the observed post-command state.

These observations use Word text, Excel A1 plain value and PPT slide count. PPT passes insertion/persistence of one slide; it does not establish placeholder text, shapes, notes, arbitrary layouts or existing formatting fidelity. Native document snapshots do not constitute a multilingual planning-quality benchmark.

## Candidate and runtime scope

The isolated persistent profile reuses previously downloaded model artifacts at the current preview origin. The test preflight unregisters any pre-existing Service Worker in this isolated profile, then navigates away before testing. Service Worker registration is blocked. Every new/opened document entry response must be observed as a network response with the exact intercepted policy; relying on the context option alone proved insufficient for this already-used profile. Actual vendor entry HTML receives the candidate CSP with exact inline script hashes, same-origin script permission and required unsafe-eval. Script attributes remain forbidden. The exact async app.css media/onload attributes are replaced response-locally with static screen media; all recorded new/opened document entry responses record that change.

The tool request goes through the normal visible IM input, real local model planning and production plugin document dispatch. The probe does not supply model responses, mock APIs, force clicks or patch product bundles. This closes the representative IM integration gap left by direct native-API probes, while leaving unsupported plugin workflows and other commands outside the experiment.

No production HTML or hosting policy was changed. This run is online with warm model cache, not offline, fresh model download, old-cache migration or physical-device acceptance. The separate [offline response-policy experiment](2026-10-03-vendor-csp-offline-policy-analysis.md) covers same-context native offline startup/controls, not these IM requests offline.

Before shipping vendor CSP, verify prior-cache migration, supported remote document and embed paths, actual static hosting delivery and broader plugin behavior. Keep shell and model Worker policies independent. Legacy unsafe-eval and broad connection permissions remain material policy limits.

Reproduce against the built preview at port 5193 with `node docs/evaluations/probe-vendor-csp-im-tools.mjs`. Use the cached isolated `.scratch/ai-csp/gpu-profile` exclusively while the probe runs.

Artifacts: [probe](probe-vendor-csp-im-tools.mjs), [observations](2026-10-03-vendor-csp-im-tools.json), [checker](verify-vendor-csp-im-tools.py).

## Harness diagnostics and evidence requirements

An initial run completed native operations but captured zero candidate entries; its raw `passed` field was a harness false positive caused by an empty-array `every` check. The evidence checker rejected it. Expanding the URL route match still captured no entries because an existing Service Worker served the profile's cached iframe. That report fails at the new explicit candidate-entry guard. Neither run proves candidate integration.

After unregistering the isolated profile's existing Worker, six entry responses were intercepted and all three native round trips completed. That report nevertheless fails because the probe's init script accessed localStorage on its temporary about:blank page, producing a harness pageerror. The final init script restricts its settings to the exact test origin; page errors are never filtered away. The final acceptance guard requires at least six intercepted entries and six actual responses, all network-served with matching policies, as well as all native operations. Retained diagnostics are not acceptance results.

The [corrected old-cache transition simulation](2026-10-03-vendor-csp-cache-upgrade-analysis.md) passes native three-document workflows and effective offline policy checks. Earlier takeover/reversion conclusions were invalid asynchronous-polling observations and are withdrawn. The simulation uses synthetic stamps; real two-artifact hosting, embed and broader plugin acceptance remain open. Fresh-candidate IM success alone does not establish those gates.
