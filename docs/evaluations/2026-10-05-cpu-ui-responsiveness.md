# Current CPU IM responsiveness observation

One actual native Word IM run loaded the current production Qwen3 0.6B automatic CPU fallback in warmed desktop Chromium. GPU availability alone was forced off; no SDK requests, outputs, loading results or host operations were replaced. Generation max tokens was set through the UI to 1024, then a long Chinese story request was sent. Passive requestAnimationFrame, 20 ms timer, long-task and input-attribute observers recorded parent IM responsiveness. The actual page was cross-origin isolated.

| Observed phase | Frame callbacks | Median interval | p95 interval | Maximum interval |
| --- | ---: | ---: | ---: | ---: |
| Idle | 241 | 8.36 ms | 10.20 ms | 10.41 ms |
| Actual generation | 426 | 8.33 ms | 10.30 ms | 10.99 ms |
| Stop/model reload | 145 | 8.33 ms | 10.26 ms | 10.40 ms |

The generation observation lasted 3.546 seconds before Stop and captured real partial assistant text. No long-task entries were observed in the measurement window. From dispatch of the actual Stop click to the input's disabled attribute clearing was 7.505 ms. This measures input becoming editable, not model readiness, complete pointer-to-paint latency or INP. The model subsequently reloaded successfully before the probe ended; another immediate generation was not tested. Fixed automation timings and startup effects prevent treating these samples as a benchmark.

The native document stayed exactly its empty paragraph. No error guidance, preview cards or recorded page errors appeared. This checks a chat stream/Stop/reload path, not document edits, answer quality, every task or complete-session responsiveness.

The [raw report](2026-10-05-cpu-ui-responsiveness.json) retains every frame/timer interval, phase timestamps, long-task observations, partial output and document snapshots, plus production plugin and executed [driver](probe-cpu-ui-responsiveness.mjs) hashes. The [verifier](verify-cpu-ui-responsiveness.py) checks that passive samples span idle/inference/recovery, actual partial text was produced, Stop/input ordering is valid, and document/error/closure checks passed. It does not impose a universal performance threshold or certify a device matrix. Browser context closed in finally; terminal exit 0.

This single warm-cache desktop observation supports continued IM event-loop activity during the captured CPU inference. It does not prove physical mobile, slower hardware, memory pressure, every browser, larger models, long sustained inference, download responsiveness, offline/PWA launch, deployed policy or GPU behavior. The application source/defaults remain unchanged.
