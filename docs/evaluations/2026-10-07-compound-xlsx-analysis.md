# Supported compound Excel offline lifecycle

Current served desktop Chromium build executes the supported literal IM grammar `Read A1:B2, then set B2 to "COMPOUND_XLSX_20261007".` after a warmed offline process restart. The activity returns all four original cell values before B2 changes; the full observed table shows only B2 changed, including the outside C1 marker remaining intact. Native Undo restores the complete fixture and Redo restores the result. No preview or chat/page error occurs.

Actual Save yields an 8,497-byte XLSX. Independent ZIP CRC and shared-string/cell references confirm B2 and unchanged fixture values. A separate offline Chromium process opens that file through the native chooser and reproduces the full table. Aborted spell/editor resource requests are retained, so no all-resource-success claim follows.

This validates existing bounded deterministic sequence support; it is not arbitrary multi-step reasoning, inference-quality, physical-device or physical-disconnection acceptance. CPU model availability is observed, but this literal sequence does not require model generation. The earlier October 4 wrong-target report remains historical. Runtime artifact hashes recorded here are after-run observations only; no separately frozen initial hash set was collected for this sequence. No seven-language model or prompt adoption follows.
