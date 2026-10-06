# Chinese CPU IM operation acceptance

Actual current Word, Excel and PPT IM CPU fallback accepted these Chinese requests through Operate document:

- 在光标处插入原文：IM_WORD_四季_日本_ä_2026
- 把 B2 单元格设置为文本 IM_CELL_四季_日本_ä_2026
- 在当前幻灯片添加文本框，内容为：IM_PPT_四季_日本_ä_2026

The resulting Word text, Excel B2 value and added slide text matched the exact marker (with normal editor CRLF termination where applicable). Native Undo/Redo returned exact before/after content snapshots, native Save downloaded a file, and homepage file-chooser reopen produced the same content snapshot. There were no preview cards or page errors. The verifier checks exact content rather than mere marker inclusion, executed driver hash and saved-file bytes/hashes.

The normal model/loader and existing editor API operation path were used; no model response substitution. CPU capability was forced and experimental isolation response headers applied. This certifies three explicit Chinese text-writing requests on desktop Chromium, not arbitrary Chinese instructions, generated-writing fidelity, all tools, or production header deployment. Local saved artifacts remain in scratch and are referenced by the raw report.
