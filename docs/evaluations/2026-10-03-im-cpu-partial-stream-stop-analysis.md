# CPU stop after actual visible output

The earlier CPU Stop test interrupted a pending response before visible text. This probe closes that specific gap with actual production CPU Qwen 0.6B generation, using the cached model in isolated Chromium with WebGPU disabled. A short counting request was used because the earlier long essay timed out; this is not evidence of general writing quality.

The model streamed `1,2,3,`. Clicking the visible Stop terminated its native blob Worker (created 1, terminated 0 → 1), and the input became editable after 28 ms in this single run. The partial answer remained exactly unchanged after a further 1500 ms. The stopped message was a plain status with no error border or insert action.

Restore request filled the exact original prompt without creating another user turn or executing it. A new draft disabled restore to prevent overwriting. Reinitialization created a fresh Worker (created 2, terminated 1); a manually submitted next request returned `hello.`. No page errors, visible errors or preview cards were observed. The narrow dark screenshot was visually inspected.

The archived probe and its hash are recorded in the report. This was evidence-only work with no production code change. The result is one runtime observation, not a latency benchmark, physical mobile result, native document Save check, or model writing-quality pass. The next substantive gap is diagnosis of actual selected-text rewrite failures and validation of factual and stylistic quality.
