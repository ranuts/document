# Local assistant CSP investigation

The built editor shell now has an early meta CSP generated from final HTML. New-build WebLLM Worker response policy is now integrated; see [actual hosting verification](2026-10-03-worker-csp-hosting-analysis.md). Worker offline-upgrade coverage and vendor iframe response policy remain open; the overall security gate is incomplete.

## Verified candidate

`2026-10-02-csp-shell-probe.json` records an enforced response-header experiment on the production editor shell. An isolated persistent Chromium profile reused the cached CPU model. Service workers were blocked so their cached responses could not bypass header injection. The model loaded and returned `Hello.`; page errors and captured shell violations were empty.

The candidate permits only same-origin scripts, the exact build-time hash of the existing theme bootstrap, and WebAssembly compilation. It forbids script attributes and objects. Blob workers and frames remain necessary for the local runtime and editor. Inline styles remain necessary for current component styling. Download connections are separate from script execution: Hugging Face and its artifact redirect hosts, plus the current WebLLM WASM artifact host, are download candidates, not external script origins.

This proves compatibility for one CPU conversation in the shell. It does not prove GPU loading, fresh downloads through all redirects, adversarial injection protection, worker response policies, iframe protection, offline cached policy upgrades, embedding, or production delivery.

## Implementation requirements

1. Generate inline hashes from final built HTML, after transformations. A static copied hash can silently break theme restoration after an edit.
2. Apply shell policy to all equivalent editor URLs and validate actual response headers. Add policies to Worker script responses as well; the shell header alone does not establish each worker's fetch restrictions.
3. Treat vendor iframe HTML independently. Its inline startup code and legacy dynamic compilation need investigation before enforcing the shell policy there. Do not add a second intersecting global CSP that accidentally breaks it.
4. Keep the supported cross-origin embed workflow. Do not introduce frame-ancestors restrictions or cross-origin isolation without verifying that workflow.
5. Verify blocked injected inline scripts, event attributes, eval and foreign scripts alongside working model initialization, cancellation, document opening/export and offline cold starts.
6. Exercise the same policy locally and in the built Pages artifact. Vite preview currently does not apply `_headers`; an ordinary preview success cannot prove production CSP compatibility.
7. Audit model-host redirects and configurable model sources before restricting connection destinations. Prefer pinned or self-hosted artifacts; don't grant broad external script access to make downloads work.

## Primary references

- [Cloudflare Pages headers](https://developers.cloudflare.com/pages/configuration/headers/) — matching rules accumulate; duplicate headers are comma-joined. This means policy scope must be deliberate rather than assuming a later narrow rule overrides a broad rule. Static `_headers` does not cover Pages Functions responses.
- [MDN script-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src) — hashes and WebAssembly compilation permissions are distinct from unrestricted JavaScript evaluation.

Retrieved 2026-10-02. No deployment was performed.

## Build integration and direct validation

`bin/editor-csp.mjs` inserts the policy at the start of the built editor head, before scripts. It hashes exact final inline bootstrap bytes and rejects existing policies to prevent accidental intersections. `bin/build.sh` invokes it after Vite; the policy travels with the shell on Pages, Docker and offline caches. Development HTML is not transformed by this build step.

Unlike the original download-only experiment, the implemented connection directive permits HTTP/HTTPS and blob fetches: `lib/document.ts` supports user-supplied remote document URLs, and host integrations support custom artifact URLs. Those connection permissions do not authorize foreign script execution. CSP is therefore not evidence of a network exfiltration barrier; local-only inference and network-content audits remain separate requirements.

After build integration, actual offline refresh and offline process-start cold launch were repeated. The latest offline CPU reports reference build core-1790920208; the cold report records the actual cached meta policy. Both restore the editor and model and generate a response without page errors. Refresh takes 24.05 seconds; cold reply takes 22.06 seconds. Refresh output `Only hello.` also exposes imperfect instruction following, so runtime success is not a language-quality pass. Earlier pre-CSP reports remain preserved separately. Existing spelling-script aborted requests remain recorded.

`2026-10-02-csp-built-shell.json` validates the actual build without injecting a response header. CPU initialization and reply pass with no functional violations. An injected inline script and an injected onclick handler both fail to execute (`injected: false`), producing the expected script-src-elem and script-src-attr violations. GPU, external-script blocking, export/remote URL workflows, embedding and offline policy refresh still need direct verification.

Subsequent `2026-10-02-csp-gpu-shell.json` directly verifies native WebGPU on Apple metal-3, loading Qwen3-1.7B and returning `Hello.` under the built meta policy. The displayed engine is WebGPU, not CPU fallback. Functional violations and page errors are empty; both injection probes remain blocked. Default headless Chromium returned no adapter; this test explicitly uses `--enable-unsafe-webgpu --use-angle=metal` in a new isolated persistent profile. It is evidence for that configuration, not default-browser availability. The initial model download populated about 940 MiB of IndexedDB. GPU cold offline restoration, device loss, cancellation, worker response policy and multilingual quality are not covered by this single conversation.

GPU offline refresh and cold launch were subsequently verified in `2026-10-02-offline-gpu-ui.json` and `2026-10-02-offline-cold-gpu-ui.json`: both keep native WebGPU and answer in about 1.3 seconds. Cold launch records the actual cached shell CSP. The additional stop test exposed a real deadlock: stopped text stays stable, but the next request locks the input for at least 60 seconds. Two failed snapshots preserve both the timeout and actual UI messages/input state.

The installed WebLLM worker generator releases its model lock only after its tail is consumed; returning the main-thread RPC iterator does not consume that remote tail. WebLLM now interrupts generation and silently drains remaining chunks when the request is cancelled. The provider rejects cancellation and never displays those discarded chunks. Other engines retain their existing stream consumption behavior. A regression test fails on the original held-lock behavior and passes after the change. `2026-10-02-offline-gpu-stop-ui.json` directly verifies the new build in an offline cold process: stop takes 33 ms, the partial text remains stable for one second, and the next request returns Hello. No page errors occur. This is one observed cancellation/recovery sequence, not proof of device-loss recovery or indefinite stability.

`2026-10-02-csp-vendor-probe.json` records three failures when the hash policy also forbids vendor JavaScript dynamic compilation. DOCX, XLSX and PPTX each time out during startup with explicit unsafe-eval errors. The shipped Underscore template code contains new Function. Captured iframe violation arrays are empty despite explicit browser exceptions; exceptions, not those arrays, establish the incompatibility. Vendor policy must account for or remove this dependency before enforcement. No permissive vendor policy was shipped as a substitute for that investigation.

Further [native startup dependency tracing](2026-10-03-vendor-function-dependencies-analysis.md) finds SDK constructor calls associated with macro/plugin execution infrastructure in all three editors, alongside template compilation. Precompiling templates alone does not resolve vendor startup incompatibility. No vendor policy relaxation or SDK replacement was shipped.

A subsequent [six-run script-boundary experiment](2026-10-03-vendor-script-boundaries-analysis.md) preserves required vendor unsafe-eval while restricting script sources, inline scripts and attributes. All three native startups and controlled positive/negative script tests pass. This remains a response-local experiment; native mutation/Save and offline upgrade gates are not yet satisfied, so no vendor policy was shipped.

[Native UI/Save follow-up](2026-10-03-vendor-csp-native-analysis.md) shows the original candidate also blocks a stylesheet onload attribute, leaving screen styling disabled. A response-local static stylesheet variant restores three native edit/Undo/Redo/Save/reopen cycles. Startup-only success must not be treated as UI compatibility; production vendor enforcement is still unshipped.
