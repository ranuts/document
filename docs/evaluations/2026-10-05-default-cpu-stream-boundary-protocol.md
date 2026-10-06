# Default CPU stream boundary diagnostic, frozen before run

Runtime d71a1e8/native Word, exact downloaded default CPU binary via local file, fresh Chromium context per case; settings/generation defaults unchanged. No product or model prompt changes. Delegate actual bundled Wllama.prototype.createChatCompletion, record outgoing request minus AbortSignal and each original yielded chunk; wrapper yields each chunk unchanged. Record SDK raw content versus displayed data-source, finish/usage metadata, exact document before/after. This observer adds timing overhead and is scoped to synthetic local QA. It does not substitute inference or certify original unobserved run's raw tokens.

Case 1 repeats known development fixture: 不要操作文档。请用一句中文概括以下事实，不要补充信息：周宁已收到实验报告，但尚未批准上线；审批由许岚负责，预计周四完成。
Criteria unchanged: recipient 周宁, approver 许岚, not-yet-approved state, expected Thursday, one sentence, no inventions.

Case 2 fresh fixture: 不要操作文档。请用一句中文概括以下事实，不要补充信息：宋远提出周五交付样机的建议，但方案未获批准；只有韩岚确认预算后才能采购零件，目前预算仍待确认。
Criteria: proposal and Friday are tentative rather than a committed delivery; not-approved status preserved; 韩岚's budget confirmation is the prerequisite for purchasing, budget still unconfirmed; roles preserved, no invented actions or facts, one sentence. After first inference this becomes development data, not a held-out acceptance set.

Predeclared diagnosis: SDK raw omission falsifies a display-only explanation for that observed run; raw retains critical state but displayed source loses it indicates a presentation/filter boundary issue. Inspect outgoing system/user messages for corruption and final finish_reason/token usage for truncation. If repeated fixture happens to pass, retain historical failure and do not declare it fixed. Mechanical requirements separate: finished generation, no document changes/errors, owned contexts/browser close. No hyperparameter/model promotion or prompt overfitting in this run.
