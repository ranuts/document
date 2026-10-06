# Native candidate CSP: stylesheet compatibility and document round trips

The unmodified-entry candidate passes API readiness but breaks the native application stylesheet. All three vendor entry HTML files load `app.css` with `media="print" onload="this.media='all'"`. Forbidding script attributes prevents this event handler from enabling screen styling. Startup readiness is therefore insufficient evidence of UI compatibility.

## Failure and causal controls

The initial native probe used the wrong Word Undo API and failed before any Save acceptance; its harness diagnostic is retained. Word/PPT use `Undo`/`Redo`, whereas Excel uses `asc_Undo`/`asc_Redo`.

After correcting that harness, Word's native text round trip and offline navigation completed, but Excel's real Save-button click timed out because `ws-canvas-outer` intercepted it. Raising the viewport to 1280×900 did not resolve it. Both failed reports remain diagnostics, not acceptance evidence.

The focused Excel geometry controls reproduce the same edit/Undo/Redo sequence. Baseline styling is normal and the Save hit target is the button's icon. With the candidate policy, the Save button is at y=162 and lies beneath the worksheet canvas. A screenshot visibly shows an unstyled application. Violation arrays are empty in this setup; they do not establish absence of a styling failure.

A response-local replacement of the exact stylesheet attributes with `media="all"`, removing the handler, restores the normal Save-button geometry at y=0 without relaxing CSP. The focused fixed report records screen media, no onload attribute and normal hit targets. This establishes the specific compatibility dependency; it does not establish all possible vendor event-handler uses.

## Actual fixed-entry round trips

With that response-local stylesheet change plus the same candidate CSP, independent fresh contexts for DOCX, XLSX and PPTX all completed native marker insertion, Undo removing the marker, Redo restoring the exact edited snapshot, real header Save download and reopening that file with exact text snapshots. Downloads were respectively 25,796, 8,423 and 33,962 bytes with no download failures. No forced click or synthetic download was used.

All three subsequently completed same-context offline navigation to a fresh editor document: network marked offline, uncached fetch rejected, upstream response count zero, native API ready, and shell/iframe cross-origin isolation retained. This is neither browser-process cold-start evidence nor an offline CSP enforcement test: effective cached iframe policies and negative controls still need explicit verification.

The native mutations use `pluginMethod_PasteText` directly. This exercises native editing and serialization under the candidate; it does not test IM routing, model inference, plugin tool dispatch, arbitrary existing document formatting, remote URLs or cross-origin embedding. Native full-document/style fidelity remains outside these text snapshots.

## Reproduction and integration gate

Run `VENDOR_CSP_STATIC_STYLE=1 node docs/evaluations/probe-vendor-csp-native.mjs` against the built preview at 5193. The proxy preserves host isolation headers, adds CSP only to native entry responses, and modifies only the exact async stylesheet attributes when this flag is set. All vendor HTML responses, including service-worker precache requests, receive that experiment. The source supports focused geometry/baseline runs; archived earlier reports predate explicit experiment metadata.

No product HTML or production policy changed. Before shipping, repeat actual IM operations with the fixed entry and candidate, check styling for all editors, verify effective offline policies and prior-cache upgrades, exercise embedding/remote URLs/plugins, and validate built Pages/Docker responses. Shell/model Worker policies remain unchanged.

Artifacts: [native probe](probe-vendor-csp-native.mjs), [fixed three-document report](2026-10-03-vendor-csp-native.json), [candidate geometry](2026-10-03-vendor-csp-save-geometry-candidate.json), [baseline geometry](2026-10-03-vendor-csp-save-geometry-baseline.json), [static stylesheet geometry](2026-10-03-vendor-csp-save-geometry-static-style.json), [checker](verify-vendor-csp-native.py).

The subsequent [effective offline response/control probe](2026-10-03-vendor-csp-offline-policy-analysis.md) verifies retained Service Worker iframe policies and blocked script controls for all three types after same-context offline navigation. Browser-process cold launch, prior-cache upgrades and IM routing remain unverified by these experiments.
