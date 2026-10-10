# WebKit offline document operation

The fresh WebKit 27.2 run passed with the rebuilt product CPU runtime and no Blob-read monkeypatch. Online load took 59,017 ms; offline page/model readiness took 4,265 ms. The driver explicitly selected `tools` mode before submitting the unchanged general instruction `Insert the exact text WEBKIT_OFFLINE_WRITE_20261007 at the cursor.`.

Native Word text became exactly `WEBKIT_OFFLINE_WRITE_20261007\r\n`; Undo restored `\r\n`, and Redo restored the inserted text. The report records no chat error, no preview, and closed browser/context. This corrects the prior driver-mode error without replacing its archived observation.

The browser stayed in one context: this does not prove browser-process restart, saved-file reopen, physical Safari/mobile coverage, arbitrary document operations, or seven-language generative fidelity. Offline request failures for the service-worker script and spelling resources remain recorded.
