# WebGPU Worker response CSP experiment

Candidate response policy blocks string evaluation and foreign module execution while retaining actual cached default Qwen3-1.7B WebGPU initialization and chat. This is an isolated compatibility/security experiment, not a shipped policy or a complete security gate.

The candidate is `default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self' https: http: blob:; worker-src 'self' blob:`. Broad connection permissions intentionally retain configurable model artifact sources; they do not prove prevention of network exfiltration. The policy applies only to the actual hashed WebLLM Worker response, not the app shell, CPU blob Worker or vendor iframe.

## Correcting the test method

The first diagnostic used Playwright Worker.evaluate to execute eval directly. It returned 2 despite the header and must not be used as a CSP negative control. [Chrome DevTools Runtime.evaluate](https://chromedevtools.github.io/devtools-protocol/tot/Runtime/#method-evaluate) exposes `allowUnsafeEvalBlockedByCSP`; debugger-mediated execution can bypass evaluation restrictions. This is a testing-method limitation, not evidence that the actual application Worker can bypass CSP. The failed report is retained as `2026-10-03-gpu-worker-csp-devtools-diagnostic.json`. Its foreign-module failure used an unreachable domain without a successful response control, so it also does not prove CSP interception.

The corrected probe appends a diagnostic timer to the actual Worker response, running evaluation and module import in ordinary Worker execution. It reads only the stored result through Worker.evaluate. A controlled external module response has valid JavaScript, CORS and CORP headers and returns 42; no real foreign server is contacted. Both baseline and candidate append the identical diagnostic bytes. Actual model execution remains the original Worker SDK, not a mock.

| Check                      | No added Worker CSP                  | Candidate Worker CSP                       |
| -------------------------- | ------------------------------------ | ------------------------------------------ |
| Normal Worker eval         | Returns 2                            | EvalError explicitly names CSP restriction |
| External controlled module | Returns 42; route receives 1 request | Import rejected; route receives 0 requests |
| Actual engine/model        | WebGPU Qwen3-1.7B                    | WebGPU Qwen3-1.7B                          |
| Actual chat                | Hello.                               | Hello.                                     |
| Main page errors           | 0                                    | 0                                          |

Both runs use existing cached weights, desktop Chromium/Metal, blocked service workers and injected COOP/COEP. They do not prove fresh model download redirects, other GPU models, offline cached response headers, actual Pages/Docker policy delivery, CPU blob Worker restrictions, native document Save, embedding, physical devices or general adversarial resistance. No product policy/configuration or on-disk Worker bundle changed. Injecting extra script bytes is confined to the diagnostic response.

Reproduce sequentially with `WORKER_CSP_BASELINE=1 node docs/evaluations/probe-gpu-worker-csp.mjs` and `node docs/evaluations/probe-gpu-worker-csp.mjs`, using preview port 5193 and the existing unused GPU profile. Baseline and candidate reports are archived separately; the probe fails if controls do not match expected evaluation/import behavior and request counts or if native chat fails.

Next: cover other configured GPU models and fresh artifact fetches, then integrate exact Worker response policy with matching hosting/cache checks. Keep native iframe dynamic-compilation investigation separate. Do not close the security gate using only this default-model experiment.
