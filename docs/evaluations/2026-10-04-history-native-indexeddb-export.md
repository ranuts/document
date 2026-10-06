# Native conversation storage and export

Production conversation store and history controls were loaded in an isolated Vite source harness in a fresh Chromium context. Actual browser IndexedDB and actual download events/files were used, rather than fake-indexeddb or a mocked download callback. No product changes.

Initially saving was off and history empty. Two messages containing Chinese, emoji, real newlines, a literal backslash-n, Markdown and literal script-tag text were added to memory. The visible save checkbox enabled saving; the store flushed before page reload. Reload restored the same conversation ID and byte-for-byte message strings, with saving enabled. Clicking the visible export button produced a successful conversations-date.json download, whose parsed messages matched restored history exactly. Its top-level/session keys contained conversation data, with no provider-settings fields. No page errors occurred and the browser/server closed.

This verifies an opt-in save/reload/export path for one conversation in actual Chromium. It does not establish browser-restart durability, browser eviction behavior, all quota/conflict paths, other browsers, native editor/model integration or that HTML-like text is safe in every renderer. That text is stored/exported as data here. The harness has no production service-worker or offline navigation gate.

Run `python3 docs/evaluations/verify-history-native-indexeddb-export.py` to check source/probe hashes, restoration and the actual downloaded JSON contents recorded in the matching raw report.
