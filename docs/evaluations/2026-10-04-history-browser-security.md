# Persisted conversation rendering in Chromium

A fresh Chromium context saved 48 messages through the production conversation
store with explicit saving enabled, awaited its disk queue, and reloaded the
page. A new store then restored the actual IndexedDB record. The recovered
messages matched the original messages exactly. Production `historyToTurns`
and `ChatView` rendered twelve hostile payloads for each of user, assistant,
tool guidance and error guidance.

All 48 restored turns contained no executable/resource elements or event-handler
attributes. The script sentinel remained zero; no content-induced requests,
dialogs or page errors were observed. Monitoring of content-induced requests
began after reload dependencies reached network idle. The harness had no CSP,
so policy enforcement did not mask unsafe rendering. Its owned Chromium
browser and temporary Vite server closed in `finally`.

This covers actual browser persistence, reload, history conversion and rendering
for these samples. It does not establish safety of all payloads, conversation
titles in the full panel, deployed integrations, inference transport, Worker
requests or offline startup. It changes no product behavior. The driver and
five relevant source files are bound by SHA-256 in the raw report; run
`python3 docs/evaluations/verify-history-browser-security.py` to verify it.
