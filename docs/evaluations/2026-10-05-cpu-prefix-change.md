# Changed-suffix native CPU cache result

Four actual native CPU Qwen2.5 0.5B completions finished using the driver frozen at ac47b66. Each fresh engine received ALPHA then BRAVO with the same long reference prefix and generation settings; only cache_prompt differs between omitted/false modes. The isolated diagnostic page uses injected COOP/COEP and direct packaged SDK, not the product UI. Actual served client SHA-256 matches the recorded disk identity. Model/WASM identities and browser cleanup verify.

| Mode | ALPHA / BRAVO wall time | Cached prompt tokens |
| --- | --- | --- |
| Omitted | 20628.105 / 818.935 ms | 0 / 661 |
| false | 20143.025 / 20219.980 ms | 0 / 0 |

Prompt counts are 674/675 tokens respectively. Both modes return `ALPHA.` then `BRAVO.`. The current label changed correctly in this small test; the trailing periods violate literal label-only formatting, so strict form acceptance is not claimed. Default mode reused the common prefix despite the changed suffix. The false-mode contrast and native counters strengthen attribution beyond ordinary warmup, but fixed order/single pairs do not establish general performance.

The four responses support retaining current default cache behavior. They do not establish model writing quality, arbitrary stale-state absence, Stop/cancellation recovery, message trimming, cross-document/session isolation, actual IM responsiveness, other models/devices, offline/PWA or deployed privacy. No product defaults, prompts or UI changes. All engines exited; contextClosed is true, captured page errors empty, process exit 0.

`python3 docs/evaluations/verify-cpu-prefix-change.py` checks frozen driver, mode-matched requests, current-label output with the documented period tolerance, native cached-token contrast, served SDK identity and cleanup. That tolerance assesses the current-label question only, not a revised format criterion. Actual product repeated-prefix requests and controlled interrupted-generation recovery remain stronger next checks.
