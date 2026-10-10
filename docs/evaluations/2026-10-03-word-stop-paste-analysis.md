# Word replacement cancellation baseline

Production bundle: `editor-DViW8J2w.js`, commit `bca88ed`.
Actual isolated Chromium IM with cached WebGPU Qwen3-1.7B; native `pre_Paste` preparation callback deliberately held, then resumed after the visible Stop button was clicked. No product source instrumentation.

Two runs observed one native preparation and one resumed callback. The second run additionally checked native Undo. The canonical JSON contains the second run.

- Original: `Alpha target body` and a separate `Neighbor unchanged` paragraph.
- Before Stop, while preparation remained pending, selected `Alpha` had already been removed.
- Immediately after Stop, that removal remained.
- Resuming the preparation callback inserted the complete requested replacement despite Stop.
- A native Undo restored the original paragraph text and captured per-character direct bold state exactly.
- No page errors or visible error guidance was recorded.

This disproves cancellation safety for the current Word replacement path. It does not establish behavior under real slow font loading, complex formatting, collaborative editing, or file persistence.

Source findings: `DocumentToolAction.apply(signal)` forwards cancellation to the selected tool, but `replaceSelectionTool.execute` does not accept it and returns immediately after `pluginMethod_PasteHtml`. The bundled Word wrapper starts group actions, inserts a temporary HTML element, increments its long-action counter, and passes cleanup/group-finalization through an asynchronous native paste completion callback. Its mutation is already in progress before the tool returns. The existing presentation paste guard therefore cannot simply be copied without accounting for Word's early selection deletion and the wrapper's cleanup/history ownership.

Required next work: retain ownership through asynchronous Word paste completion; suppress late insertion on cancellation; finish owned native cleanup; restore an owned partial deletion without undoing independent user edits or damaging an existing redo branch; verify normal replacement, cancellation, next-operation recovery, and native Undo/Redo. Use regression tests plus the actual controlled browser scenario before claiming a fix. No preview or extra confirmation is needed.

## Native cleanup experiments

Two isolated desktop WebKit experiments on the same built product establish an implementation prerequisite; these are direct native API experiments, not a fixed IM path:

1. Suppress the held insertion, call `g_specialPasteHelper.Paste_Process_End`, then native Undo. Text and selection recover, but `isLongAction()` stays true, the `pmpastehtml` element remains, and the wrapper completion callback never fires. This approach alone is unsuitable.
2. Additionally run the captured native paste completion callback once before Undo. This releases the wrapper's long-action counter and temporary HTML element. After the held callback is resumed, text/selection stay restored; a subsequent native HTML replacement succeeds and its Undo restores the original again.

Reports: `2026-10-03-word-native-cancel-cleanup-probe.json` and `2026-10-03-word-native-cancel-completion-probe.json`.

The second experiment leaves the cancelled partial deletion on the redo branch. Production code must remove only its owned cancelled change and preserve any earlier redo branch. Neither experiment establishes ownership safety under independent mutations, proves every native cleanup callback is idempotent, or fixes the currently shipped IM cancellation behavior. Word's runtime `_getLongPointIndex()` remained -1 during this HTML wrapper operation, so the presentation group-marker assumptions cannot be reused directly.

## Owned history transaction implementation

`word-paste-history.ts` now preserves the earlier redo branch, seals a single native paste point and its item identities before asynchronous preparation, and rolls back only that unchanged owned point. It restores saved/selection metadata and the previous point's `Additional` existence/reference even without redo. Empty owned points use native `Remove_LastPoint`, never Undo of the previous real edit. Point/item replacement, appending foreign history, expiration, and a failed native Undo postcondition reject cleanup.

12 regression cases pass; 8 failed against the original no-op implementation and 2 further cases exposed the missing Additional/empty-point behavior before their fixes. Independent review found the Additional gap; final review found no new high-risk issue in this helper scope.

Direct isolated WebKit experiments execute the actual helper source with its TypeScript types stripped, against the real Word SDK. At the history tip it removes the cancelled paste point, restores original text/selection, leaves no redo entry for the cancelled deletion, and permits a subsequent native replacement and Undo. With an earlier undone edit it restores `Can_Redo=true` and the original history point count before the subsequent replacement. These snapshots do not prove physical saved-file state or every formatting attribute, and the latter run does not actually execute the recovered earlier Redo.

