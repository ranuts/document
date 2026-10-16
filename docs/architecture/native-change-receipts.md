# Native change receipts

The main editor remains the document canvas. Completed action previews collapse to
an outcome, the captured range/page label, text actions, and a closed change-detail
disclosure. `ui/task-receipt.ts` summarizes actual settled write results in one
collapsed row. Verified, sent/unverified, failed and cancelled results have separate
counts; reads, plans and model claims never increment the verified count. Every
write still has its own review. A summary grants no future tool permission.

## Location capabilities

| Editor     | Supported location                                      | Boundary                                                                                                                                                                            |
| ---------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Word       | Captured selection/cursor hint and original/result diff | Selection state is not a stable cross-edit anchor. No guessed duplicate-text search, hidden bookmarks, document formatting, or synthetic canvas highlight.                          |
| Excel      | Native `wb.scrollToCell` for the explicit destination   | Requires the captured API/document and active worksheet model identity. Does not change selection, cell values or history. Cursor changes alone do not expire a completed location. |
| PowerPoint | Native `goToPage` for the captured slide object         | Re-resolves its current index after reorder. Unknown page, deletion, replacement or document replacement refuses location. Duplicate text never selects a substitute slide.         |
| PDF        | Existing page/range hint and review                     | No unsupported body anchor is invented.                                                                                                                                             |

Post-write location uses the verified continuation target. Pre-write selection and
history freshness still protect execution; they do not unnecessarily invalidate a
completed receipt when a user moves their selection. Location failure appears next
to its action and does not overwrite the verified application outcome.

## One owned Word Undo

`word-paste.ts` mints a volatile completed receipt only after
`beginWordPasteHistory.commit()` and native HTML paste cleanup. The bundled
`asc_PasteData` opens `historydescription_Document_PasteHotKey` (159). The receipt
requires that exact known constant/description, a nonempty single owned point,
`canEdit()`, no long action, no group action, known single-user collaboration state,
no global lock, no read-only mode, and register/unregister callback capability.
GroupPoints, typing/composite points, unknown native writes, other editors and
collaborative sessions have no custom Undo capability.

`completed-paste.ts` captures the history/Points array identity, exact current tail
index, every prefix/tail point, every item identity, and descriptions. Immediately
before Undo, a synchronous read checks that proof plus current document identity
and editor readiness. It then consumes the receipt before invoking **one** native
`api.Undo()` and verifies the preceding index and retained redo tail. A failed native
verification is reported as uncertain; it is never automatically retried. The
receipt never truncates native history or calls an arbitrary Undo loop.

The real `asc_onUndoRedo` event permanently invalidates a receipt, including a user
Undo/Redo round trip that restores the same tail. Later edits are caught by the
exact tail check. A newly started paste disposes the previous active receipt for
that API. A document replacement observer, preview replacement, conversation clear,
page hide and panel teardown remove only this receipt's own callback. Disposal
releases its prefix/item snapshot copies. Other SDK callbacks remain registered.

Tool results stay serializable: a WeakMap associates a result with a receipt until
`DocumentToolAction` or `ReviewedAction` claims it. Native objects/functions are not
persisted in conversations or sent to a model. Failed/unverified execution disposes
its receipt. Unsupported/expired Undo explains that editor Undo may include later
user edits. A location/Undo refusal never retroactively changes a verified apply
into a failed apply.

## Regression evidence

- Unit: exact foreign point/item/prefix/description replacement, appended history,
  Undo/Redo invalidation, expiry/disposal, one-shot consumption and uncertain Undo.
- Native adapter: unavailable callbacks, grouping/collaboration/read-only/busy,
  retained redo point, 50 writes with a constant owned callback count, document
  replacement and preservation of foreign callbacks.
- Real editor browser: Word receipt Undo and native Redo; refusal after a later
  user edit or native Undo/Redo; Excel locate after changing selection; PowerPoint
  locate after native slide reorder. No vendor SDK files are modified.
