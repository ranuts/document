# Current CPU/GPU chat: observed network content

Actual current-built native Word IM with a unique synthetic message marker LOCAL_ONLY_7f39e2_中文. The probe records URL, method and body on Playwright page request events from before navigation through model loading and response. Models/app caches were warm and the browser remained online. Browser contexts closed after each run.

| Backend | Observed requests | Request bodies | External origins | Marker in decoded URL |
| --- | ---: | ---: | ---: | ---: |
| Actual CPU Qwen3-0.6B | 106 | 0 | 0 | 0 |
| Actual WebGPU Qwen3-1.7B | 98 | 0 | 0 | 0 |

All observed requests were GET to local origin or local blob URLs. Current built plugin was present in both resource lists. GPU Worker request model IDs match Qwen3-1.7B; the CPU run uses the previously described injected GPU initialization failure to select the real cached CPU model. Empty WebLLM input capture on CPU cannot prove CPU parameters. Both returned text and statistics; documents stayed unchanged and preview count was zero. CPU returned irrelevant editor-scope wording, GPU merely echoed the marker. Neither response establishes useful answer quality.

Static current-source inspection: local.ts only constructs local SDK providers; wllama.ts passes messages to createChatCompletion, WebLLM passes them to engine.chat.completions.create. model-source.ts permits custom HTTP/HTTPS directories and WASM artifact URLs. The Worker CSP in public/_headers permits self, HTTPS, HTTP and blob connections. A fixed CDN-only allowlist would break the explicitly supported custom/self-hosted sources; the policy needs a deliberate source configuration strategy before narrowing.

This evidence establishes only the observed page-associated request path in these two warm-cache synthetic conversations. It does not certify first-download redirects, all browsers/devices, service-worker-independent requests, request headers, other browser processes, malicious custom WASM, every editor/plugin integration or deployment-wide privacy. Capturing no external requests in a warm run cannot establish a restrictive CSP. No source permissions were changed in this turn. Run verify-chat-network-content-audit.py for probe hashes, exact observed request assertions, current bundle and backend/native mechanics.

Next network work should include a controlled cold model download and configured self-hosted origin, separately inspect deployed Worker/iframe policy enforcement, and define which configurable model origins the app should allow. Continue factual-writing and accurate token budgeting work; these isolated network observations do not resolve those failures.
