# Excel neighbor preservation: incomplete save probe

The driver `probe-excel-neighbor-im.mjs` seeds a 3×3 sheet using the native editor API, including two formulas, then requests an IM write to B2. It compares neighboring values and formulas, invokes native Undo/Redo, clicks the toolbar Save button, and intends to reopen the downloaded workbook.

The run terminated with a 120-second download-event timeout. No saved artifact was created. The owned persistent Chromium context was closed in `finally`. No page errors or visible IM errors were recorded.

The console reached `xlsx native Save`, which occurs after the in-memory neighbor and history assertions. However, the driver only appends the result row after successful reopening, so the raw JSON has `results: []`. The native snapshots were therefore not retained: this run is **not sufficient acceptance evidence** for neighbor preservation, formula preservation, Undo/Redo, or persistence. Do not treat the timeout as proof of a product export defect; the click, modal state, and native export diagnostics were not captured.

The next probe must retain its row before Save, capture save UI/export events and any dialogs, verify seed values/formulas independently, and then distinguish an untriggered save from an export failure. Preserve this driver and raw result as the failed diagnostic rather than overwriting their hashes.

Runtime scope: warm owned Chromium profile, current preview isolation headers, service workers blocked, GPU model. No real-device, complete-workbook, offline, performance or privacy certification.
