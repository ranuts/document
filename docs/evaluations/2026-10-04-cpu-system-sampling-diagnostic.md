# CPU system instruction / sampling: no default adoption

Predeclared 2x2 diagnostic: current document assistant system instruction versus “You are concise. Answer in English.”, each at temperature 0 and 0.4. Four known inputs, one sample per cell, fixed order and new conversation each. Actual native SDK capture proves all 16 requests use the same contextual user input per case, top_p 0.8, max_tokens 96 and streaming. Only system text and temperature change. Route interception was observed with Service Worker bypass; real CPU Qwen3-0.6B, unchanged dist, browser closed.

| Case | Observation |
| --- | --- |
| English one-sentence greeting | Current system returns Hello plus a follow-up question; concise system returns Hello. Temperatures matched within each system pair. |
| Synthetic privacy marker | Current system repeats the marker (temperature 0.4 drops the Chinese suffix). Concise system says the marker is for local data only, an interpretation of its label, not evidence of actual privacy behavior. The request asks only to reply briefly, so this is not an exact-echo acceptance test. |
| English arithmetic, number-only | Every cell returns 7 + 8 = 15, sometimes with a period, instead of only 15. Neither system/sampling change fixes the explicit output instruction. |
| Chinese nonpayer identification, name-only | Current temperature 0 returns Mira; current 0.4 returns Mira没有付款。. Both concise-system cells return Mira did not pay Oren. Concise English output follows the experimental English system direction but loses the user's requested name-only answer. |

The prior irrelevant editor-scope answer was not reproduced here. Those earlier runs also differed in message wording, top_p and custom instructions, so this diagnostic cannot establish its unique cause. One sample per temperature does not measure variability or rank settings. Four simple cases do not certify document-bearing factual writing, negation/actor preservation across tasks or multilingual acceptance.

Do not change the default system instruction or generation parameters on these results. A shorter greeting does not compensate for format/language-task losses. No visible errors or previews occurred, but no native document edit/Save acceptance was attempted. The probe scope text retains its inherited “current/request-first order” phrase; actual variants and captured requests are the four factorial cells described here. Run verify-cpu-system-sampling-diagnostic.py for exact captures, parameters and constant user/context. Further work needs fresh representative writing tasks and repeated sampling before a quality decision.
