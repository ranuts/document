# Owned Excel history group scope

Implemented withExcelHistoryGroup around the native Excel group API and existing preserveNativeRedo. It captures original prefix/marker identity, requires caller ownership and an available group, ends successful groups and releases the old branch backup. On owned failure it cancels then ends the Excel group before restoring old Redo. An empty marker created just before an opening exception is also recoverable. After ownership loss it never cancels/merges foreign history; it only neutralizes the still-owned open marker description. Caller must hold a blocking action and prove document/history/edit ownership; structural marker checks alone do not identify every external write.

Six unit cases cover success/backup disposal, cancellation cleanup order, ownership loss, opening failure before/after marker creation and replaced prefix preservation. Missing implementation failed before adding the scope. Native ownership-interference acceptance remains separate; these mocked branch tests do not prove every SDK failure branch.

Current-source native probes compose the group, format binding/scope, callback guard/adapter and old Redo helper. They record all source hashes and use real SDK operations. Both General and 0.00 cases start with a native pending 30→40 Redo.

On deferred-font cancellation, native history index/point identities/backup depth restore exactly, the old future point is retained, the group closes, and cell/format stay unchanged after late callback release. Native Redo still writes 40 and Undo restores 30.

On successful 00123 text writing, old future point references disappear, backup depth returns to baseline and the group closes. Redo at the new tip cannot replay old 40. One Undo restores numeric 30/original format; a subsequent Redo restores text 00123/original format. No page errors occurred. An added Redo observation initially called the locator as a function and failed; its diagnostic JSON is retained. The corrected probe executes the observation and verifier checks every before/after snapshot.

Full suite: 124 files / 4,340 tests passed. TypeScript, scoped lint and whitespace checks passed; existing PromiseRejectionHandledWarning messages remain. The scope remains unused by set_cell. Next implement native writer preflight/blocking/pending-edit ownership and connect explicit text-mode planning, then verify actual IM and save/reopen. This component acceptance is not a completed leading-zero fix.
