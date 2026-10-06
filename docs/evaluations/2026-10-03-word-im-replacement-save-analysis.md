# Word replacement Save/reopen

[Production result](2026-10-03-word-im-replacement-save-roundtrip-sw.json) verifies the updated asynchronous Word replacement path with actual local Qwen3 1.7B inference, production bundle `editor-XEpe337s.js`, native toolbar Save download and homepage file chooser reopen in isolated desktop Chromium. Service Workers were allowed and network was available.

The selected `Alpha` was replaced with multiline Chinese/English data containing literal `<b>Alex & Co</b>`, a number, date, negation and leading/trailing spaces. Native Save produced a nonempty DOCX without download failure. Its `word/document.xml` contains exactly the expected text after normalizing native CR/CRLF line endings to LF. The neighboring paragraph and unselected suffix remain present. Original-document Undo/Redo and reopened paragraph/character-format snapshots are exact. There were no captured page errors or visible operation errors. The report records the file's SHA-256 and extracted paragraph data.

[Controlled baseline](2026-10-03-word-im-replacement-save-roundtrip.json) blocked Service Workers in the harness. File content and reopen checks still passed, but the homepage emitted `Cannot read properties of undefined (reading 'waiting')`, so its overall `allPassed` remains false. Normal Service Worker operation did not reproduce this error. This distinction is retained rather than treating the baseline as a clean run.

This proves a download-and-local-reopen round trip for this synthetic document. It does not prove operating-system file overwrite, external Microsoft Word compatibility, complex style/table/comment/review preservation, offline startup or every model's save behavior. No application source or UI flow changed in this evaluation.

## Registration failure follow-up

The homepage helper in `public/sw-register.js` used `.then(wire, rejectionHandler)`: the rejection handler covered registration rejection but did not catch errors thrown by `wire`. Playwright's blocked registration resolves without a registration handle, causing `registration.waiting` to throw. `wire` now ignores an absent handle; `start` also defers registration into a Promise chain and catches failures, including a synchronous registration exception. Existing worker-source and cross-tab editor protection checks remain unchanged.

Two new regression tests failed before the change and pass afterward. All 110 test files (3959 cases), production build, lint and independent review passed. [Three browser cases](2026-10-03-sw-registration-failure-browser.json) cover blocked, explicitly rejected and synchronously throwing registration in fresh isolated production Chromium contexts: no page errors, homepage Open remains visible, and the controlled register function is called once in each injected failure case. These injected cases do not establish actual browser privacy-mode behavior.

[Actual blocked-worker Save/reopen](2026-10-03-word-im-save-sw-block-fixed.json) now passes the same multiline replacement, native toolbar Save download, Undo/Redo and exact reopen check without page errors. This report verifies the previously failing environment; the earlier failed baseline remains intact. The fix adds no visible UI, confirmation or preview.
