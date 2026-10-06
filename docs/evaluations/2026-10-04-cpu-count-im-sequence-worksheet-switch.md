# Worksheet identity during an ordered operation

Current build tested through the actual Excel IM with cached CPU fallback. The native workbook contained two sheets: the original A1:C4 dataset with B2=30, and a second sheet with B2=SECOND. Native worksheet creation, navigation and fixture seeding were used; the planner, tool execution and model responses were not replaced.

After the first range-read result appeared, a DOM observer switched the active worksheet through the native `asc_showWorksheet` API. The recorded active index changed from 0 to 1. The subsequent B2 write was rejected as expired, and exact A1:C4 snapshots of both sheets remained equal to the initial snapshots. The completed read remained in the activity disclosure, with no final success message or preview card.

The probe then returned to sheet 0 and executed the same request without interruption. Only original-sheet B2 changed from 30 to 99; every other sampled cell and the second-sheet SECOND marker remained unchanged. No page errors occurred; the plugin hash stayed unchanged during the probe.

This is direct evidence for worksheet identity checks in the current read-then-write path. It does not establish document replacement, already-started native-write cancellation, arbitrary composites or mobile behavior. No product change was needed. `verify-cpu-count-im-sequence-worksheet-switch.py` checks the exact two-sheet snapshots, actual index change, errors, normal success and absence of previews.