Reports: `2026-10-03-word-native-history-helper-probe.json`, `2026-10-03-word-native-history-helper-redo-probe.json`.

At checkpoint `b000051`, the production tools still called the original immediate-return paste method. That step alone did not repair IM Stop; asynchronous completion/cancellation integration and its full real-browser verification remain required. Ownership requires the caller to supply editor identity/interaction checks and prevent independent user interaction during the pending native write.


## Integrated Word cancellation and completion

Final production bundle: `editor-C2N-hO8C.js`. Insert/replace tools await `pasteWordHtml` and forward cancellation. Reviewed writing and direct previous-answer requests forward their signals as well. No preview or confirmation UI was introduced.

The first integrated post-cancel write produced correct text and native Undo/Redo but failed the no-new-error predicate (`word-im-stop-paste-recovery-before-release.json`). Native callback inspection exposed an interaction-action cycle: the HTML wrapper waits for long actions to end, while the helper awaited the wrapper before releasing its own action. Word now releases only its owned interaction action immediately before native completion and awaits the wrapper cleanup before restoring cancelled history. The shared action release is idempotent; presentation actions still release in finally. Unit regressions failed before both the action-release and delayed-cleanup ordering fixes.

Final actual desktop Chromium with cached WebGPU Qwen3-1.7B, deliberately held native preparation callback:

- Replacement with an earlier undone edit: Stop restores original paragraphs, selected `Alpha`, exact original native point/item identities, saved/selection metadata references, Additional and redo backup depth. Resuming the callback inserts nothing. Native prior Redo actually replays ` PRIOR`, and Undo restores the original again.
- A subsequent IM replacement succeeds without refreshing; exact paragraph/character snapshots survive native Undo/Redo and no additional error appears.
- Insertion with no selection cancels without undoing the earlier document setup; history returns to its original tip, with no cancelled deletion on redo.
- In chat mode, generated visible `Hello.` is routed by the explicit previous-answer replacement instruction to native HTML `Hello.`; Stop and prior-redo recovery pass the same checks.
- Normal multiline literal replacement preserves leading/trailing spaces, literal `<b>Alex & Co</b>`, numeric/date facts, suffix and neighboring paragraph; native Undo/Redo and no visible errors pass.

Canonical reports: `word-im-stop-paste-recovery-fixed.json`, `word-im-stop-insert-fixed.json`, `word-im-stop-direct-answer-fixed.json`, `word-im-async-literal-replacement-ui.json` (all prefixed `2026-10-03-`).

Qwen3.5-0.8B returned no accepted executable operation in this controlled prior-redo request; no native preparation occurred, the input recovered, and original Word text remained. Its report is an operation-selection limitation, not cancellation evidence. Raw model output was not instrumented, so this does not distinguish model refusal from a rejected candidate plan.

Independent final review found no must-fix issue in this scope. Build, lint and 110 files / 3951 tests passed. These results do not establish physical slow-font behavior, every formatting attribute, native file-save persistence, cancellation for all models/devices, or automatic recovery after loss of ownership/cleanup timeout. Cleanup has a separate bounded wait; failure cannot authorize Undo of independent user edits. Stop suppresses pending insertion, not a write already committed synchronously.

## Late cleanup deadline and independent edits

Two additional unit cases verify that rollback refuses an independent edit introduced while cancelled wrapper cleanup is pending, and that a completion arriving after the cleanup deadline never resumes history mutation. Both pass against the existing implementation; no product behavior was changed for this follow-up.

An isolated desktop WebKit experiment executes the current helper source against the actual Word SDK with deliberately held preparation/completion and a shortened 50 ms cleanup limit. After cancellation the cleanup deadline reports unverified state; the early selected-text deletion remains. An independent subsequent native insertion succeeds. Delivering the old completion and preparation callbacks leaves text, selection, history cursor, point/item identities, busy/temporary HTML state and redo backup depth unchanged. Native Undo of the independent insertion followed by Undo of the cancelled deletion restores the original text and selected `Alpha`.

Report: `2026-10-03-word-native-late-cleanup-probe.json`. This supports late-callback isolation and manual native recovery under a controlled cleanup deadline. It does not prove automatic restoration on cleanup failure, actual physical slow-font behavior, or the production IM's full 10-second timeout duration. The exact-reference history assertion is computed in the browser; JSON stores the resulting predicate and snapshot counts.
