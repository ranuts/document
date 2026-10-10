# Excel literal text through IM

The current production build preserves explicitly quoted text in literal
read-then-write sequences. General and 0.00 targets store `00123` as native text
(type 1), preserve their format, and support one-step native Undo to 30 and Redo
to `00123`. Unquoted 99 remains numeric (type 0). Fixture neighbors remain
unchanged. No preview card or confirmation step is introduced.

Native toolbar Save through the browser download fallback produced
`.scratch/ai-csp/im-literal-text-saved.xlsx`. Reopening through the homepage file
chooser preserved `00123`, text type and 0.00 format. The report records artifact
and built-plugin hashes. The initial Save probe waited for a download without
disabling the system picker; its timeout diagnostic is retained and excluded.

The compiled current-source matrix covers six scenarios in both formats:
success, Stop, foreign edit, foreign edit followed by Stop, post-completion
foreign edit, and post-completion foreign edit followed by Stop. All 12 start
with an existing Redo branch. Cancellation restores that branch; success or
foreign edits release the owned backup without restoring it. Native masks and
group markers are closed. Delayed font continuations are released after cleanup.

Five actual built IM negative paths cover merged/protected targets, deferred-font
Stop, native selection navigation then Stop, and native sheet navigation then
Stop. Original values/formats, native point references and backup depth remain
intact. The second worksheet stays SECOND/0%. Navigation uses native APIs while
the interaction mask is held; clicking disabled worksheet UI is not simulated.

Target freshness and edit ownership are separate. Navigation prevents insertion
but permits rollback of exclusively owned canceled edits. A synchronous native
completion proof protects the subsequent promise continuations. Proof loss is
permanent; format restoration cannot reclaim it. After an already-completed
insertion races with a foreign edit, completed text and original format remain,
the foreign edit is preserved, and the action rejects instead of claiming
success. The first expanded probe repeated a C3 format, making one supposed
foreign edit a no-op; that diagnostic is retained and excluded from acceptance.

Run `python3 docs/evaluations/verify-excel-text-write.py` and
`python3 docs/evaluations/verify-cpu-im-text-write-restrictions.py` to check current
module/bundle hashes, native outcomes, IM results and saved artifact. All 128
unit test files / 4,371 tests, TypeScript, scoped lint, build and independent
source review pass.

Literal sequences bypass model planning; a loaded cached CPU model here does
not establish model quality. Mobile, full workbook, arbitrary compound requests,
protected-sheet editable exceptions and deployment acceptance remain incomplete.
