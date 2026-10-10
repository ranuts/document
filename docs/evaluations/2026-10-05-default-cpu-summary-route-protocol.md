# Default CPU selected-text summary protocol, frozen before run

Runtime d71a1e8/native Word/owned 5193, exact default CPU binary selected via file picker, separate fresh Chromium context per case. No model/prompt/budget changes. Seed only synthetic owned source through actual Word SDK, select all through SDK; choose actual IM summarize task and send fixed writing instruction. Delegate SDK createChatCompletion and retain outgoing request/completion unchanged. Actual writing route may directly replace selection without preview, as intended. Record native document before/after, model response/usage, chat/page errors, tool outcomes and native Undo/Redo if changed.

Case A source: 会议记录：周宁已收到实验报告，但尚未批准上线。上线审批由许岚负责，预计周四完成。报告收件与上线审批是不同事项，目前没有上线批准结果。以上记录用于项目状态同步。
Instruction: 压缩为一句中文摘要，保留收件人、审批人、尚未批准和预计完成时间，不要补充事实。
Criteria: genuinely shorter than source; 周宁 received report, 许岚 approves, not approved yet, expected Thursday distinct from completed approval. No role reversal/invention, one sentence.

Case B source: 项目状态：宋远建议周五交付样机，但该交付方案未获批准。只有韩岚确认预算后才能采购零件，目前预算仍待确认。采购条件尚未满足，周五交付不是已经确定的承诺。以上记录供项目组同步使用。
Instruction: 压缩为一句中文摘要，保留建议性质、未批准状态、采购前提和预算待确认状态，不要补充事实。
Criteria: shorter; 宋远's Friday delivery remains proposal/unapproved, 韩岚 budget confirmation prerequisite for procurement, budget unconfirmed; no committed delivery/purchase/invented approval/role reversal. One sentence.

Mechanical requirements separate: real selected-source route and measured request, source unchanged when host validation errors, no preview/redundant confirmation; if edit applied, native Undo restores exact before and Redo restores exact after. Quality failure is retained even if host operation verifies an edit. No keyword postrepair, generated-output replacement or hidden retries. These developer fixtures become development data after first run, not held-out broad model acceptance. File route does not certify model URL/cache/physical devices.
