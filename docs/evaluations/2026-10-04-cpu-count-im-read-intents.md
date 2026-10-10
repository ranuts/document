# CPU explicit read intent diagnostic — range coverage failure

Actual current Excel IM CPU fallback returned B2 and 30 for both 只读取 B2 的值，不要修改任何单元格。 and Read B2 only. Do not change any cells. All inspected A1:C4 cells remained intact, without errors or preview cards.

读取 A1:B4，不要排序或修改。 instead returned only A1 and Name. Other requested cells were omitted without an unsupported-operation or partial-result indication. This is a semantic coverage failure, despite no mutation and structurally successful execution. The range-read request must not silently become a single-cell read.

The normal model/loader and editor tool path were used, with worker action observation and GPU capability forced off. No inference output was substituted. The verifier confirms the observed omission, not overall acceptance. Inherited final Undo/Redo touches seed history and is not used as read acceptance evidence.

Next work: inspect available spreadsheet read capabilities and add or use a bounded range read that returns the whole requested region; preserve explicit ranges during planning validation. This must retain single-cell reads and avoid treating a narrower successful result as fulfilling a wider request. One desktop Chromium CPU run does not establish broader model quality.
