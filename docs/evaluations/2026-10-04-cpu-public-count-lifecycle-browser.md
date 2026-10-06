# Source-built lifecycle browser regression

Actual Chromium CPU compatibility execution completed without page errors using the SDK rebuilt from the source lifecycle patch. Native JS/WASM hashes are unchanged. Four repeated counts match actual prompt usage (16, 25, 45, 30), overflow detection and unsupported-content recovery still pass.

After those native generations, two public count requests are submitted without awaiting them and the SDK exits immediately. Both reject with Wllama worker terminated. A retained old proxy also rejects a later request with that terminal error. This validates source-built SDK pending-request retirement against a real browser Worker, not only mock transport. It does not establish that the native count was already executing when exit occurred, nor test application Stop or fresh model reload after exit.

The previous mock-transport diagnostic covers object-valued native abort and a throwing logger. This browser run covers successful native operation and pending-request exit; it does not repeat a real native initialization failure. All evidence remains isolated from installed product dependencies and editors.

Provider source inspection confirms exact count must include the final system prompt and response schema inside its existing serialized queue. The current byte budget executes before provider system-prompt injection, so product integration remains incomplete.

Verification: `python3 docs/evaluations/verify-cpu-public-count-lifecycle-browser.py`.

Verifier correction: the retained-proxy late request is also observed by the action instrumentation, giving 14 count_chat calls (11 normal, two pending, one late). The initial assertion expected 13 and failed; the corrected assertion passes against unchanged raw evidence. Observed calls do not imply successful native execution.
