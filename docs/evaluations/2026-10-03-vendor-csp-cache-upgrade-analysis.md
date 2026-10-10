# Candidate vendor upgrade: corrected polling evidence

## Correction to the earlier interpretation

The earlier claim that candidate control was established and then reverted is withdrawn. The pinned Playwright implementation resolves `waitForFunction(async () => false)` to a false handle immediately: a returned Promise was treated as truthy before its result was awaited. The [minimal semantics control](2026-10-03-playwright-async-predicate-control.json) reproduces this, while explicit polling correctly rejects false. Historical failed checkpoints remain useful raw diagnostics, but do not establish candidate takeover or a product regression.

The [original lifecycle trace](2026-10-03-vendor-csp-cache-upgrade-registration-trace-diagnostic.json) records the original worker activated and the candidate only installed when the inadequate readiness check passed. The [corrected trace](2026-10-03-vendor-csp-cache-upgrade-registration-trace.json) uses bounded explicit VERSION polling and records actual candidate activation and effective iframe policy.

## Corrected simulation

The [three-document report](2026-10-03-vendor-csp-cache-upgrade.json) passes Word, Excel and PowerPoint native edit, Undo, Redo, Save and reopen after warming old policy-free caches, switching the proxy to candidate entries, and explicitly confirming the controlling candidate VERSION. Actual iframe response headers establish the policy before mutation. Same-context offline navigation checks cached policy, blocked inline/event/foreign script controls, native Save geometry and zero upstream requests. Existing runtime caches may remain while clients use them; their presence alone is not a migration failure.

This is a controlled proxy simulation using synthetic core/vendor stamps and response-local candidate HTML/CSP. It reuses the real SW algorithm but does not deploy two independently built release artifacts. The candidate vendor digest covers three transformed entry bodies, not the full build vendor tree. It does not prove fresh-process offline behavior, IM inference, physical-device coverage, remote document/embed support or general plugin compatibility. No candidate vendor CSP was shipped. Response-local precache revalidation was not needed or adopted.

Reproduce with `node docs/evaluations/probe-vendor-csp-cache-upgrade.mjs` against preview port 5193. The [focused checkpoint](probe-vendor-csp-cache-upgrade-policy-checkpoint.mjs) and [registration trace](probe-vendor-csp-cache-upgrade-registration-trace.mjs) now also use explicit VERSION polling. Do not run these while a separate E2E rewrites dist/sw.js.

## Separate product bootstrap defect

Replacing the same inadequate asynchronous predicate in the serial product E2E revealed a real silent-heal defect: an incoming worker precaches its runtime cache before it waits, so checking cache presence mistakes an installed build for an already-serving build. The fix compares confirmed outgoing/incoming VERSION replies and preserves unsaved-edit checks. Its evidence is separate from the proxy simulation; see [serving-version validation](2026-10-03-serving-version-update-analysis.md).

## Independent-artifact follow-up

The [two-build experiment](2026-10-03-vendor-csp-two-build-analysis.md) now uses actual full vendor-tree stamps and baked candidate policy. Three blank-session native/offline controls pass, but a saved old Word session remains on the old controller despite an installed candidate and promotion delivery. This does not invalidate the earlier blank-session simulation; it adds a stronger saved-session gate that remains failed. No vendor policy is shipped.
