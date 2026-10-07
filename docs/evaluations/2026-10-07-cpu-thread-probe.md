# Current CPU thread observation

A fresh Chromium context loaded the local Gemma candidate through the real application CPU provider. The SDK load hook recorded requested n_threads=4, n_ctx=2048, n_gpu_layers=0 and reasoning=false; after loading, getNumThreads() returned 4 and isMultithread() returned true. The page reported crossOriginIsolated=true, hardwareConcurrency=10 and SharedArrayBuffer available. No inference was requested; browser closed without page errors.

This rules out a missing multithread configuration for this observed load only. Prior sampling runs did not capture actual threads, so this probe cannot certify their configuration retrospectively or explain their latency. It does not test performance, output quality or physical device coverage. No production setting is changed. Further performance comparisons must capture threads and native timing in the same run and control concurrent host activity.
