# Compound read-sort-sum gap

A warmed desktop Chromium persistent profile was closed and reopened with browser offline emulation. Home came from the actual service worker and the cached default CPU model became ready. The original Tools request read A1:B4, sorted that range by B ascending preserving its header, then summed B2:B4 into D2. It returned no executable operation, no activities and no replies. The observed A1:C4 snapshot remained identical, including the outside marker C1. The process exited 0 because the diagnostic observation completed; the requested workflow failed.

Source inspection identifies two independent restrictions: document-tool-sequence.ts recognizes only a literal read-then-set special case and refuses other explicit read sequences; panel.ts rejects any sequence with a writing operation before the final step. The observed refusal therefore cannot be solved solely by a model swap or prompt change.

No product code changed. D2 was not included in the captured snapshot, so this receipt does not independently prove every cell unchanged or a sum result. Save, Undo/Redo and reopening were not attempted after refusal. Two aborted spelling resource requests are retained. This is browser offline emulation, not physical network/device acceptance. A wider multiple-write sequence needs explicit partial-result, Stop and failure semantics before implementation.
