# Bind native format restoration to the original cell

Implemented captureExcelCellFormat to capture the original number-format string and native cell setter/receiver. Its frozen binding restores the captured cell even if active worksheet/selection changes. It does not enforce document/history identity or mutation preflight; those remain caller responsibilities.

Three tests cover restoration after destination changes, native method receiver/captured method identity and rejecting missing format before mutation. The missing implementation test failed before the helper was added.

Native probes compile current source for the binding, format scope, callback guard and completion adapter, recording all source hashes. Normal General and 0.00 cases preserve exact text 00123 and original format; one Undo/Redo returns exact before/after snapshots.

A controlled delayed-font probe adds a second worksheet containing B2=SECOND with 0% format. While original-sheet paste is paused, native API switches the active sheet from 0 to 1 and aborts. Cleanup restores the original-sheet cell format through its bound range. Releasing the delayed original native callback does not insert content. Both sheets' full B2 snapshots remain unchanged: original numeric 30/General or 0.00 and second-sheet SECOND/0%. No page errors occurred. This tests original-cell binding within one workbook, not replacing the document/global history.

Full suite: 123 files / 4,334 tests passed; TypeScript, scoped lint and whitespace checks passed. Existing PromiseRejectionHandledWarning messages remain. These components are still unused by set_cell. Blocking/native ownership, preflight protected/merged targets, old Redo recovery, text-mode schema/planning and actual IM/save/reopen remain before acceptance of the leading-zero fix.
