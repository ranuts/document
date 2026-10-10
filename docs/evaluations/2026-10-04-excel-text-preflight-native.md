# Excel literal-text target preflight

Added assertExcelTextWritable to read target restrictions before history, selection or format changes. It checks loaded API, native inspection capabilities, shell/view/canEdit readonly states, sheet/user-range protection and merged target. The supplied native range and cell must belong to the originally captured sheet. It currently rejects any protected sheet, including unlocked cells; this does not establish all protected-sheet permission combinations.

Eight unit cases cover normal range forwarding, three readonly states, sheet/user-range protection, merged cell and loading editor. The initial test failed before the implementation existed.

The native probe compiles exact source and records its hash. Using original SDK operations it seeds B2=30, creates a B2:C2 merge, undoes that merge and enables real worksheet protection through asc_getProtectedSheet/asc_setProtectedSheet. A normal cell passes, the merged target rejects with officeMergedTarget, and the protected worksheet rejects with officeProtectedRange. Snapshot value/format/history index/point count and actual protection/merge flags remain identical before/after every preflight. No page errors occur. Native readonly and user-protected-range permission combinations remain unit-only here.

Full suite: 125 files / 4,348 tests passed; TypeScript, scoped lint and whitespace checks passed. Existing PromiseRejectionHandledWarning messages remain. This helper remains unused by set_cell. Next integrate blocking action, pending-edit ownership and the verified history/format/paste components into the writer; then wire explicit text mode and verify actual IM/save/reopen. The leading-zero defect is still open.
