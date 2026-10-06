# Word asynchronous paste cancellation

The actual IM baseline proves selected text is deleted before native preparation completes and Stop does not prevent late insertion. Native experiments prove cancellation must also finish the HTML wrapper callback or its long-action state and temporary HTML element remain.

Preserve direct IM operation and native Undo/save. No new preview or confirmation UI.

1. Implement an owned Word paste history transaction. Capture prefix point/item identity, preserve prior redo, seal the single synchronous paste point before yielding, remove only that unchanged point on rollback, restore native saved/selection metadata. Reject rollback after foreign mutation or editor expiration.
2. Implement asynchronous Word HTML paste completion/cancellation. Capture the native wrapper completion callback once, guard the deferred preparation insertion, finish owned paste cleanup on cancellation, and roll back through the transaction. Balance native interaction blocking and terminate ownership on document change or timeout.
3. Integrate insert/replace tools and request cancellation. Preserve escaping, whitespace, selection constraints, normal successful Undo/Redo, and result verification.
4. Test delayed preparation cancellation, prior redo preservation, timeout, double completion, stale/foreign document and history, next-operation recovery, normal literals, and the actual production IM path. Review before claiming a product fix.

Progress: steps 1–4 implemented and reviewed on this branch. The final `editor-C2N-hO8C.js` production build passes actual isolated Chromium/Qwen3-1.7B controlled native-preparation cancellation for replacement, insertion and previous-answer chat commands; preserves/replays prior redo; permits the next IM write with exact native Undo/Redo; and preserves a multiline literal's spaces/markup characters. Full suite: 110 files / 3951 tests, build and lint pass.

The real post-cancel write exposed a native long-action cleanup cycle in the initial integration. Word now releases its own interaction action before invoking native completion; waits for wrapper cleanup before rollback. Shared action release is idempotent; PPT retains its existing finally release. New failing-then-passing regression cases cover both this cycle and deferred wrapper cleanup.

Limits: controlled preparation delay is not physical slow-font-loading evidence. Independent native history/editor mutations and cleanup deadlines fail conservatively; no automatic undo occurs after loss of ownership. Complex formatting, file persistence, physical-device behavior and all-model cancellation remain outside this evidence. Qwen3.5-0.8B did not produce an accepted executable operation in the tested prior-redo request, so that run does not validate its cancellation behavior. Already committed synchronous edits cannot be cancelled retroactively.
