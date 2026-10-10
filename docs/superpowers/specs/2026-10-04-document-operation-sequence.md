# Ordered document operations

The user wants concise IM operations on the current Word, Excel and PPT through existing APIs, without preview cards or redundant confirmation. The immediate reproduced spreadsheet request is: 读取 A1:B4 的内容，然后将 B2 设置为 99。 Success means displaying all requested source cells as they existed before the write, changing B2 alone, reporting the verified write and supporting native Undo/Redo. Current single-operation planning rejects its wrong destination but does not fulfil the request.

Introduce a sequence wrapper around existing immutable DocumentToolPlan objects. A single request produces an ordered array of validated plans, at most four actions. The first supported composite shape is a complete literal range-read followed by a literal single-cell assignment. Parse that entire request explicitly; do not execute a model-selected subset. Other single requests retain existing generation. Do not claim arbitrary composite language support.

All plans are validated before execution. Initially allow read-only steps followed by at most one mutation, which must be last. This preserves one native mutating action without promising a multi-write transaction. Capture the editor target once; read-only steps must not move selection/history. Recheck target freshness and abort state before each action. Reuse DocumentToolAction for each plan. Never recapture a changed document silently.

Emit and archive each verified read result before the final write status, using ordinary literal tool messages. An aborted or failed sequence retains already emitted read results and shows the actual failure; it never shows overall completion. The final write retains native value verification and Undo/Redo. Every history write belongs to the originating conversation.

Future extensions remain separate: general model-generated sequences, multiple mutations with transaction semantics, conditional operations, writing fidelity, mobile and offline/device certification. This spec does not redefine the full active goal around the first supported composite.
