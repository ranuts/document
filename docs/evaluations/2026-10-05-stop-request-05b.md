# Same-harness 0.5B history contrast

Three fresh native CPU 0.5B runs completed with driver/protocol frozen at e31514f. Their complete requests match the earlier 3B diagnostic exactly, and native WASM/served SDK identities match. Same temperature 0.7/top_p 0.8, nonstream mode and 32-token cap; only local model identity differs. No fixed seed, one sample each, fixed order.

| Shape | 0.5B result | 3B recorded result |
| --- | --- | --- |
| Original system/user/user | Starts a new clock story and reaches length limit; does not begin with BRAVO. | BRAVO, stop |
| Truthful assistant stopped boundary | `已停止。`, stop; echoes status instead of answering current request. | BRAVO, stop |
| System/current-user only | BRAVO, stop | BRAVO, stop |

The 0.5B original result is truncated, so no complete-answer quality claim; its old-story prefix already fails the current label-only instruction. Same-harness fresh-only success localizes this observed small-model failure to the presence/representation of historical context more strongly than the earlier unmatched UI runs. It does not prove parameter count alone causes the difference or establish a general small-model ranking. Dropping all conversation history would violate the intended chat behavior; it is a diagnostic control, not an adopted fix.

Current native UI diagnostics showed an interrupted user request without the actual partial assistant response in model history. A truthful partial-response representation, while retaining completed earlier turns and current intent, remains a relevant next diagnostic. The simple stopped-status insertion failed and is not adopted. Existing case texts are now observed development data; any general strategy needs unused multi-turn transfer and persistence/tool/cancellation regression.

Model SHA-256 matches the known 491400032-byte artifact; WASM and actual served SDK identities verify. Every engine exited, context closed, no captured page errors, process exit 0. No product source/default changes. This standalone JSPI diagnostic is not real Stop, GPU/mobile, latency benchmarking, offline/PWA or privacy acceptance.

`python3 docs/evaluations/verify-stop-request-05b.py` checks frozen source/probe, exact variant requests, model/runtime identity, cleanup and cross-model request/runtime equality. It prints actual finish reasons and replies; mechanical verification does not turn the two semantic failures into passes.
