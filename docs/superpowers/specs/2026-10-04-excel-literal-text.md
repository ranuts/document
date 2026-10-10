# Preserve explicit literal Excel text

Purpose: IM requests for literal identifiers such as quoted 00123 must retain the exact text, with no preview or extra confirmation. Plain numeric assignments must keep numeric behavior. Keep native Undo/Redo, original cell formatting and exact readback checks.

Evidence: `docs/evaluations/2026-10-04-excel-native-literal-text.md`. Apostrophe prefix through current paste API adds unwanted content. Temporary text formatting plus native history grouping preserves seven tested literals and one-step Undo/Redo in General cells.

Proposed implementation: retain whether a sequence assignment was JSON-quoted instead of discarding it during parsing. Expose an optional explicit text mode in the validated set_cell schema so generated single plans can request the same behavior. Implement a native single-cell text writer that captures the original number format, groups temporary format/write/restore as one history action, checks native completion, and closes the transaction in every exit path. Use existing document identity and cancellation checks; prohibit unsupported targets before mutation. Do not relax exact verification or infer literal semantics from a small list of problematic values.

Required evidence before acceptance: regression tests for quoted vs plain assignments and schema validation; existing native writes unchanged; real IM literal read/write with original and non-General formats; numeric type retained for plain 99; text type for quoted 99; leading zeros, date-like text and long identifiers; one-step Undo/Redo; native save/reopen; protected/merged behavior; cancellation/failure cleanup with restored format and no leaked history transaction. Investigate existing native paste completion helpers before implementation. A fixed 100ms probe wait is not a production completion protocol.

No product implementation or broad acceptance is claimed by this spec. Work remains inline; no delegation, publish or deploy.

Completion protocol evidence: `docs/evaluations/2026-10-04-excel-native-literal-text-completion.md` verifies native asc_PasteData completion restores both General and 0.00 original formats, exact text type/value and one-step Undo/Redo in fourteen cases. Implement completion ownership around native callbacks, not fixed waits. Abort/failure/protection and origin-document ownership remain unverified for this strategy.

Implementation progress: `withExcelTextFormat` now owns format restoration/history closure around an awaited caller-owned paste. Ten unit cases and fourteen native cases using the compiled source pass; see `docs/evaluations/2026-10-04-excel-text-transaction-native.md`. It remains unused until native delayed-insertion ownership, target guards and validated text-mode integration are implemented. The IM defect is still open.

Cancellation investigation: normal pasteSlideText compatibility passes fourteen native cases, but delayed worksheet._loadFonts exposes late insertion after rejection. Excel text-to-cell paste bypasses API pre_Paste. Do not reuse the PPT adapter for production Excel writes. Implement and verify an Excel-owned protection/lock/font callback guard before text-mode integration. Evidence: `docs/evaluations/2026-10-04-excel-text-native-paste-compatibility.md`.

Callback guard progress: guardExcelPasteCallbacks now owns/restores protection, lock and font callback wrappers and excludes overlapping view owners. Current-source native delayed-font tests suppress insertion after abort in General/0.00 formats; normal tests preserve 00123 and native Undo/Redo. Evidence: `docs/evaluations/2026-10-04-excel-text-paste-guard.md`. It remains unused by set_cell; next build the native completion/cleanup adapter with blocking action and bound cell/history, then wire validated text-mode plans and verify actual IM/save/reopen.

Native completion adapter progress: pasteExcelText now composes callback guarding, native completion, AbortSignal, timeout and caller-bound paste cleanup. Current-source General/0.00 native normal, delayed-Stop and delayed-timeout cases pass (six cases); unit/full tests pass. Evidence: `docs/evaluations/2026-10-04-excel-native-paste-adapter.md`. Next implement bound native writer / blocking / target guards / old Redo recovery before text-mode integration. The IM leading-zero defect remains open.

Cell binding progress: captureExcelCellFormat now binds original native range, setter receiver and format. Native original-sheet 0→1 switching during paused paste followed by abort restores only the captured original cell; both sheets stay unchanged after old callback release. Normal exact text and one-step Undo/Redo pass. Evidence: `docs/evaluations/2026-10-04-excel-cell-format-bound.md`. The next native writer must add blocking action / preflight and old Redo recovery before validated text-mode integration. No IM leading-zero fix is yet claimed.

Redo recovery evidence: native General/0.00 cancellation preserves exact old history point identities, index, StoredData depth and closed group; old Redo 30→40 and Undo 40→30 still work. Excel cancelGroupPoints must be followed by endGroupPoints before preserveNativeRedo.restore, unlike the previous PPT cleanup path. See `docs/evaluations/2026-10-04-excel-text-redo-cancellation.md`. Implement this in a guarded native writer, prove group ownership/preflight/blocking and successful branch disposal, then wire text-mode planning/IM. No leading-zero fix is yet accepted.

History scope progress: withExcelHistoryGroup now implements native success closure / old-branch disposal, cancellation closure / old-branch restore and guarded ownership-loss behavior. Current-source native General/0.00 cases preserve original Redo on cancel and verify exact new text Undo/Redo on success. Evidence: `docs/evaluations/2026-10-04-excel-history-group.md`. Actual foreign-edit and group-opening fault branches remain unit-only. Next compose native writer preflight/blocking/pending-edit ownership with these helpers, then validated text-mode integration and IM/save/reopen acceptance.

