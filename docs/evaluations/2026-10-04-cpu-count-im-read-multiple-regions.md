# Multiple-region and composite request failures

Actual current CPU Excel IM 读取 A1:B2 和 A3:B4 的内容。 and Read A1:B2 and A3:B4. Do not change any cells. returned only A1:B2, omitting A3:B4 without a partial-result indication. Inspected cells were unchanged. 读取 A1:B4 的内容，然后将 B2 设置为 99。 wrote 99 to A1 instead of the requested B2 (which remained 30) and omitted the requested range read, then displayed the verified completion status. These are semantic coverage failures, not successful full-request execution. The destination was wrong, so neither requested operation was fulfilled.

The normal loader/model and operation path were used without inference substitution. No preview cards or errors appeared. The inherited Undo/Redo applies to the final wrong-target write and is not used to claim composite-request acceptance. The verifier checks observed omissions and actual A1=99 and unchanged B2=30, preserving these failures as evidence.

The current planner chooses exactly one operation and asks the model to reject multi-operation requests, but the model does not reliably follow that instruction. Future work must retain full request coverage: bounded multi-region reads can be one read operation, while read-then-write needs explicit supported sequencing or actionable rejection rather than silently executing only the write. The current implementation has not yet fixed either failure. General model quality remains open.

The initial verifier incorrectly expected B2=99 and failed. Inspecting the raw table exposed the stronger wrong-target failure; the verifier and prose were corrected without changing raw evidence.
