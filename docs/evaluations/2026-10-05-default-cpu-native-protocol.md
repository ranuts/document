# Default CPU native IM protocol, frozen before inference

Runtime d71a1e8, owned production preview 5193, fresh full Chromium context per case, service workers blocked. CPU Qwen3-0.6B Q4_K_M from the exact revision-pinned current default URL, selected via native local-file picker. Download completed before inference; GGUF v3, 484,220,320 bytes, SHA256 9acfc1e001311f34b4252001b626f2e466d592a42065f66571bff3790d4e1b14. File selection validates this binary and CPU/native IM path, not URL/cache/offline acceptance. Generation defaults unchanged. No cloud inference or document operation requested.

Case 1 prompt: 不要操作文档。请用一句中文概括以下事实，不要补充信息：周宁已收到实验报告，但尚未批准上线；审批由许岚负责，预计周四完成。

Predeclared manual criteria: preserves 周宁 as report recipient, 许岚 as approver, not-yet-approved status and expected Thursday completion without converting expectation into completion or approval. One sentence and no invented facts. Exact document GetText unchanged and no chat/browser error are separate mechanical requirements.

Case 2 prompt: 不要操作文档。输出三个英文大写字母：CAT。除 CAT 外不要输出任何内容。

Predeclared criterion: final data-source exactly CAT, without whitespace, punctuation or reasoning. No normalization. Exact document GetText unchanged and no chat/browser error are separate mechanical requirements.

Record model hint/status, output data-source, duration, document before/after and errors. Each case uses a separate fresh session to avoid cross-case history. These two new developer fixtures become development data after first inference; they are not independent held-out general-quality acceptance. No prompt, model or budget tuning during this run. Timeout/errors are retained, never silently rerun as a replacement result.