Target preflight progress: assertExcelTextWritable rejects loading/readonly/protected/merged targets before mutation. Current-source native merged/protected fixtures reject with value/format/history unchanged; ordinary cells pass. Readonly/user-range cases are unit-only, and protected-sheet unlocked-cell exceptions are not accepted. See `docs/evaluations/2026-10-04-excel-text-preflight-native.md`. Next compose the complete native writer (blocking + pending-edit ownership + these components), then text-mode planning and actual IM/save/reopen.

### Pending callback ownership (2026-10-04)

The paste guard can now capture a separate ownership proof for each native
protection, lock, or font callback. A failed proof closes pending continuations
and notifies the adapter, which rejects immediately. The caller is notified
before paste cleanup so it can disable history rollback after foreign edits.
Ownership is checked before resuming the callback, allowing legitimate insertion
inside that callback to change history.

Validation: 125 test files / 4,351 tests pass; TypeScript and scoped lint pass.
The compiled current-source native probe
`docs/evaluations/probe-excel-native-paste-adapter-ownership.mjs` demonstrates
General and 0.00 targets: a C3 format edit while fonts are deferred invalidates
the pending history proof, B2 remains unchanged, and the C3 edit remains present.
The probe deliberately supplies the proof; a production history snapshot and
full writer integration are still required. This does not fix IM `set_cell`
leading-zero coercion yet, nor prove safe rollback of arbitrary foreign edits.

### Full native writer and IM integration (2026-10-04)

`writeExcelLiteralText` now composes preflight, an interaction mask, owned Excel
history grouping, temporary text format, guarded native completion, exact
readback, and format restoration. Pending-history snapshots detect same-point
appends and replaced points/items/arrays. Stop and timeout inspect the pending
proof before rollback, including when no delayed callback has resumed yet.
A foreign format on the target is preserved. History records are assumed to be
native append-only records; arbitrary mutation inside an existing item payload
is not detected by this structural proof.

`writeExcelCellText` binds the original API/workbook/sheet/cell/history/helper,
checks restrictions before moving selection, and keeps document identity separate
from active selection for restoration. `set_cell` accepts optional
`valueType: "text" | "auto"`; text uses the new writer. Literal read-then-write
sequences preserve JSON quotation as text mode, while unquoted numbers retain
native numeric parsing. The tool schema also exposes text mode to model planning.
No preview or confirmation UI is added. Merged targets have localized guidance.

Current-source native tests cover success, Stop, foreign edit, and foreign edit
followed by Stop, each with General and 0.00 formats. Full tests: 128 files /
4,366 tests pass; TypeScript, scoped lint, and the production build pass.
Actual built IM tests cover quoted 00123 in both formats and unquoted numeric99,
with native Undo/Redo. These literal sequences bypass model planning, so they do
not establish model semantic quality or general composite-operation coverage.
Save/reopen and final-build evidence are recorded separately in the evaluation.
Protected/merged preflight component evidence remains valid; full IM failure,
worksheet/document replacement, and wider history/timeout scenarios still need
end-to-end acceptance. The broader AI scope remains incomplete.

The full writer supplies separate original-history identity to Redo backup
cleanup: after edit ownership is lost, its owned backup is released without
restoring the old branch or undoing foreign edits. The current native matrix
starts with an existing Redo branch in all eight cases and verifies backup depth.

### Target navigation and actual IM negative paths (2026-10-04)

Insertion freshness and history rollback ownership now use separate proofs.
Changing the active selection or sheet prevents the old insertion, but does not
by itself transfer edit ownership. If history remains untouched, Stop can undo
only this operation and restore its preexisting Redo branch. Actual foreign
history edits still disable rollback and merging. A regression test first
reproduced navigation preventing cancellation, then verified the correction.

The actual built IM negative-path probe covers merged/protected targets and
controlled deferred fonts with Stop, target selection navigation then Stop, and
worksheet navigation then Stop. Navigation is issued through native APIs while
the native interaction mask is held; it is not a claim that disabled sheet UI
can be clicked. Original target values/formats, native history references and
backup depth are verified; the other worksheet remains SECOND with 0% format.
Full suite: 128 files / 4,367 tests; TypeScript, scoped lint and build pass.
The broader model-quality, mobile and general-operation scope remains active.

### Completion-to-cleanup ownership (2026-10-04)

Independent review identified a gap after native completion and before promise
continuations ran. Two failing tests reproduced foreign edits being merged or
undone there. The native adapter now captures a completion proof synchronously
before promise settlement. Proof loss is permanent; original-format restoration
can still clean up an unchanged temporary format but cannot reclaim ownership.
Owned restoration/transaction completion refresh the proof, which is checked
again before final readback and group closure. Further tests cover foreign edits
queued after restoration and after readback. Full suite: 128 files / 4,371 tests.

The native matrix now has 12 cases, adding post-completion foreign edits with
and without Stop in both formats. A distinct foreign format is used per case;
the first expanded probe accidentally used the same C3 format twice, making the
second edit a no-op. That diagnostic is retained; it is not accepted as foreign
edit evidence. Already-completed native text remains when preserving a later
foreign edit precludes rollback; the action rejects rather than claiming success.
Broader model quality and mobile acceptance remain incomplete.
