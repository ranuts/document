# Empty model cache and blocked downloads

A new Chromium context had no app/model storage. Local app resources remained online; every external HTTP request was explicitly aborted with internetdisconnected. Service workers were blocked to keep this a fresh model-cache test. navigator.gpu was made unavailable, while provider remained automatic webllm mode.

Automatic CPU fallback attempted the pinned Qwen3-0.6B GGUF static URL, failed, displayed Model loading failed. Retry loading or choose another model., and re-enabled the visible model-load button. Manual retry made another attempt and returned the same usable error state. Exactly two observed external HEAD requests targeted the GGUF file, with zero body bytes. No page errors or cloud inference request was observed. Browser closed. No model was downloaded and no product changed.

This validates model-cache absence/download failure and retry, not full offline app navigation or all possible egress paths. Fresh context storage and abort route establish the controlled conditions. General failed-network guidance omits the first-download network requirement; that is an identified UX improvement, not a claim that all first-use experience is complete. Source snippets in settings were recorded as text, not secrets/provider credentials.

Run verify-empty-model-cache-download-failure.py to inspect probe identity, failure/retry state and the exact observed static request scope. Warm-cache offline successes remain separate evidence and do not imply empty-cache offline availability.
