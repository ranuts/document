# CPU pthread startup CSP investigation

Four observed native em-pthread Workers reject ordinary eval/data-module controls under the existing editor policy, and the actual CPU model replies Hello afterwards. This is a startup-instrumented thread-pool experiment, not an uninstrumented debugger pass or a product change.

## Direct debugger attempt

`probe-cpu-pthread-csp.mjs` extends the preceding main-Worker probe with CSP-respecting CDP evaluation on observed em-pthread targets. The first thread does not settle evaluation within ten seconds; remaining threads are not probed by that method. The report is explicitly incomplete. The main controls and subsequent native model reply/positive baseline still work.

A timeout cannot establish whether CSP allowed or blocked evaluation. Native blocking is a plausible explanation but not proven by a stack trace in this experiment. The retained `2026-10-03-cpu-pthread-csp.json` must not count as a successful thread restriction test or an application failure.

## Startup controls

`probe-cpu-pthread-startup-csp.mjs` appends a diagnostic suffix to text/javascript Blob construction in the isolated page. The original JavaScript parts are retained; model data/WASM files are not patched. The suffix executes controls only when self.name is exactly em-pthread. It stores ordinary eval and data-module import outcomes via a same-origin BroadcastChannel before debugger responsiveness is required. Other Worker names return from the suffix immediately.

This changes temporary generated Worker script bytes, with no repository product source, on-disk generated bundle, response policy or model modification. Native SDK creation, WASM inference, real model weights and native pthread pool remain real. The instrumentation is not a shipped security mechanism. Its Blob constructor replacement is limited to this experiment; no general constructor-compatibility claim is made.

The four unique result URLs exactly match the four actual CDP targets named em-pthread. Every eval result is a CSP EvalError naming the same script-src directive as the production editor's meta policy; every data module import is rejected. Main page isolation is true. Actual engine is CPU/Qwen3-0.6B; after controls, the model returns Hello. Main page and visible inference errors are zero.

A separate synthetic page has no CSP and creates a simple blob Worker named em-pthread using the identical appended startup controls. Its eval returns 2 and its data module returns 42. This checks the probe can distinguish execution from policy restriction, rather than treating a generic module failure as a CSP pass. The baseline contains no model and is not evidence that the native pool operates without CSP.

Evidence: `2026-10-03-cpu-pthread-startup-csp.json`. Network is available, weights already cached, desktop Chromium and one real conversation. No fresh model-download, cold offline, other browsers/devices, cache eviction, physical memory limits, native Save/reopen, semantic writing quality or complete security-gate claim. These four startup-instrumented contexts do not prove every possible later-created thread or uninstrumented debugging scenario.

Reproduce sequentially on the current preview at 5193 with the unused existing CPU profile: `node docs/evaluations/probe-cpu-pthread-csp.mjs` (incomplete diagnostic expected on this observed environment), and `node docs/evaluations/probe-cpu-pthread-startup-csp.mjs`. `python3 docs/evaluations/verify-cpu-pthread-csp.py` verifies the reports have distinct evidential roles, four target/result correlations, exact directive, baseline execution and native reply. Syntax and root lint are checked. No production source changed, so no new product build/full test rerun is claimed.

Together with the preceding uninstrumented main-Worker controls, this provides evidence about existing CPU Worker policy enforcement. Native editor iframe dynamic compilation, development paths, fresh artifact fetches and broader device/model acceptance remain open.
