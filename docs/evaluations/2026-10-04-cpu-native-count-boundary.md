# Exact native context/output boundary diagnostic

The isolated Chromium CPU instance used context 256, context shifting disabled, and max output 16. Full prompts were constructed by searching actual native counts; no token-per-character assumption was used. The run and verifier passed.

| Actual input tokens | Actual output tokens | Outcome |
| ---: | ---: | --- |
| 239 | 16 | Completed with output limit |
| 240 | 16 | Completed with output limit |
| 255 | 1 | Context capacity curtailed output |
| 256 | — | Explicit context-size rejection |

For the first three, generation's prompt usage matched preflight exactly. After the 256-token refusal, a valid count and greeting generation succeeded without reloading. The probe's fits boolean illustrates `prompt + max output + 1 <= context`; it is not an implemented product guard. The 240 case produced all 16 requested tokens, so this test does not establish an extra one-token margin as a strict requirement. It does establish that input fitting by itself cannot guarantee requested output capacity. The extra margin is conservative, consistent with the native stop check involving `prompt.n_tokens() + 1 >= slot.n_ctx` when shifting is disabled.

Evidence: [raw capture](2026-10-04-cpu-native-count-boundary.json), [driver](probe-cpu-native-count-boundary.mjs), [verifier](verify-cpu-native-count-boundary.py). Source/parser/native artifact hashes and incremental results are retained. The loop catches expected boundary errors; no uncaught page errors were recorded. Browser and local server closed. No editor operation or product change.

This small synthetic capacity test does not certify the production 2048-context budget, default shifting behavior, GPU path, every generation length, or other models. Next validate the application's actual complete request and history-trimming policy with this count interface, retaining current document/user content and complete tool pairs. Production integration remains pending lifecycle/browser and artifact packaging acceptance.
