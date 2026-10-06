# Production stopped-history browser result

Product repair `ecdaee2`, frozen driver/protocol `27c35a2`. The actual native Word IM used local Qwen2.5 0.5B CPU, streamed a fresh story, stopped through native worker exit and recovered without a controlled reload gate. A new instruction was explicitly sent. The SDK observer delegated requests and stream outputs without message adjustment.

The second request roles were system/user/assistant/assistant/user. Its first assistant was exactly the source shown before stopping, and the second was the truthful localized stopped state. The new user instruction retained the editor context wrapper. Thus the production history repair is observed in a real model request, not inferred from unit tests or diagnostic injection.

The raw new output was `BRAVO。`. It followed the current label rather than continuing the story, but its extra Chinese full stop fails the exact-only requirement. The DOM matched raw output plus its normal write action. The native document remained unchanged; there were zero previews, browser errors or refresh guidance. Native exit/reload and explicit send counts matched, and the browser context closed.

Run `python3 docs/evaluations/verify-stop-history-repair.py` to verify source binding, current built asset identity, actual roles/content, lifecycle and raw outcome. This one unfixed-sampling development observation is not broad quality acceptance. It does not prove IndexedDB saving/reopening, physical mobile support, offline behavior or all tool/model switching paths. No output normalization was applied to hide the punctuation miss.
