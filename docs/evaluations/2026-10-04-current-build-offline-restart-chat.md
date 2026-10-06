# Current-build cached offline restart

The owned GPU profile has previously downloaded model files. The app shell was seeded online with the current build, and the browser closed normally. A new persistent browser context launched with the same profile, then offline mode was set before navigating to the native Word editor. Both seed and offline resource lists contain the current dist plugin filename, agent-plugin-C-jPlh6f.js; stale historical plugin success is not accepted by the driver.

Offline app navigation, service-worker control and cross-origin isolation succeeded. Actual Qwen3-1.7B WebGPU loaded and streamed Hello with the configured generation parameters. navigator.onLine was false. No observed offline requests were external or had request bodies, no visible/harness errors, zero previews. Document text remained unchanged because this is a chat-only greeting; Undo/Redo equality is a non-mutation check, not a document-edit test. Browser closed after completion.

This updates cached-process-restart evidence for the current build. It is not an empty-cache test, physical network disconnection, complete egress audit, eviction guarantee, mobile compatibility or a quality benchmark. The origin's existing local preview supplies COOP/COEP, and the service worker uses isolation=1; deployments without equivalent isolation are not certified. No product changes or model/default changes.

Run `python3 docs/evaluations/verify-current-build-offline-restart-chat.py` to inspect probe identity, both current-bundle resource observations, actual Worker model input, offline state and chat/non-mutation outcomes. The raw report preserves observed resource/request lists. Success does not close the broader multilingual writing quality gate.
