# Native PPT selected-text capture

PPT tool targets now capture the exact selected text and expose its length in the model's document context. This is a prerequisite for the existing `replace_selection` tool; that tool remains unavailable for PPT. No UI, preview card or confirmation was added.

The reader decodes native character items and derives the selected UTF-16 offsets from run selection boundaries. It normalizes paragraph/soft-break separators to LF, retains tabs and supplementary Unicode, supports reversed selections and contiguous selections across paragraphs/hyperlinks, and skips zero-width bookmarks. It independently compares the captured substring with the SDK's selected-text API using explicit tab and numbering options. Unknown structures, invalid boundaries, discontinuous selections and mismatches return no verified selection.

The native probe loaded the current reader source as a same-origin script into an isolated Chromium production PPT editor. Its service worker was disabled only to make the test script route reachable. It did not call a model or the IM replacement path.

[Native report](2026-10-03-ppt-selection-reader-native.json) contains six independently specified expectations: first occurrence, second repeated occurrence, emoji plus tab, second emoji occurrence, reversed selection, and a selection spanning two paragraphs. All six match exactly. Reading leaves native selection state and history point/item identities unchanged.

Eleven new regression cases cover canonical capture, invalid boundaries, unknown characters, discontiguous runs and the target/context integration. All 111 test files / 4023 tests pass; production build and lint pass. A second full run with warning traces also passes and identifies two asynchronous promise-rejection-handled warnings in existing `converter-wasm-loading.test.ts:130` and `x2t-helper-loading.test.ts:117`; no test fails. Independent review found no critical or important issue.

Remaining implementation: dispatch PPT replacement to native plain-text paste within an owned history transaction; verify the exact captured offset, surrounding text, native shapes and formatting; prove Stop, late callbacks and prior Redo preservation; then expose the tool in the PPT planner and validate real local-model IM calls. This reader alone does not prove formatting preservation or successful replacement.
