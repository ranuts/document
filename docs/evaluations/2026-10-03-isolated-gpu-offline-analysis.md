# GPU cache inference under isolation-mode Service Worker

No product source or global hosting headers change in this evaluation. It tests the `aae9cf0` policy-registration/cache-response change using the existing cached model profile.

`probe-isolated-gpu-offline-matrix.mjs` warms the current app shell online in one Chromium process. Only this warm process has a same-origin response-header route adding COOP `same-origin` and COEP `require-corp`; actual app registration selects its isolation-mode worker. That process is closed before inference tests.

Each GPU model is then tested in a newly launched Chromium process over the same isolated test profile. From launch, an unreachable local HTTP proxy is configured, with Chromium's implicit loopback bypass disabled. No response-header or resource-fulfillment route is installed in those processes. Thus network remains blocked through navigation, the COOP process transition and inference. The model cache was populated by earlier evaluations; this is not a cold model download.

All four results pass:

| Selected model | Actual backend | Main/iframe isolation | New response | UI response time |
| --- | --- | --- | --- | --- |
| Qwen3 1.7B | WebGPU | true/true | Hello. | 608 ms |
| Qwen3.5 0.8B | WebGPU | true/true | Hello | 905 ms |
| Qwen3.5 2B | WebGPU | true/true | hello | 1,135 ms |
| Qwen3 4B | WebGPU | true/true | Hello. | 1,613 ms |

These are one short prompt per model, not a benchmark or writing-quality pass. The engine status must match both the exact selected model id and WebGPU. The actual native editor must reach document/full-API readiness. The controlling worker must be `/sw.js?isolation=1`. Responses are read only from message rows added after sending this request, excluding restored history. Each row requires a nonempty new response, no visible errors and no page errors.

All four random uncached requests fail. `navigator.onLine` is **true** in the reports because the COOP navigation resets Playwright's emulated offline state. It is not represented as false. The unreachable proxy, which is configured at browser launch and has no loopback exemption, remains the network barrier. This follows the preceding dead-proxy control evaluation rather than relying on navigator status.

The failed-request records also include native spellchecker scripts. Full native API and model inference succeed, but these reports do not prove offline spellchecking. They are retained rather than omitted.

Artifacts: the probe and four `2026-10-03-isolated-gpu-offline-{1_7,0_8,2b,4b}.json` reports. Root lint and probe oxlint pass. No product build or full-unit-suite run is newly claimed for this evidence-only change.

## Next integration scope

The GPU compatibility gate is satisfied for cached inference on this Chromium/Metal setup. Cross-origin embedded editors remain a separate gate before global hosting headers are enabled. Their document may carry COEP while lacking actual isolation capability because the parent is nonisolated. The existing registration condition uses actual `crossOriginIsolated`, and the separate protocol-based embedding diagnostic now confirms this case blocks the old cached native iframe. Adding only response metadata preserves 122,834 bytes exactly and restores native readiness. The hosting-policy decision still needs a product fix before enabling global headers. The separate embedding probe uses the supported parent-message protocol and a successful nonisolated control; an initial `new=docx&embed=1` probe did not request a document because embedded mode deliberately ignores new-document startup, and cannot support a regression conclusion.

The broader local-AI objective remains active, including deployed configuration, supported device behavior and model quality.
