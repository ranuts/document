# Current-build offline PPT save and reopen

Warmed desktop Chromium profile, browser offline emulation, preview origin still running. Current application build uses `editor-C3APg_Fa.js`, core `1791345713`. This is not fresh-install, installed-PWA or physical network-isolation evidence. No capability overrides, prompt/default changes or test-runtime substitutions were introduced.

The [chain](2026-10-07-offline-ppt-chain.json) loads the cached default CPU Qwen3 0.6B model, adds one exact text box through the actual AI tools interface, and records native slide-tree text before/after/Undo/Redo. Undo restores the original two empty placeholders; Redo restores the added `OFFLINE_PPT_20261007` text box. Native Save produced a PPTX. Independent ZIP CRC and slide XML inspection found the exact marker.

After closing that browser, a [separate offline restart](2026-10-07-offline-ppt-reopen.json) opens the saved PPTX through the cached homepage file chooser. Its native slide-tree text matches the full previous after-state exactly. Both shell responses came from the service worker; page/chat errors are absent. Recorded aborted resource requests remain in receipts; this is not zero-request-failure certification. Both processes closed.

[Bindings](2026-10-07-offline-ppt-bindings.json) retain driver/receipt and local saved-file identities, plus asset hashes observed after the runs. There was no independent pre-run asset hash certification for this check. The binary remains local rather than committed. Exact text/history is not rendered layout fidelity, seven-language generation accuracy, arbitrary slide operations or the full physical-device/offline matrix. Those requirements remain open.
