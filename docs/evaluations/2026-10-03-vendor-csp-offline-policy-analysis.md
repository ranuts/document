# Effective candidate iframe policy after offline navigation

The fixed-entry candidate was tested again in fresh isolated Chromium contexts for DOCX, XLSX and PPTX. Online native insertion, Undo/Redo, header Save and file reopening all completed with exact text snapshots. Each context then navigated offline to a new document under the actual application Service Worker.

## Effective policy and controls

For all three offline documents, the actual iframe navigation response reports `fromServiceWorker: true`. Its CSP matches the policy injected into that editor's entry HTML by the experiment proxy. These are observed response headers, rather than an assumption based on cache existence or startup success.

After native API readiness, ordinary injected inline scripts, onclick handlers and a controlled foreign script are blocked in every offline frame. Markers remain false; zero controlled foreign-script requests occur; new securitypolicyviolation listeners record script-src-elem for inline and foreign sources, and script-src-attr for event handlers. The external URL serves valid JavaScript with permissive CORS/CORP if requested. Its online positive execution control was previously established in the six-run [script-boundary experiment](2026-10-03-vendor-script-boundaries-analysis.md); this run does not assert offline network availability for that external host.

Ordinary iframe `eval('1+1')` returns 2, deliberately preserving the SDK's required legacy permission. This candidate is not protection against dynamic compilation or trusted-origin compromise. Stylesheet inspection shows screen media enabled without the onload handler. Save-button hit testing reaches its own button rather than the worksheet canvas in all three frames.

The browser is offline, an uncached fetch rejects and upstream response count remains zero. Both shell and iframe retain cross-origin isolation. The experiment performs no manual cache edits or header repair.

## Limits and next gates

This is **same-context offline navigation** after fresh candidate precaching, not a browser-process cold launch, prior-build cache migration, arbitrary document compatibility or a deployed policy. Service Worker responses in this experiment cache response-local HTML edits and CSP headers; production vendor HTML and policy are unchanged.

Native mutations use the direct API, not IM routing. Model inference, actual IM plugin calls, cross-origin embedding, configurable remote document URLs and supported plugin behavior remain integration gates. The candidate still permits unsafe-eval, inline styles and broad HTTP/HTTPS connections; it is not a data-exfiltration boundary.

Reproduce with `VENDOR_CSP_STATIC_STYLE=1 node docs/evaluations/probe-vendor-csp-offline-policy.mjs` against the built preview on port 5193. The proxy changes only native entry responses, setting exact inline-script hashes and converting the exact stylesheet media/onload pair to static screen styling. Shell and model Worker policies remain unchanged.

Artifacts: [probe](probe-vendor-csp-offline-policy.mjs), [actual observations](2026-10-03-vendor-csp-offline-policy.json), [checker](verify-vendor-csp-offline-policy.py).

Subsequent [actual IM integration](2026-10-03-vendor-csp-im-tools-analysis.md) verifies representative online Word/Excel/PPT tool commands with local GPU planning, native Undo/Redo/Save/reopen and zero preview cards. Offline IM dispatch and prior-cache migration remain outside these experiments.
