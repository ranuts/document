# Current-build offline Word save and reopen

The production build completed successfully before this run. Served core was `1791345713`, with `editor-C3APg_Fa.js`; application source checkpoint was `8e73aec`. The warmed persistent desktop Chromium profile contains previous caches, so this is not fresh-install or physical network-isolation evidence.

The [chain receipt](2026-10-07-cpu-offline-word-chain.json) records closing the initial browser process, restarting with browser offline emulation, loading the shell from its service worker, loading the cached CPU Qwen3 0.6B model, executing an exact selected-text replacement, and exact native Undo/Redo. Save produced a DOCX. Independent ZIP/XML inspection found exactly `OFFLINE_CHAIN_20261007` in `word/document.xml`.

A separate [reopen driver](2026-10-07-cpu-offline-word-reopen.mjs) restarted the browser again in offline emulation and opened that saved DOCX through the homepage file chooser. The [receipt](2026-10-07-cpu-offline-word-reopen.json) records service-worker shell delivery and exact native text `OFFLINE_CHAIN_20261007\r\n`, with no page errors. Both browser processes closed. Request-aborted failures are retained in both receipts; this is not a zero-failed-request claim.

The [bindings](2026-10-07-cpu-offline-word-bindings.json) preserve driver/receipt hashes and the locally retained saved-file hash. No additional inference was performed during reopen. This does not establish multilingual generative fidelity, fresh PWA installation, WebKit, Windows/mobile devices, or the complete Word/Excel/PPT offline matrix. Those remain required.
