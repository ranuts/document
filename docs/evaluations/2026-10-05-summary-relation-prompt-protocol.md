# Summary relational prompt feasibility probe, frozen before inference

This is an authorized local feasibility experiment, not a product/default change. Runtime d71a1e8/native selected-text summary route, default CPU 0.6B binary, temperature 0.7/top_p 0.8/512 unchanged. Two new fixtures, separate fresh contexts per baseline/candidate (four runs). Same source/instruction/model/SDK/native action each pair. Candidate changes exactly the existing summarize sentence in the outgoing user message by a delegated SDK wrapper; original and modified requests retained. SDK inference and original result remain real, no output repair/stub. Since token budgeting occurs before interception, this tests prompt feasibility only, not the production context-budget integration of a retained change. Small actual contexts/stop reasons recorded. No implementation dependencies or new production UI.

Candidate replaces `summarize: produce a concise faithful summary. Never add claims that are absent from the source.` with `summarize: shorten redundant wording while preserving the source's main facts and their relationships: who did what, what each date refers to, negation, uncertainty, and prerequisites. Do not turn proposals or expectations into completed or approved actions.` No fixture names, words or expected outputs in candidate instruction.

Fixture A source: 审核记录：周澈周一提交了周四发布公告的草案，草案尚未获批。柳音负责审批；必须先核对数据才能批准，而数据核对目前未完成。周四发布仅是拟议日期，项目组还没有发布决定。本记录用于审核进度同步。
Instruction: 压缩为一句中文摘要，保留人物、时间指向、当前状态和审批前提，不要补充事实。
Criteria: 周澈 submitted draft Monday for proposed Thursday publication; 柳音 approves; no approval/publication decision; prerequisite data check incomplete. Shorter, one sentence, no role/date/status/condition change or inventions.

Fixture B source: 试产记录：任汐建议周二开始试产，但管理组尚未接受该建议。只有欧岳确认设备检查结果后才能排产；目前设备检查仍在进行，没有完成结果确认。周二试产不是已确定的计划，这份记录用于团队同步。
Instruction: 压缩为一句中文摘要，保留建议性质、责任人、排产前提和当前未确认状态，不要补充事实。
Criteria: 任汐 proposed Tuesday pilot production, not accepted; 欧岳 confirmation prerequisite to scheduling; inspection ongoing/results unconfirmed, no firm Tuesday plan. Shorter, one sentence, no date-attachment/roles/status change or invention.

Baseline then candidate each fixture, one run each. New fixtures become development data after first run; no statistical/held-out/promote-default claim. Mechanical requirements: SDK original response equals actual applied document or host validation rejection retains source, normal completion, error/cleanup records, native Undo/Redo for actual edits. Preserve candidate failures and uncertain semantic grading, no normalization or relaxing criteria. Production change would require further independent quality/resource/context integration checks; no such change authorized by passing a single pair alone.
