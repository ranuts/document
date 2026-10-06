# Excel insertion guard compatibility investigation

Compiled current transaction and native-paste helpers were exercised against the real Excel SDK. Fourteen normal General/0.00 cases pass exact text/format/Undo/Redo checks. This does not prove cancellation compatibility.

The first fault-injection probe deferred API pre_Paste. Excel single-cell text paste did not call that method, so the fixture did not delay insertion and correctly records “Native preparation was not deferred.” Its result is retained; it is not an accepted cancellation test.

Local bundled SDK inspection traces asc_PasteData → wb.pasteData → pasteTextOnSheet → worksheet.setSelectionInfo('paste'). The latter performs protection checks, cell/all locks and worksheet._loadFonts before the mutation callback. It does not use the PPT pre_Paste guard for this text-to-cell path.

A corrected fault-injection probe delays the real worksheet._loadFonts callback while executing original native paste logic and the compiled helpers. The PPT-oriented helper rejects with “Native paste was rejected” because no preparation was observed. The format scope restores its original format. Releasing the delayed original font callback still inserts 123 into the original numeric 30 cell, after rejection. This happens in both General and 0.00 formats; native Undo/Redo remains available. No page errors occurred.

Thus pasteSlideText cannot serve as the Excel cancellation adapter, even though synchronous normal cases complete successfully. This is a controlled asynchronous SDK reproduction, not a current IM text-mode implementation: the new transaction scope remains unused by set_cell. No product code was changed this turn.

Required next implementation: an Excel-owned adapter must guard the worksheet protection/lock/font callback pipeline, bind original worksheet/cell/history, suppress captured callbacks after cancellation/rejection/timeout, restore intercepted methods and release only owned paste state. Its blocking action must prevent unrelated edits during interception. Tests must prove late callbacks do not mutate after failure, not merely that a promise rejects. Native format restoration must bind the captured cell instead of relying on a later active selection.
