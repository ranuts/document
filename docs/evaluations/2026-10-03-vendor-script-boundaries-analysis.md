# Native editor candidate script boundaries

Six real native startup runs completed: DOCX, XLSX and PPTX with current host policies, followed by all three with a response-local candidate iframe CSP. Every run reached native document/API readiness with no page errors.

The candidate hashes the actual inline startup script bytes and allows same-origin scripts plus legacy JavaScript dynamic compilation (`unsafe-eval`). It blocks script attributes and foreign scripts. Existing style, image, font, worker and frame requirements remain permitted. Broad HTTP/HTTPS connection permission retains remote-document compatibility in principle; this is not an exfiltration barrier or a verified remote-document workflow.

In each baseline, a controlled foreign JavaScript response was requested exactly once and executed. An injected inline script and an onclick attribute also executed. The identical controls in each candidate were blocked: no foreign-script requests occurred, inline and attribute markers remained false, and violation events reported the script directives. Ordinary iframe eval returned 2 in both modes, deliberately demonstrating the remaining legacy execution permission.

The controlled external response has valid JavaScript, permissive CORS and cross-origin resource policy. Its baseline execution establishes that a candidate rejection is not merely an invalid host, network failure or cross-origin isolation rejection.

## Scope and shipping gate

This isolated Chromium experiment blocks service workers and injects a response header only on actual vendor entry HTML. No product files, vendor bundles or deployed policies were changed. Controls run after startup and deliberately mutate only synthetic script/button elements and marker globals. The policy is an incremental script-source restriction, not full protection against arbitrary code within the trusted origin, legacy eval, unsafe inline styles or outbound data requests.

Before integration, verify real IM document changes, native Undo/Redo, Save and reopen, runtime plugin execution, supported embedding and remote document URLs, plus offline cached entry upgrades. Validate actual Pages, Docker and preview responses. Startup alone does not prove those workflows or all documents. Existing shell and model Worker policies must remain independent and unchanged.

Artifacts: [probe](probe-vendor-script-boundaries.mjs), [six observations](2026-10-03-vendor-script-boundaries.json). Reproduce against the built preview at port 5193 with `node docs/evaluations/probe-vendor-script-boundaries.mjs`.

Subsequent [native UI and Save verification](2026-10-03-vendor-csp-native-analysis.md) exposed a real startup-only false positive: the candidate prevents the stylesheet onload handler, breaking screen styling. A response-local static stylesheet variant restores native Save round trips. The original six runs prove script controls and API startup only, not UI compatibility.
