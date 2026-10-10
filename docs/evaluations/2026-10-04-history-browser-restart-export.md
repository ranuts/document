# Browser restart and history opt-out

Actual Chromium persistent-context launches used a fresh task-owned profile. The source store and visible history controls ran in an isolated Vite harness on the same origin throughout. The browser was closed normally and a new persistent context launched with the same profile, rather than merely refreshing a page. No product changes.

After explicit saving and flush, the first restart recovered the same conversation ID and exact message strings, including Chinese, emoji, real newlines and literal backslash-n. A real downloaded JSON file contained those exact messages. The save checkbox was then unchecked, and memory replaced with a distinct unsaved message. After a second normal browser close/relaunch, saving remained off and the new in-memory conversation was empty. Clicking the visible Restore button recovered the previously saved version, proving the opt-out message had not replaced that version. No page errors occurred; final browser and server closed.

This covers normal browser restart, opt-in preference persistence, opt-out behavior and native export for one conversation on Chromium. It does not prove crash/power-loss durability, storage eviction resistance, private mode, other browsers or OS restart. The diagnostic PID field is null because this Playwright API does not expose a process handle; restart evidence is the awaited close and separate persistent-context launch in the hash-bound driver. The temporary profile is retained as a task artifact. No model, native editor or production service-worker integration was exercised.

Run `python3 docs/evaluations/verify-history-browser-restart-export.py` to check source/probe hashes, exact restored/exported data and opt-out behavior against the raw report.
