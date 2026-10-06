# Native literal text strategy investigation

The actual local Excel editor was exercised directly using native APIs; these are strategy probes, not acceptance of a changed IM implementation.

## Rejected prefix strategy

Prefixing a single quote through `pluginMethod_PasteText` stores that extra quote as part of the text. Seven values were tested: 00123, 1e3, 2026-10-04, 99, an existing leading quote, ordinary text and a twenty-digit identifier. Both formatted and raw/edit readback contain the unwanted quote. Undo and Redo work, but fidelity fails. Original verbose-format diagnostic and compact readback evidence are both retained.

## Promising format transaction

A separate native probe starts a history point/transaction, temporarily applies @ text formatting, pastes the original value, waits for the native change, restores General formatting and ends the transaction. For all seven values, raw/edit/display values match the supplied string, cell type is text, and General formatting is restored. One native Undo returns the prior numeric 30 cell; Redo restores the exact text cell. No page errors occurred.

This probe used General cells, isolated editor fixtures and fixed observation waits. Production must preserve the actual original format, wait for native completion rather than copy the probe delay, close transactions on failure/Stop, handle protection and avoid contaminating unrelated edits. The proposed strategy is not yet integrated into set_cell or accepted for all formats. Existing exact write verification must remain.

Run `verify-excel-native-literal-text.py` to check both the rejected path and the successful strategy evidence.
