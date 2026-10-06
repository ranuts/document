# Complete spreadsheet range reads

Root cause: the document tool registry offered single-cell reads but no range read, allowing a range request to become a successful single-cell result. Added read-only get_range with existing native worksheet APIs. It reads every cell in the explicit region, includes cell addresses and JSON-quoted values (preserving blank/newline distinctions), never moves selection, and rejects ranges exceeding the existing 5000-cell bound or 80000-character output limit without returning a partial result. Abort signals are checked during iteration.

The reproduced complete Chinese and English range-read commands are recognized before model planning and retain the exact range. Other requests can select the registered tool through normal structured planning. The ordinary IM tool-message text displays results; no preview or confirmation UI was added. This bounded recognition is not a general natural-language range-intent guarantee.

Before implementation, both complete-range regression tests failed because get_cell/A1 was returned. After implementation, the full suite passed 118 files/4289 tests; root TypeScript, scoped lint and build passed. Existing asynchronous rejection warnings remain in the full-suite output. Execution tests cover all cells, blank/newline values, size bounds and cancellation.

Actual current CPU IM returned all eight A1:B4 cells for both Chinese and English explicit range requests, with no model action required. The two existing B2-only requests still returned 30 through normal inference. All inspected A1:C4 snapshots stayed unchanged, no errors or preview cards appeared, and the bundle stayed unchanged during the probe. The verifier checks every requested address/value and excludes C1 from returned results.

Arbitrary range instruction phrasing, merged/filtered worksheet semantics, GPU tool quality, and overall writing/model/device acceptance remain open.
